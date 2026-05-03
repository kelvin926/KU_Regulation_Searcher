import type BetterSqlite3 from "better-sqlite3";
import crypto from "node:crypto";
import type { RegulationRecord } from "../../../shared/types";
import type { ParsedRegulationForDb, RegulationMetaForDb } from "../database";

export class RegulationRepository {
  constructor(private readonly db: BetterSqlite3.Database) {}

  upsertRegulation(meta: RegulationMetaForDb, parsed: ParsedRegulationForDb, rawHtml: string): RegulationRecord {
    const rawHtmlHash = crypto.createHash("sha256").update(rawHtml).digest("hex");
    const regulationName = parsed.regulationName || meta.regulationName;
    const transaction = this.db.transaction(() => {
      this.db
        .prepare(
          `INSERT INTO regulations (
             regulation_name, regulation_code, department, seq, seq_history, source_url, fetched_at, raw_html_hash
           ) VALUES (
             @regulationName, @regulationCode, @department, @seq, @seqHistory, @sourceUrl, @fetchedAt, @rawHtmlHash
           )
           ON CONFLICT(seq_history) DO UPDATE SET
             regulation_name = excluded.regulation_name,
             regulation_code = excluded.regulation_code,
             department = excluded.department,
             seq = excluded.seq,
             source_url = excluded.source_url,
             fetched_at = excluded.fetched_at,
             raw_html_hash = excluded.raw_html_hash`,
        )
        .run({
          regulationName,
          regulationCode: meta.regulationCode ?? null,
          department: meta.department ?? null,
          seq: meta.seq ?? null,
          seqHistory: meta.seqHistory,
          sourceUrl: meta.sourceUrl,
          fetchedAt: meta.fetchedAt,
          rawHtmlHash,
        });

      const regulation = this.db
        .prepare("SELECT * FROM regulations WHERE seq_history = ?")
        .get(meta.seqHistory) as RegulationRecord;

      const articleStatement = this.db.prepare(
        `INSERT INTO articles (
           regulation_id, regulation_name, article_no, article_title, article_body,
           seq, seq_history, seq_contents, source_url, fetched_at
         ) VALUES (
           @regulationId, @regulationName, @articleNo, @articleTitle, @articleBody,
           @seq, @seqHistory, @seqContents, @sourceUrl, @fetchedAt
         )
         ON CONFLICT(regulation_name, article_no, seq_history) DO UPDATE SET
           regulation_id = excluded.regulation_id,
           article_title = excluded.article_title,
           article_body = excluded.article_body,
           seq = excluded.seq,
           seq_contents = excluded.seq_contents,
           source_url = excluded.source_url,
           fetched_at = excluded.fetched_at`,
      );

      for (const article of parsed.articles) {
        articleStatement.run({
          regulationId: regulation.id,
          regulationName,
          articleNo: article.articleNo,
          articleTitle: article.articleTitle,
          articleBody: article.articleBody,
          seq: meta.seq ?? null,
          seqHistory: meta.seqHistory,
          seqContents: article.seqContents,
          sourceUrl: meta.sourceUrl,
          fetchedAt: meta.fetchedAt,
        });
      }

      return regulation;
    });

    return transaction();
  }

  listRegulations(): RegulationRecord[] {
    return this.db.prepare("SELECT * FROM regulations ORDER BY regulation_name ASC").all() as RegulationRecord[];
  }

  listStoredSeqHistories(): number[] {
    const rows = this.db
      .prepare(
        `SELECT seq_history AS seqHistory
         FROM regulations
         WHERE seq_history IS NOT NULL
         ORDER BY seq_history ASC`,
      )
      .all() as { seqHistory: number }[];
    return rows.map((row) => row.seqHistory);
  }
}
