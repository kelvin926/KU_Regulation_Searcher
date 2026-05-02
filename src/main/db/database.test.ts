import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { DatabaseService } from "./database";

let db: DatabaseService | null = null;
let tempDir: string | null = null;

afterEach(() => {
  db?.close();
  db = null;
  if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
  tempDir = null;
});

describe("DatabaseService", () => {
  it("stores articles and distinguishes 제76조 from 제76조의2", () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ku-reg-db-"));
    db = new DatabaseService(path.join(tempDir, "ku-policy.sqlite"));
    db.upsertRegulation(
      {
        regulationName: "테스트 규정",
        seqHistory: 100,
        sourceUrl: "https://example.test/lawFullContent.do?SEQ_HISTORY=100",
        fetchedAt: "2026-01-01T00:00:00.000Z",
      },
      {
        regulationName: "테스트 규정",
        articles: [
          { articleNo: "제76조", articleTitle: "휴학", articleBody: "휴학 본문", seqContents: 1 },
          { articleNo: "제76조의2", articleTitle: "복학", articleBody: "복학 본문", seqContents: 2 },
        ],
      },
      "<html>raw</html>",
    );

    expect(db.searchArticlePage({ articleNo: "제76조", limit: 10 })).toHaveLength(1);
    expect(db.searchArticlePage({ articleNo: "제76조의2", limit: 10 })).toHaveLength(1);
    expect(db.searchArticlesByLike(["복학"], 10)[0].article_no).toBe("제76조의2");
  });
});
