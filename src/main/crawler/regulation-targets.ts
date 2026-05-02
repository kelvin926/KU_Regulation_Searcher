import * as cheerio from "cheerio";
import { KOREA_POLICY_CONTENT_URL, KOREA_POLICY_ORIGIN } from "../../shared/constants";
import type { RegulationTarget } from "../../shared/types";
import { fetchWithSession } from "./fetch-with-session";

const CURRENT_REGULATION_GROUP = 1;
const CURRENT_REGULATION_ROOT = 1;

export const REGULATION_TARGET_LIST_URLS = [
  `${KOREA_POLICY_ORIGIN}/lmxsrv/law/lawTreeNodes.do?LAWGROUP=${CURRENT_REGULATION_GROUP}&PARENT=${CURRENT_REGULATION_ROOT}&TREEDEPTH=1`,
] as const;

interface TargetPointer {
  seq?: number;
  seqHistory: number;
}

interface ParseTargetsOptions {
  category?: string;
  categoryPath?: string[];
  sortPathPrefix?: number[];
  orderOffset?: number;
}

interface TreeNode {
  folder?: string | number;
  hseq?: string | number;
  key?: string | number;
  lawType?: string | number | null;
  lawgroup?: string | number;
  pkey?: string | number;
  sortnum?: string | number;
  title?: string;
  treedepth?: string | number;
}

export async function fetchRegulationTargetsFromSite(): Promise<RegulationTarget[]> {
  const targets = new Map<number, RegulationTarget>();
  const visitedFolders = new Set<string>();

  await collectTargetsFromTree({
    lawGroup: CURRENT_REGULATION_GROUP,
    parent: CURRENT_REGULATION_ROOT,
    treeDepth: 1,
    category: "규정",
    categoryPath: ["규정"],
    sortPathPrefix: [],
    targets,
    visitedFolders,
  });

  return sortTargets(Array.from(targets.values()));
}

export function parseRegulationTargetsFromHtml(
  html: string,
  categoryOrOptions?: string | ParseTargetsOptions,
): RegulationTarget[] {
  const options = normalizeParseOptions(categoryOrOptions);
  const $ = cheerio.load(html);
  const targets = new Map<number, RegulationTarget>();
  let order = options.orderOffset ?? 0;

  $("[href], [onclick]").each((_, element) => {
    const $element = $(element);
    const raw = [$element.attr("href") ?? "", $element.attr("onclick") ?? ""].join(" ");
    const pointers = extractPointers(raw);
    if (pointers.length === 0) return;

    const name = extractTargetName($, $element);
    if (!name) return;

    for (const pointer of pointers) {
      if (!targets.has(pointer.seqHistory)) {
        targets.set(pointer.seqHistory, toTarget(name, pointer, options, order));
      }
    }
    order += 1;
  });

  for (const pointer of extractPointers(html)) {
    if (!targets.has(pointer.seqHistory)) {
      const name = extractNameNearPointer(html, pointer);
      if (name) {
        targets.set(pointer.seqHistory, toTarget(name, pointer, options, order));
        order += 1;
      }
    }
  }

  return sortTargets(Array.from(targets.values()));
}

async function collectTargetsFromTree({
  lawGroup,
  parent,
  treeDepth,
  category,
  categoryPath,
  sortPathPrefix,
  targets,
  visitedFolders,
}: {
  lawGroup: number;
  parent: number;
  treeDepth: number;
  category: string;
  categoryPath: string[];
  sortPathPrefix: number[];
  targets: Map<number, RegulationTarget>;
  visitedFolders: Set<string>;
}): Promise<void> {
  const nodes = await fetchTreeNodes(lawGroup, parent, treeDepth);

  for (const node of nodes) {
    const key = toNumber(node.key);
    if (!key) continue;

    const name = normalizeNodeTitle(node.title);
    if (isFolderNode(node)) {
      const folderKey = `${lawGroup}:${key}`;
      if (visitedFolders.has(folderKey)) continue;
      visitedFolders.add(folderKey);

      const nextCategory = name ? `${category} / ${name}` : category;
      const nodeSort = toNumber(node.sortnum) ?? key;
      const nextCategoryPath = name ? [...categoryPath, name] : categoryPath;
      const nextSortPath = [...sortPathPrefix, nodeSort];
      await addTargetsFromFolderList(key, lawGroup, nextCategory, nextCategoryPath, nextSortPath, targets);
      await collectTargetsFromTree({
        lawGroup,
        parent: key,
        treeDepth: toNumber(node.treedepth) ? Number(node.treedepth) + 1 : treeDepth + 1,
        category: nextCategory,
        categoryPath: nextCategoryPath,
        sortPathPrefix: nextSortPath,
        targets,
        visitedFolders,
      });
      continue;
    }

    const seqHistory = toNumber(node.hseq);
    if (name && seqHistory) {
      addTarget(targets, {
        regulationName: name,
        seq: key,
        seqHistory,
        sourceUrl: `${KOREA_POLICY_CONTENT_URL}?SEQ=${key}&SEQ_HISTORY=${seqHistory}`,
        category,
        categoryPath,
        sortPath: [...sortPathPrefix, toNumber(node.sortnum) ?? key],
      });
    }
  }
}

