import * as cheerio from "cheerio";
import { dialog, shell } from "electron";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { KOREA_POLICY_ORIGIN } from "../../shared/constants";
import type { DownloadRegulationFileRequest, DownloadResult, RegulationFile } from "../../shared/types";
import { AppError } from "../../shared/errors";
import { fetchBinaryWithSession, fetchWithSession } from "./fetch-with-session";

export async function listAttachmentFiles(seq: number | null, seqHistory: number | null): Promise<RegulationFile[]> {
  if (!seq || !seqHistory) return [];

  const url = `${KOREA_POLICY_ORIGIN}/lmxsrv/law/lawFullLawTitle.do?SEQ=${seq}&SEQ_HISTORY=${seqHistory}&showAttach=1`;
  const result = await fetchWithSession(url, {
    headers: {
      Accept: "text/html, */*; q=0.01",
      Referer: `${KOREA_POLICY_ORIGIN}/lmxsrv/main/main.do`,
      "X-Requested-With": "XMLHttpRequest",
    },
  });

  const $ = cheerio.load(result.text);
  const files: RegulationFile[] = [];

  $("a[href*=\"fileDown\"]").each((_, element) => {
    const href = $(element).attr("href") ?? "";
    const match = href.match(/fileDown\(\s*['"]?(\d+)['"]?\s*,\s*['"]?attach['"]?\s*\)/iu);
    if (!match) return;

    const fileSeq = Number(match[1]);
    if (!Number.isSafeInteger(fileSeq)) return;

    const row = $(element).closest("tr");
    const fileName =
      normalizeFileName(row.find(".lawtxt_Bg").first().text()) ??
      normalizeFileName(row.find("td").first().text()) ??
      `별첨-${fileSeq}.hwp`;

    files.push({
      fileSeq,
      fileType: "attach",
      fileName,
      label: fileName,
    });
  });

  return files;
}

export async function downloadRegulationFile(request: DownloadRegulationFileRequest): Promise<DownloadResult> {
  const fileSeq = Number(request.fileSeq);
  if (!Number.isSafeInteger(fileSeq) || fileSeq <= 0) {
    throw new AppError("NOT_FOUND", "다운로드할 파일 정보를 찾지 못했습니다.");
  }

  const body = new URLSearchParams({
    FILE_SEQ: String(fileSeq),
    FILE_TYPE: request.fileType,
  });

  const response = await fetchBinaryWithSession(`${KOREA_POLICY_ORIGIN}/lmxsrv/fileDown.do`, {
    method: "POST",
    headers: {
      Accept: "application/octet-stream, */*",
      "Content-Type": "application/x-www-form-urlencoded",
      Referer: `${KOREA_POLICY_ORIGIN}/lmxsrv/main/main.do`,
    },
    body: body.toString(),
  });

  const fileName =
    normalizeFileName(extractFileName(response.headers.get("content-disposition") ?? "")) ??
    normalizeFileName(request.fileName) ??
    fallbackFileName(request.fileType, fileSeq);

  const { canceled, filePath } = await dialog.showSaveDialog({
    title: "규정 파일 저장",
    defaultPath: path.join(os.homedir(), "Downloads", fileName),
  });

  if (canceled || !filePath) {
    throw new AppError("UNKNOWN_API_ERROR", "파일 저장이 취소되었습니다.");
  }

  fs.writeFileSync(filePath, Buffer.from(response.arrayBuffer));
  void shell.showItemInFolder(filePath);
  return { filePath, fileName: path.basename(filePath) };
}

function normalizeFileName(value?: string | null): string | null {
  const cleaned = value?.replace(/\s+/g, " ").trim();
  if (!cleaned) return null;
  return cleaned.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_");
}

function extractFileName(disposition: string): string | null {
  const utf8 = disposition.match(/filename\*=UTF-8''([^;]+)/iu);
  if (utf8) return decodeURIComponent(utf8[1]);

  const quoted = disposition.match(/filename="([^"]+)"/iu);
  if (quoted) return decodeHeaderFileName(quoted[1]);

  const plain = disposition.match(/filename=([^;]+)/iu);
  return plain ? decodeHeaderFileName(plain[1]) : null;
}

function decodeHeaderFileName(value: string): string {
  const trimmed = value.trim();
  try {
    return decodeURIComponent(trimmed);
  } catch {
    return trimmed;
  }
}

function fallbackFileName(fileType: DownloadRegulationFileRequest["fileType"], fileSeq: number): string {
  if (fileType === "oriPdf") return `regulation-${fileSeq}.pdf`;
  return `regulation-${fileSeq}.hwp`;
}
