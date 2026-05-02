import type Database from "better-sqlite3";
import { SCHEMA_SQL } from "./schema";

export function runMigrations(db: Database.Database): void {
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA_SQL);
  db.exec("INSERT INTO article_fts(article_fts) VALUES('rebuild');");
}