async function addTargetsFromFolderList(
  folderSeq: number,
  lawGroup: number,
  category: string,
  categoryPath: string[],
  sortPathPrefix: number[],
  targets: Map<number, RegulationTarget>,
): Promise<void> {
  for (let page = 1; page <= 100; page += 1) {
    const beforeCount = targets.size;
    const url = `${KOREA_POLICY_ORIGIN}/lmxsrv/law/lawListManager_areaC.do?SEQ=${folderSeq}&PAGE_MODE=1&LAWGROUP=${lawGroup}&TREE_MODE=0&PAGE=${page}`;
    const result = await fetchWithSession(url, {
      headers: {
        Accept: "text/html, */*; q=0.01",
        Referer: `${KOREA_POLICY_ORIGIN}/lmxsrv/main/main.do`,
        "X-Requested-With": "XMLHttpRequest",
      },
    });

    const parsedTargets = parseRegulationTargetsFromHtml(result.text, {
      category,
      categoryPath,
      sortPathPrefix,
      orderOffset: (page - 1) * 1000,
    });
    if (parsedTargets.length === 0) break;

    for (const target of parsedTargets) {
      addTarget(targets, target);
    }

    if (targets.size === beforeCount) break;
  }
}

async function fetchTreeNodes(lawGroup: number, parent: number, treeDepth: number): Promise<TreeNode[]> {
  const url = `${KOREA_POLICY_ORIGIN}/lmxsrv/law/lawTreeNodes.do?LAWGROUP=${lawGroup}&PARENT=${parent}&TREEDEPTH=${treeDepth}`;
  const result = await fetchWithSession(url, {
    headers: {
      Accept: "application/json, text/javascript, */*; q=0.01",
      Referer: `${KOREA_POLICY_ORIGIN}/lmxsrv/main/main.do`,
      "X-Requested-With": "XMLHttpRequest",
    },
  });

  const parsed = JSON.parse(result.text) as unknown;
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter((node): node is TreeNode => Boolean(node) && typeof node === "object")
    .sort((a, b) => (toNumber(a.sortnum) ?? 0) - (toNumber(b.sortnum) ?? 0));
}

