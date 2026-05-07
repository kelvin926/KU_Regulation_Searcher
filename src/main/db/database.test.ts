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

  it("clears previous sync failures without deleting stored articles", () => {
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
        articles: [{ articleNo: "제1조", articleTitle: "목적", articleBody: "본문", seqContents: 1 }],
      },
      "<html>raw</html>",
    );
    const syncLogId = db.beginSync(1);
    db.finishSync(syncLogId, "failed", 0, 1, [
      {
        regulationName: "실패 규정",
        seqHistory: 200,
        errorCode: "SYNC_FAILED",
        message: "실패",
      },
    ]);

    expect(db.listLatestFailures()).toHaveLength(1);
    db.clearSyncFailures();
    expect(db.listLatestFailures()).toHaveLength(0);
    expect(db.getStats().articleCount).toBe(1);
  });

  it("stores, updates, deletes custom regulations and refreshes search rows", () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ku-reg-db-"));
    db = new DatabaseService(path.join(tempDir, "ku-policy.sqlite"));

    const created = db.createCustomRegulation({
      regulationName: "미래모빌리티학과 운영 내규",
      customCampus: "sejong",
      customScope: "undergraduate",
      customNote: "학과 공지",
      body: "제1조(군휴학 전환)\n군휴학 사유가 소멸된 학생은 일반휴학 전환을 신청한다.",
    });

    expect(created.article_count).toBe(1);
    expect(created.body).toContain("군휴학 전환");
    expect(db.searchArticlesByLike(["군휴학", "전환"], 10)[0]).toMatchObject({
      regulation_name: "미래모빌리티학과 운영 내규",
      source_type: "custom",
      custom_scope: "undergraduate",
      custom_campus: "sejong",
    });

    const updated = db.updateCustomRegulation(created.id, {
      regulationName: "미래모빌리티학과 학과 내규",
      customCampus: "sejong",
      customScope: "undergraduate",
      customNote: "수정본",
      body: "제1조(일반휴학 전환)\n입영 취소 시 일반휴학 전환 신청서를 제출한다.",
    });

    expect(updated.regulation_name).toBe("미래모빌리티학과 학과 내규");
    expect(db.searchArticlesByLike(["입영", "취소"], 10)[0].regulation_name).toBe("미래모빌리티학과 학과 내규");

    expect(db.deleteCustomRegulation(created.id)).toBe(true);
    expect(db.searchArticlesByLike(["입영", "취소"], 10)).toHaveLength(0);
  });
});
