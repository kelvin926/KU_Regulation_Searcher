import type BetterSqlite3 from "better-sqlite3";
import type { ArticleRecord } from "../../../shared/types";
import { parseSearchOperators, type ParsedSearchOperators } from "../../search/search-operators";

export class SearchRepository {
  constructor(private readonly db: BetterSqlite3.Database) {}

  searchArticlesByFts(ftsQuery: string, limit: number): ArticleRecord[] {
    return this.db
      .prepare(
        `SELECT a.*, bm25(article_fts, 2.0, 3.0, 2.0, 1.0) AS rank
         FROM article_fts
         JOIN articles a ON a.id = article_fts.rowid
         WHERE article_fts MATCH ?
         ORDER BY rank ASC
         LIMIT ?`,
      )
      .all(ftsQuery, limit) as ArticleRecord[];
  }

  searchArticlesByLike(terms: string[], limit: number): ArticleRecord[] {
    if (terms.length === 0) return [];
    const clauses = terms
      .map(
        (_, index) =>
          `(regulation_name LIKE @term${index} OR article_no LIKE @term${index} OR article_title LIKE @term${index} OR article_body LIKE @term${index})`,
      )
      .join(" OR ");
    const params = Object.fromEntries(terms.map((term, index) => [`term${index}`, `%${term}%`]));
    return this.db
      .prepare(
        `SELECT *
         FROM articles
         WHERE ${clauses}
         ORDER BY fetched_at DESC, id ASC
         LIMIT @limit`,
      )
      .all({ ...params, limit }) as ArticleRecord[];
  }

  searchArticlesByRequiredTerms(requiredTerms: string[], optionalTerms: string[], limit: number): ArticleRecord[] {
    if (requiredTerms.length === 0) return [];
    const fields = ["regulation_name", "article_no", "article_title", "article_body"];
    const where: string[] = [];
    const scoreParts: string[] = [];
    const bind: Record<string, unknown> = { limit };

    requiredTerms.forEach((term, index) => {
      const key = `required${index}`;
      where.push(buildLikeAnyField(fields, `@${key}`));
      scoreParts.push(buildWeightedLikeScore(key, term, 16));
      bind[key] = `%${term}%`;
    });

    optionalTerms.forEach((term, index) => {
      const key = `optional${index}`;
      scoreParts.push(buildWeightedLikeScore(key, term, 4));
      bind[key] = `%${term}%`;
    });

    const score = scoreParts.length > 0 ? scoreParts.join(" + ") : "0";
    return this.db
      .prepare(
        `SELECT *, (${score}) AS rank
         FROM articles
         WHERE ${where.join(" AND ")}
         ORDER BY rank DESC, regulation_name ASC, seq_contents ASC, id ASC
         LIMIT @limit`,
      )
      .all(bind) as ArticleRecord[];
  }

  searchArticlesByRegulationNameTerms(terms: string[], limit: number): ArticleRecord[] {
    const filteredTerms = terms.filter(Boolean);
    if (filteredTerms.length === 0) return [];
    const bind: Record<string, unknown> = { limit };
    const where = filteredTerms
      .map((term, index) => {
        const key = `nameTerm${index}`;
        bind[key] = `%${term}%`;
        return `regulation_name LIKE @${key}`;
      })
      .join(" AND ");

    return this.db
      .prepare(
        `SELECT *
         FROM articles
         WHERE ${where}
         ORDER BY regulation_name ASC, seq_contents ASC, id ASC
         LIMIT @limit`,
      )
      .all(bind) as ArticleRecord[];
  }

  searchArticlesByCompactRegulationName(regulationName: string, limit: number): ArticleRecord[] {
    const compactName = compactForSqlLike(regulationName);
    if (compactName.length < 4) return [];
    const compactExpression = compactRegulationNameExpression();
    return this.db
      .prepare(
        `SELECT *,
                CASE
                  WHEN ${compactExpression} = @exactRegulationName THEN 3
                  WHEN ${compactExpression} LIKE @prefixRegulationName THEN 2
                  ELSE 1
                END AS rank
         FROM articles
         WHERE ${compactExpression} LIKE @regulationName
         ORDER BY rank DESC, regulation_name ASC, seq_contents ASC, id ASC
         LIMIT @limit`,
      )
      .all({
        exactRegulationName: compactName,
        prefixRegulationName: `${compactName}%`,
        regulationName: `%${compactName}%`,
        limit,
      }) as ArticleRecord[];
  }