function extractPointers(value: string): TargetPointer[] {
  const pointers: TargetPointer[] = [];
  const seen = new Set<string>();

  const add = (seqHistory: number, seq?: number) => {
    if (!Number.isSafeInteger(seqHistory) || seqHistory <= 0) return;
    const key = `${seq ?? ""}:${seqHistory}`;
    if (seen.has(key)) return;
    seen.add(key);
    pointers.push({ seq, seqHistory });
  };

  for (const match of value.matchAll(/onClickLawListItem\s*\(\s*['"]?\d+['"]?\s*,\s*['"]?(\d+)['"]?\s*,\s*['"]?(\d+)['"]?/giu)) {
    add(Number(match[2]), Number(match[1]));
  }

  for (const match of value.matchAll(/SEQ=(\d+)[^"'<>)]*?SEQ_HISTORY=(\d+)/giu)) {
    add(Number(match[2]), Number(match[1]));
  }

  for (const match of value.matchAll(/SEQ_HISTORY=(\d+)[^"'<>)]*?SEQ=(\d+)/giu)) {
    add(Number(match[1]), Number(match[2]));
  }

  for (const match of value.matchAll(/SEQ_HISTORY=(\d+)/giu)) {
    add(Number(match[1]));
  }

  for (const match of value.matchAll(/(?:lawFull|lawSearchFullView|goLinkLaw\w*)\s*\([^)]*?['"]?(\d+)['"]?\s*,\s*['"]?(\d+)['"]?/giu)) {
    add(Number(match[2]), Number(match[1]));
  }

  return pointers;
}

function extractTargetName($: cheerio.CheerioAPI, $element: cheerio.Cheerio<any>): string | null {
  const candidates = [
    $element,
    $element.closest("a"),
    $element.closest("li"),
    $element.closest("tr"),
    $element.closest("div"),
  ];

  for (const candidate of candidates) {
    if (candidate.length === 0) continue;
    const directText = candidate.clone().children().remove().end().text();
    const name = normalizeTargetName(directText) ?? normalizeTargetName(candidate.text());
    if (name) return name;
  }

  return null;
}

function extractNameNearPointer(html: string, pointer: TargetPointer): string | null {
  const marker = `SEQ_HISTORY=${pointer.seqHistory}`;
  const index = html.indexOf(marker);
  if (index < 0) return null;

  const start = Math.max(0, index - 260);
  const end = Math.min(html.length, index + 260);
  const fragment = html.slice(start, end);
  const $ = cheerio.load(fragment);
  return normalizeTargetName($.text());
}

function normalizeTargetName(value: string): string | null {
  const cleaned = value
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .replace(/SEQ_HISTORY\s*\d+/giu, " ")
    .replace(/SEQ\s*\d+/giu, " ")
    .replace(/내용보기|내용숨기기|개정정보|신구대비|인쇄|보기|전체보기/gu, " ")
    .trim();

  if (cleaned.length < 2 || cleaned.length > 120) return null;
  if (/^(javascript|http|https|#|전체|닫기)$/iu.test(cleaned)) return null;
  if (!/[가-힣A-Za-z]/u.test(cleaned)) return null;

  return cleaned;
}

function normalizeNodeTitle(value: string | undefined): string | null {
  if (!value) return null;
  return value.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim() || null;
}

function toTarget(name: string, pointer: TargetPointer, options: ParseTargetsOptions, order: number): RegulationTarget {
  const query = pointer.seq
    ? `SEQ=${pointer.seq}&SEQ_HISTORY=${pointer.seqHistory}`
    : `SEQ_HISTORY=${pointer.seqHistory}`;

  return {
    regulationName: name,
    seq: pointer.seq,
    seqHistory: pointer.seqHistory,
    sourceUrl: `${KOREA_POLICY_CONTENT_URL}?${query}`,
    category: options.category,
    categoryPath: options.categoryPath,
    sortPath: [...(options.sortPathPrefix ?? []), order],
  };
}

function addTarget(targets: Map<number, RegulationTarget>, target: RegulationTarget): void {
  if (!targets.has(target.seqHistory)) {
    targets.set(target.seqHistory, target);
  }
}

function isFolderNode(node: TreeNode): boolean {
  return String(node.folder ?? "") === "1";
}

function toNumber(value: unknown): number | null {
  const numberValue = Number(value);
  return Number.isSafeInteger(numberValue) && numberValue > 0 ? numberValue : null;
}

function sortTargets(targets: RegulationTarget[]): RegulationTarget[] {
  return [...targets].sort((a, b) => {
    const bySortPath = compareNumberPath(a.sortPath, b.sortPath);
    if (bySortPath !== 0) return bySortPath;
    const byCategory = (a.category ?? "").localeCompare(b.category ?? "", "ko-KR");
    if (byCategory !== 0) return byCategory;
    return a.regulationName.localeCompare(b.regulationName, "ko-KR");
  });
}

function normalizeParseOptions(categoryOrOptions?: string | ParseTargetsOptions): ParseTargetsOptions {
  if (typeof categoryOrOptions === "string") {
    return {
      category: categoryOrOptions,
      categoryPath: splitCategoryPath(categoryOrOptions),
      sortPathPrefix: [],
      orderOffset: 0,
    };
  }

  const category = categoryOrOptions?.category;
  return {
    category,
    categoryPath: categoryOrOptions?.categoryPath ?? splitCategoryPath(category),
    sortPathPrefix: categoryOrOptions?.sortPathPrefix ?? [],
    orderOffset: categoryOrOptions?.orderOffset ?? 0,
  };
}

function splitCategoryPath(category?: string): string[] | undefined {
  return category
    ?.split("/")
    .map((part) => part.trim())
    .filter(Boolean);
}

function compareNumberPath(a?: readonly number[], b?: readonly number[]): number {
  if (!a?.length && !b?.length) return 0;
  if (!a?.length) return 1;
  if (!b?.length) return -1;
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    const left = a[index] ?? -1;
    const right = b[index] ?? -1;
    if (left !== right) return left - right;
  }
  return 0;
}
