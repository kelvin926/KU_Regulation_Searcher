import { describe, expect, it } from "vitest";
import { DEFAULT_SEARCH_CANDIDATE_LIMIT, HARD_MAX_RAG_ARTICLES, MAX_RAG_ARTICLES } from "../../shared/constants";
import type { ArticleRecord } from "../../shared/types";
import type { DatabaseService } from "../db/database";
import { SearchService } from "./fts-search";

describe("SearchService RAG candidate limits", () => {
  it("returns the default number of question candidates", () => {
    const db = createMockDatabase({
      ftsArticles: createArticles(40),
    });
    const service = new SearchService(db);

    const result = service.searchForQuestion("휴학", DEFAULT_SEARCH_CANDIDATE_LIMIT);

    expect(DEFAULT_SEARCH_CANDIDATE_LIMIT).toBe(30);
    expect(result.articles).toHaveLength(30);
    expect(result.candidateLimitReached).toBe(true);
  });

  it("caps generated-answer candidates at the maximum", () => {
    let receivedIds: number[] = [];
    const db = createMockDatabase({
      getArticlesByIds: (ids) => {
        receivedIds = ids;
        return createArticles(ids.length);
      },
    });
    const service = new SearchService(db);

    const articles = service.getCandidateArticles(Array.from({ length: 25 }, (_, index) => index + 1), MAX_RAG_ARTICLES);

    expect(MAX_RAG_ARTICLES).toBe(12);
    expect(receivedIds).toHaveLength(12);
    expect(articles).toHaveLength(12);
    expect(receivedIds).toEqual(Array.from({ length: 12 }, (_, index) => index + 1));
  });

  it("uses the saved custom maximum when collecting generated-answer candidates", () => {
    let receivedIds: number[] = [];
    const db = createMockDatabase({
      getArticlesByIds: (ids) => {
        receivedIds = ids;
        return createArticles(ids.length);
      },
    });
    const service = new SearchService(db);

    const articles = service.getCandidateArticles(Array.from({ length: 25 }, (_, index) => index + 1), 7);

    expect(receivedIds).toHaveLength(7);
    expect(articles).toHaveLength(7);
  });

  it("keeps custom maximums inside the hard safety cap", () => {
    let receivedIds: number[] = [];
    const db = createMockDatabase({
      getArticlesByIds: (ids) => {
        receivedIds = ids;
        return createArticles(ids.length);
      },
    });
    const service = new SearchService(db);

    service.getCandidateArticles(Array.from({ length: 50 }, (_, index) => index + 1), 99);

    expect(receivedIds).toHaveLength(HARD_MAX_RAG_ARTICLES);
  });

  it("searches directly named regulations inside natural questions", () => {
    let directRegulationName = "";
    const db = createMockDatabase({
      compactRegulationArticles: (regulationName) => {
        directRegulationName = regulationName;
        return [
          createArticle(1, "GKS융합전공 운영 지침", "제4조", "행정지원과 조교"),
          createArticle(2, "GKS융합전공 운영 지침", "제5조", "운영위원회"),
        ];
      },
      requiredTermArticles: [
        createArticle(3, "교우회 학술상 수상 후보자 추천 운영 지침", "제4조", "추천절차"),
      ],
    });
    const service = new SearchService(db);

    const result = service.searchForQuestion(
      "GKS융합전공 운영 지침 제4조를 봐야 할 것 같은데, 핵심 내용과 적용할 때 볼 부분을 알려줘.",
      DEFAULT_SEARCH_CANDIDATE_LIMIT,
    );

    expect(directRegulationName).toBe("GKS융합전공 운영 지침");
    expect(result.articles[0].id).toBe(1);
    expect(result.articles[0].relevance?.group).toBe("primary");
  });

  it("adds multilingual diagnostics and Korean normalized search variants", () => {
    const db = createMockDatabase({
      ftsArticles: [
        createArticle(
          1,
          "학사운영 규정",
          "제29조",
          "군입대 휴학",
        ),
      ],
    });
    const service = new SearchService(db);

    const result = service.searchForQuestion("Can undergraduate students take military leave in their first semester?", 5, {
      language: "auto",
    });

    expect(result.detectedLanguage).toBe("en");
    expect(result.translationSource).toBe("local-glossary");
    expect(result.normalizedQueries?.join(" ")).toContain("군입대");
    expect(result.expandedKeywords).toEqual(expect.arrayContaining(["군입대", "신입생"]));
  });

  it("returns routing diagnostics and retry suggestions when no grounded evidence is found", () => {
    const service = new SearchService(createMockDatabase({}));

    const result = service.searchForQuestion("대학원생의 자퇴 방법은?", DEFAULT_SEARCH_CANDIDATE_LIMIT);

    expect(result.errorCode).toBe("NO_RELEVANT_ARTICLES");
    expect(result.routingNotes?.join(" ")).toContain("대학원생 자퇴");
    expect(result.suggestedQueries).toEqual(
      expect.arrayContaining(["대학원학칙 일반대학원 시행세칙 자퇴", "대학원학칙 자퇴"]),
    );
  });
});

function createMockDatabase(overrides: {
  ftsArticles?: ArticleRecord[];
  compactRegulationArticles?: (regulationName: string, limit: number) => ArticleRecord[];
  requiredTermArticles?: ArticleRecord[];
  getArticlesByIds?: (ids: number[]) => ArticleRecord[];
}): DatabaseService {
  return {
    getStats: () => ({ articleCount: 100 }),
    searchArticlesByFts: () => overrides.ftsArticles ?? [],
    searchArticlesByLike: () => [],
    searchArticlesByRequiredTerms: () => overrides.requiredTermArticles ?? [],
    searchArticlesByCompactRegulationName: (regulationName: string, limit: number) =>
      overrides.compactRegulationArticles?.(regulationName, limit) ?? [],
    searchArticlesByRegulationNameTerms: () => [],
    searchArticlesByBooleanQuery: () => ({ articles: [], highlightTerms: [] }),
    getArticlesByIds: overrides.getArticlesByIds ?? (() => []),
  } as unknown as DatabaseService;
}

function createArticles(count: number): ArticleRecord[] {
  return Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    regulation_id: 1,
    regulation_name: "테스트 규정",
    article_no: `제${index + 1}조`,
    article_title: null,
    article_body: "휴학 관련 본문",
    seq: null,
    seq_history: index + 1,
    seq_contents: index + 1,
    source_url: "https://example.test",
    fetched_at: "2026-01-01T00:00:00.000Z",
  }));
}

function createArticle(id: number, regulationName: string, articleNo: string, articleTitle: string): ArticleRecord {
  return {
    id,
    regulation_id: id,
    regulation_name: regulationName,
    article_no: articleNo,
    article_title: articleTitle,
    article_body: `${articleTitle} 관련 본문`,
    seq: null,
    seq_history: id,
    seq_contents: id,
    source_url: "https://example.test",
    fetched_at: "2026-01-01T00:00:00.000Z",
  };
}
