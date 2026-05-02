export const SCHEMA_SQL = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS regulations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  regulation_name TEXT NOT NULL,
  regulation_code TEXT,
  department TEXT,
  seq INTEGER,
  seq_history INTEGER,
  source_url TEXT NOT NULL,
  fetched_at TEXT NOT NULL,
  raw_html_hash TEXT NOT NULL,
  UNIQUE(seq_history)
);

CREATE TABLE IF NOT EXISTS articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  regulation_id INTEGER NOT NULL REFERENCES regulations(id) ON DELETE CASCADE,
  regulation_name TEXT NOT NULL,
  article_no TEXT NOT NULL,
  article_title TEXT,
  article_body TEXT NOT NULL,
  seq INTEGER,
  seq_history INTEGER,
  seq_contents INTEGER,
  source_url TEXT NOT NULL,
  fetched_at TEXT NOT NULL,
  UNIQUE(regulation_name, article_no, seq_history)
);

CREATE VIRTUAL TABLE IF NOT EXISTS article_fts USING fts5(
  regulation_name,
  article_no,
  article_title,
  article_body,
  content='articles',
  content_rowid='id',
  tokenize='unicode61'
);

CREATE TABLE IF NOT EXISTS sync_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  status TEXT NOT NULL,
  total_count INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  error_summary TEXT
);

CREATE TABLE IF NOT EXISTS sync_failures (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sync_log_id INTEGER REFERENCES sync_logs(id) ON DELETE CASCADE,
  regulation_name TEXT NOT NULL,
  seq_history INTEGER NOT NULL,
  error_code TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TRIGGER IF NOT EXISTS articles_ai AFTER INSERT ON articles BEGIN
  INSERT INTO article_fts(rowid, regulation_name, article_no, article_title, article_body)
  VALUES (new.id, new.regulation_name, new.article_no, COALESCE(new.article_title, ''), new.article_body);
END;

CREATE TRIGGER IF NOT EXISTS articles_ad AFTER DELETE ON articles BEGIN
  INSERT INTO article_fts(article_fts, rowid, regulation_name, article_no, article_title, article_body)
  VALUES ('delete', old.id, old.regulation_name, old.article_no, COALESCE(old.article_title, ''), old.article_body);
END;

CREATE TRIGGER IF NOT EXISTS articles_au AFTER UPDATE ON articles BEGIN
  INSERT INTO article_fts(article_fts, rowid, regulation_name, article_no, article_title, article_body)
  VALUES ('delete', old.id, old.regulation_name, old.article_no, COALESCE(old.article_title, ''), old.article_body);
  INSERT INTO article_fts(rowid, regulation_name, article_no, article_title, article_body)
  VALUES (new.id, new.regulation_name, new.article_no, COALESCE(new.article_title, ''), new.article_body);
END;
`;
