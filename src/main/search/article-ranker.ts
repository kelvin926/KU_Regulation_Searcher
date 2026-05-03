import type { ArticleRecord } from "../../shared/types";

export interface RankedArticleResult {
  articles: ArticleRecord[];
  candidateLimitReached: boolean;
  searchedCandidateCount: number;
}

export function dedupeAndLimitArticles(articles: ArticleRecord[], limit: number): ArticleRecord[] {
  const seen = new Set<number>();
  const results: ArticleRecord[] = [];
  for (const article of articles) {
    if (seen.has(article.id)) continue;
    seen.add(article.id);
    results.push(article);
    if (results.length >= limit) break;
  }
  return results;
}

export function rankArticlesForQuestion(
  articles: ArticleRecord[],
  query: string,
  keywords: readonly string[],
  limit: number,
): RankedArticleResult {
  const unique = dedupeArticles(articles);
  const context = buildRankingContext(query, keywords);
  const scored = unique
    .map((article, index) => ({
      article,
      index,
      score: scoreArticle(article, context, index),
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index);

  return {
    articles: pickDiverseArticles(scored, limit, context).map((item) => item.article),
    candidateLimitReached: unique.length > limit,
    searchedCandidateCount: unique.length,
  };
}

interface RankingContext {
  compactQuery: string;
  keywords: string[];
  importantTerms: string[];
  leaveDurationQuestion: boolean;
  useRegulationDiversity: boolean;
}

interface ScoredArticle {
  article: ArticleRecord;
  index: number;
  score: number;
}

function dedupeArticles(articles: ArticleRecord[]): ArticleRecord[] {
  const seen = new Set<number>();
  const results: ArticleRecord[] = [];
  for (const article of articles) {
    if (seen.has(article.id)) continue;
    seen.add(article.id);
    results.push(article);
  }
  return results;
}

function buildRankingContext(query: string, keywords: readonly string[]): RankingContext {
  const compactQuery = compact(query);
  const leaveDurationQuestion =
    compactQuery.includes("휴학") && /(몇|기간|연한|학기|까지|가능|최대|통산|초과|넘지)/u.test(compactQuery);
  const importantTerms = leaveDurationQuestion
    ? ["일반휴학", "휴학기간", "휴학연한", "휴학", "통산", "학기", "초과", "넘지", "못한다"]
    : [];

  return {
    compactQuery,
    keywords: Array.from(new Set(keywords.map(compact).filter(Boolean))),
    importantTerms,
    leaveDurationQuestion,
    useRegulationDiversity: leaveDurationQuestion,
  };
}

function scoreArticle(article: ArticleRecord, context: RankingContext, index: number): number {
  const regulationName = compact(article.regulation_name);
  const title = compact(article.article_title ?? "");
  const body = compact(article.article_body);
  const all = `${regulationName} ${article.article_no} ${title} ${body}`;
  let score = Math.max(0, 200 - index) * 0.05;

  for (const keyword of context.keywords) {
    if (!keyword) continue;
    if (title.includes(keyword)) score += 14;
    if (regulationName.includes(keyword)) score += 5;
    if (body.includes(keyword)) score += 3;
    if (article.article_no === keyword) score += 30;
  }

  for (const term of context.importantTerms) {
    if (title.includes(term)) score += 20;
    if (body.includes(term)) score += 8;
  }

  if (context.leaveDurationQuestion) {
    if (/^(휴학|일반휴학|휴학기간|휴학연한)$/u.test(title)) score += 70;
    if (title.includes("휴학기간") || title.includes("휴학연한")) score += 55;
    if (title.includes("휴학의종류") || title.includes("휴학의분류")) score += 10;
    if (body.includes("일반휴학")) score += 25;
    if (body.includes("통산") && body.includes("학기")) score += 35;
    if (body.includes("휴학") && body.includes("학기")) score += 25;
    if (body.includes("초과할수없") || body.includes("넘지못")) score += 35;
    if (regulationName.includes("학사운영규정") || regulationName.includes("학칙")) score += 8;
    if (body.includes("창업휴학") && !body.includes("일반휴학")) score -= 16;
    if (all.includes("휴학") && !/(학기|통산|초과|넘지|연한|기간)/u.test(all)) score -= 18;
    if (/tutorial|교원업적평가|학생선수|관리비반환/iu.test(all)) score -= 45;
    if (title.includes("목적") || title.includes("용어의정의") || title.includes("제출서류")) score -= 25;
  }

  return score;
}

function pickDiverseArticles(scored: ScoredArticle[], limit: number, context: RankingContext): ScoredArticle[] {
  if (!context.useRegulationDiversity || limit <= 6) return scored.slice(0, limit);

  const selected: ScoredArticle[] = [];
  const perRegulationCount = new Map<string, number>();
  const softCap = 2;

  for (const item of scored) {
    const key = item.article.regulation_name;
    const current = perRegulationCount.get(key) ?? 0;
    if (current >= softCap) continue;
    selected.push(item);
    perRegulationCount.set(key, current + 1);
    if (selected.length >= limit) return selected;
  }

  const selectedIds = new Set(selected.map((item) => item.article.id));
  for (const item of scored) {
    if (selectedIds.has(item.article.id)) continue;
    selected.push(item);
    if (selected.length >= limit) return selected;
  }

  return selected;
}

function compact(value: string): string {
  return value.replace(/\s+/g, "").toLowerCase();
}
