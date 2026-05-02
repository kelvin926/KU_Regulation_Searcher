import { describe, expect, it } from "vitest";
import { DEFAULT_RAG_ARTICLES, HARD_MAX_RAG_ARTICLES, MAX_RAG_ARTICLES } from "../../shared/constants";
import type { ArticleRecord } from "../../shared/types";
import type { DatabaseService } from "../db/database";
import { SearchService } from "./fts-search";

describe("SearchService RAG candidate limits", () => {
  it("returns the default number of question candidates", () => {
    const db = createMockDatabase({
      ftsArticles: createArticles(20),
    });
    const service = new SearchService(db);

    const result = service.searchForQuestion("휴학", DEFAULT_RAG_ARTICLES);

    expect(DEFAULT_RAG_ARTICLES).toBe(10);
    expect(result.articles).toHaveLength(10);
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

    expect(MAX_RAG_ARTICLES).toBe(16);
    expect(receivedIds).toHaveLength(16);
    expect(articles).toHaveLength(16);
    expect(receivedIds).toEqual(Array.from({ length: 16 }, (_, index) => index + 1));
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
});

function createMockDatabase(overrides: {
  ftsArticles?: ArticleRecord[];
  getArticlesByIds?: (ids: number[]) => ArticleRecord[];
}): DatabaseService {
  return {
    getStats: () => ({ articleCount: 100 }),
    searchArticlesByFts: () => overrides.ftsArticles ?? [],
    searchArticlesByLike: () => [],
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
