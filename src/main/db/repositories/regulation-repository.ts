import type BetterSqlite3 from "better-sqlite3";
import crypto from "node:crypto";
import type { CustomRegulationInput, CustomRegulationRecord, RegulationRecord } from "../../../shared/types";
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
             regulation_name, regulation_code, department, seq, seq_history, source_url, fetched_at, raw_html_hash,
             source_type, custom_scope, custom_note, updated_at
           ) VALUES (
             @regulationName, @regulationCode, @department, @seq, @seqHistory, @sourceUrl, @fetchedAt, @rawHtmlHash,
             'official', NULL, NULL, @fetchedAt
           )
           ON CONFLICT(seq_history) DO UPDATE SET
             regulation_name = excluded.regulation_name,
             regulation_code = excluded.regulation_code,
             department = excluded.department,
             seq = excluded.seq,
             source_url = excluded.source_url,
             fetched_at = excluded.fetched_at,
             raw_html_hash = excluded.raw_html_hash,
             source_type = 'official',
             custom_scope = NULL,
             custom_note = NULL,
             updated_at = excluded.updated_at`,
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
           seq, seq_history, seq_contents, source_url, fetched_at, source_type, custom_scope, custom_note
         ) VALUES (
           @regulationId, @regulationName, @articleNo, @articleTitle, @articleBody,
           @seq, @seqHistory, @seqContents, @sourceUrl, @fetchedAt, 'official', NULL, NULL
         )
         ON CONFLICT(regulation_name, article_no, seq_history) DO UPDATE SET
           regulation_id = excluded.regulation_id,
           article_title = excluded.article_title,
           article_body = excluded.article_body,
           seq = excluded.seq,
           seq_contents = excluded.seq_contents,
           source_url = excluded.source_url,
           fetched_at = excluded.fetched_at,
           source_type = 'official',
           custom_scope = NULL,
           custom_note = NULL`,
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

  createCustomRegulation(input: CustomRegulationInput, parsed: ParsedRegulationForDb): CustomRegulationRecord {
    const now = new Date().toISOString();
    const rawHtmlHash = crypto.createHash("sha256").update(input.body).digest("hex");
    const transaction = this.db.transaction(() => {
      const result = this.db
        .prepare(
          `INSERT INTO regulations (
             regulation_name, regulation_code, department, seq, seq_history, source_url, fetched_at, raw_html_hash,
             source_type, custom_scope, custom_campus, custom_note, updated_at
           ) VALUES (
             @regulationName, NULL, NULL, NULL, NULL, @sourceUrl, @now, @rawHtmlHash,
             'custom', @customScope, @customCampus, @customNote, @now
           )`,
        )
        .run({
          regulationName: input.regulationName.trim(),
          sourceUrl: `custom://pending/${Date.now()}`,
          now,
          rawHtmlHash,
          customScope: input.customScope,
          customCampus: input.customCampus ?? "auto",
          customNote: input.customNote?.trim() || null,
        });

      const id = Number(result.lastInsertRowid);
      const sourceUrl = `custom://regulation/${id}`;
      this.db.prepare("UPDATE regulations SET source_url = ? WHERE id = ?").run(sourceUrl, id);
      this.insertCustomArticles(id, input, parsed, sourceUrl, now);
      this.rebuildFts();
      return this.getCustomRegulationById(id);
    });

    return transaction();
  }

  updateCustomRegulation(
    id: number,
    input: CustomRegulationInput,
    parsed: ParsedRegulationForDb,
  ): CustomRegulationRecord {
    const now = new Date().toISOString();
    const rawHtmlHash = crypto.createHash("sha256").update(input.body).digest("hex");
    const transaction = this.db.transaction(() => {
      const sourceUrl = `custom://regulation/${id}`;
      const result = this.db
        .prepare(
          `UPDATE regulations
           SET regulation_name = @regulationName,
               source_url = @sourceUrl,
               raw_html_hash = @rawHtmlHash,
               custom_scope = @customScope,
               custom_campus = @customCampus,
               custom_note = @customNote,
               updated_at = @now
           WHERE id = @id AND source_type = 'custom'`,
        )
        .run({
          id,
          regulationName: input.regulationName.trim(),
          sourceUrl,
          rawHtmlHash,
          customScope: input.customScope,
          customCampus: input.customCampus ?? "auto",
          customNote: input.customNote?.trim() || null,
          now,
        });
      if (result.changes === 0) throw new Error("Custom regulation not found");
      this.db.prepare("DELETE FROM articles WHERE regulation_id = ?").run(id);
      this.insertCustomArticles(id, input, parsed, sourceUrl, now);
      this.rebuildFts();
      return this.getCustomRegulationById(id);
    });

    return transaction();
  }

  deleteCustomRegulation(id: number): boolean {
    const transaction = this.db.transaction(() => {
      const result = this.db.prepare("DELETE FROM regulations WHERE id = ? AND source_type = 'custom'").run(id);
      this.rebuildFts();
      return result.changes > 0;
    });
    return transaction();
  }

  listCustomRegulations(): CustomRegulationRecord[] {
    const rows = this.db
      .prepare(
        `SELECT r.id,
                r.regulation_name,
                r.source_url,
                r.custom_scope,
                r.custom_campus,
                r.custom_note,
                r.fetched_at,
                COALESCE(r.updated_at, r.fetched_at) AS updated_at,
                COUNT(a.id) AS article_count
         FROM regulations r
         LEFT JOIN articles a ON a.regulation_id = r.id
         WHERE r.source_type = 'custom'
         GROUP BY r.id
         ORDER BY COALESCE(r.updated_at, r.fetched_at) DESC, r.id DESC`,
      )
      .all() as CustomRegulationRecord[];
    return rows.map((row) => ({ ...row, body: this.buildCustomRegulationBody(row.id) }));
  }

  private insertCustomArticles(
    regulationId: number,
    input: CustomRegulationInput,
    parsed: ParsedRegulationForDb,
    sourceUrl: string,
    fetchedAt: string,
  ): void {
    const statement = this.db.prepare(
      `INSERT INTO articles (
         regulation_id, regulation_name, article_no, article_title, article_body,
         seq, seq_history, seq_contents, source_url, fetched_at, source_type, custom_scope, custom_campus, custom_note
       ) VALUES (
         @regulationId, @regulationName, @articleNo, @articleTitle, @articleBody,
         NULL, NULL, @seqContents, @sourceUrl, @fetchedAt, 'custom', @customScope, @customCampus, @customNote
       )`,
    );

    for (const article of parsed.articles) {
      statement.run({
        regulationId,
        regulationName: input.regulationName.trim(),
        articleNo: article.articleNo,
        articleTitle: article.articleTitle,
        articleBody: article.articleBody,
        seqContents: article.seqContents,
        sourceUrl,
        fetchedAt,
        customScope: input.customScope,
        customCampus: input.customCampus ?? "auto",
        customNote: input.customNote?.trim() || null,
      });
    }
  }

  private getCustomRegulationById(id: number): CustomRegulationRecord {
    const row = this.db
      .prepare(
        `SELECT r.id,
                r.regulation_name,
                r.source_url,
                r.custom_scope,
                r.custom_campus,
                r.custom_note,
                r.fetched_at,
                COALESCE(r.updated_at, r.fetched_at) AS updated_at,
                COUNT(a.id) AS article_count
         FROM regulations r
         LEFT JOIN articles a ON a.regulation_id = r.id
         WHERE r.id = ? AND r.source_type = 'custom'
         GROUP BY r.id`,
      )
      .get(id) as CustomRegulationRecord | undefined;
    if (!row) throw new Error("Custom regulation not found");
    return { ...row, body: this.buildCustomRegulationBody(row.id) };
  }

  private buildCustomRegulationBody(regulationId: number): string {
    const rows = this.db
      .prepare(
        `SELECT article_no, article_title, article_body
         FROM articles
         WHERE regulation_id = ?
         ORDER BY seq_contents ASC, id ASC`,
      )
      .all(regulationId) as Array<{ article_no: string; article_title: string | null; article_body: string }>;
    return rows
      .map((row) => {
        if (row.article_no === "전체") return row.article_body;
        const title = row.article_title ? ` (${row.article_title})` : "";
        return `${row.article_no}${title}\n${row.article_body}`;
      })
      .join("\n\n");
  }

  private rebuildFts(): void {
    this.db.exec("INSERT INTO article_fts(article_fts) VALUES('rebuild');");
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
