import type Database from "better-sqlite3";
import { SCHEMA_SQL } from "./schema";

export function runMigrations(db: Database.Database): void {
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA_SQL);
  ensureColumn(db, "regulations", "source_type", "TEXT NOT NULL DEFAULT 'official'");
  ensureColumn(db, "regulations", "custom_scope", "TEXT");
  ensureColumn(db, "regulations", "custom_campus", "TEXT");
  ensureColumn(db, "regulations", "custom_note", "TEXT");
  ensureColumn(db, "regulations", "updated_at", "TEXT");
  ensureColumn(db, "articles", "source_type", "TEXT NOT NULL DEFAULT 'official'");
  ensureColumn(db, "articles", "custom_scope", "TEXT");
  ensureColumn(db, "articles", "custom_campus", "TEXT");
  ensureColumn(db, "articles", "custom_note", "TEXT");
  migrateCustomCampusScopeSplit(db);
  db.exec("INSERT INTO article_fts(article_fts) VALUES('rebuild');");
}

function ensureColumn(db: Database.Database, table: string, column: string, definition: string): void {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (rows.some((row) => row.name === column)) return;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

function migrateCustomCampusScopeSplit(db: Database.Database): void {
  db.exec(`
    UPDATE regulations
       SET custom_campus = custom_scope,
           custom_scope = 'other'
     WHERE source_type = 'custom'
       AND custom_scope IN ('seoul', 'sejong')
       AND (custom_campus IS NULL OR custom_campus = '' OR custom_campus = 'auto');

    UPDATE articles
       SET custom_campus = custom_scope,
           custom_scope = 'other'
     WHERE source_type = 'custom'
       AND custom_scope IN ('seoul', 'sejong')
       AND (custom_campus IS NULL OR custom_campus = '' OR custom_campus = 'auto');
  `);
}