  searchArticlesByBooleanQuery(query: string, limit: number): { articles: ArticleRecord[]; highlightTerms: string[] } {
    const parsed = parseSearchOperators(query);
    const { clause, bind } = buildBooleanSearchClause(parsed, [
      "regulation_name",
      "article_no",
      "article_title",
      "article_body",
    ]);
    if (!clause) return { articles: [], highlightTerms: [] };

    const articles = this.db
      .prepare(
        `SELECT *
         FROM articles
         WHERE ${clause}
         ORDER BY fetched_at DESC, id ASC
         LIMIT @limit`,
      )
      .all({ ...bind, limit }) as ArticleRecord[];

    return { articles, highlightTerms: parsed.highlightTerms };
  }

  searchArticlePage(params: {
    regulationName?: string;
    bodyQuery?: string;
    articleNo?: string;
    limit: number;
  }): ArticleRecord[] {
    const where: string[] = [];
    const bind: Record<string, unknown> = { limit: params.limit };
    if (params.regulationName?.trim()) {
      const parsed = parseSearchOperators(params.regulationName);
      const result = buildBooleanSearchClause(parsed, ["regulation_name"], "regulationName");
      if (result.clause) {
        where.push(result.clause);
        Object.assign(bind, result.bind);
      }
    }
    if (params.bodyQuery?.trim()) {
      const parsed = parseSearchOperators(params.bodyQuery);
      const result = buildBooleanSearchClause(parsed, ["article_title", "article_body"], "bodyQuery");
      if (result.clause) {
        where.push(result.clause);
        Object.assign(bind, result.bind);
      }
    }
    if (params.articleNo?.trim()) {
      where.push("article_no = @articleNo");
      bind.articleNo = params.articleNo.trim();
    }
    const clause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
    return this.db
      .prepare(
        `SELECT *
         FROM articles
         ${clause}
         ORDER BY regulation_name ASC, seq_contents ASC, id ASC
         LIMIT @limit`,
      )
      .all(bind) as ArticleRecord[];
  }
}

function buildBooleanSearchClause(
  parsed: ParsedSearchOperators,
  fields: string[],
  prefix = "query",
): { clause: string; bind: Record<string, string> } {
  const clauses: string[] = [];
  const bind: Record<string, string> = {};
  let index = 0;

  for (const term of parsed.includeTerms) {
    const key = `${prefix}Include${index}`;
    clauses.push(buildLikeAnyField(fields, `@${key}`));
    bind[key] = `%${term}%`;
    index += 1;
  }

  if (parsed.anyTerms.length > 0) {
    const anyClauses: string[] = [];
    for (const term of parsed.anyTerms) {
      const key = `${prefix}Any${index}`;
      anyClauses.push(buildLikeAnyField(fields, `@${key}`));
      bind[key] = `%${term}%`;
      index += 1;
    }
    clauses.push(`(${anyClauses.join(" OR ")})`);
  }

  for (const term of parsed.excludeTerms) {
    const key = `${prefix}Exclude${index}`;
    clauses.push(`NOT ${buildLikeAnyField(fields, `@${key}`)}`);
    bind[key] = `%${term}%`;
    index += 1;
  }

  return { clause: clauses.join(" AND "), bind };
}

function buildLikeAnyField(fields: string[], bindName: string): string {
  return `(${fields.map((field) => `${field} LIKE ${bindName}`).join(" OR ")})`;
}

function buildWeightedLikeScore(bindKey: string, rawTerm: string, baseWeight: number): string {
  const exactWeight = rawTerm.length >= 4 ? baseWeight * 2 : baseWeight;
  return [
    `(CASE WHEN regulation_name LIKE @${bindKey} THEN ${exactWeight * 4} ELSE 0 END)`,
    `(CASE WHEN article_title LIKE @${bindKey} THEN ${exactWeight * 5} ELSE 0 END)`,
    `(CASE WHEN article_no LIKE @${bindKey} THEN ${exactWeight * 3} ELSE 0 END)`,
    `(CASE WHEN article_body LIKE @${bindKey} THEN ${baseWeight} ELSE 0 END)`,
  ].join(" + ");
}

function compactForSqlLike(value: string): string {
  return value.replace(/[\s　.,;:()[\]{}<>〈〉《》「」『』·ㆍ\-_/\\]/gu, "").toLowerCase();
}

function compactRegulationNameExpression(): string {
  return [" ", "　", ".", ",", ";", ":", "(", ")", "[", "]", "{", "}", "<", ">", "〈", "〉", "《", "》", "「", "」", "『", "』", "·", "ㆍ", "-", "_", "/", "\\"].reduce(
    (expression, character) => `replace(${expression}, '${character.replace(/'/g, "''")}', '')`,
    "lower(regulation_name)",
  );
}
