import * as cheerio from "cheerio";
import type { ParsedArticleForDb, ParsedRegulationForDb } from "../db/database";

interface WorkingArticle {
  articleNo: string;
  articleTitle: string | null;
  lines: string[];
}

const ARTICLE_HEADING_RE = /^\s*(제\s*\d+\s*조(?:\s*의\s*\d+)?)\s*(.*)$/u;
const ARTICLE_NO_RE = /제\s*(\d+)\s*조(?:\s*의\s*(\d+))?/u;

export function normalizeArticleNo(value: string): string {
  const trimmed = value.replace(/\s+/g, "").trim();
  if (!trimmed) return trimmed;
  if (/^부칙/.test(trimmed)) return "부칙";

  const already = trimmed.match(/^제(\d+)조(?:의(\d+))?$/u);
  if (already) {
    return already[2] ? `제${Number(already[1])}조의${Number(already[2])}` : `제${Number(already[1])}조`;
  }

  const shorthand = trimmed.match(/^(\d+)(?:의(\d+))?$/u);
  if (shorthand) {
    return shorthand[2] ? `제${Number(shorthand[1])}조의${Number(shorthand[2])}` : `제${Number(shorthand[1])}조`;
  }

  const embedded = trimmed.match(/^제?(\d+)조?의(\d+)$/u);
  if (embedded) return `제${Number(embedded[1])}조의${Number(embedded[2])}`;

  return trimmed;
}

export function extractName(html: string): string | null {
  const $ = cheerio.load(html);
  const name = (
    $("div.lawname").first().text() ||
    $("span.lawname").first().text() ||
    $(".rule_subject .Stit").first().text() ||
    ""
  )
    .replace(/\s+/g, " ")
    .trim();
  return name || null;
}

export function parseRegulationHtml(html: string, fallbackName: string): ParsedRegulationForDb {
  const $ = cheerio.load(html);
  const regulationName = extractName(html) ?? fallbackName;
  const articles: WorkingArticle[] = [];
  let current: WorkingArticle | null = null;
  let inSupplementary = false;
  const supplementaryLines: string[] = [];

  const pushCurrent = () => {
    if (!current) return;
    const body = normalizeBody(current.lines);
    if (body) {
      articles.push({ ...current, lines: [body] });
    }
    current = null;
  };

  const startArticle = (headingText: string) => {
    pushCurrent();
    const heading = parseArticleHeading(headingText);
    if (!heading) return false;
    current = {
      articleNo: heading.articleNo,
      articleTitle: heading.articleTitle,
      lines: [],
    };
    inSupplementary = false;
    if (heading.remainder) current.lines.push(heading.remainder);
    return true;
  };

  $("div.chapter, div.section, div.buTitle, div.none, div.hang, div.ho, span, td, p").each((_, el) => {
    const $el = $(el);
    const tagName = ((el as { tagName?: string }).tagName ?? "").toLowerCase();
    const classes = $el.attr("class") ?? "";

    if (classes.includes("chapter") || classes.includes("section")) {
      return;
    }

    if (classes.includes("buTitle")) {
      pushCurrent();
      const text = cleanText($el.text());
      if (text) supplementaryLines.push(text);
      inSupplementary = true;
      return;
    }

    if (tagName === "span") {
      const ownText = cleanText($el.clone().children().remove().end().text());
      if (isLikelyArticleHeading(ownText)) {
        startArticle(ownText);
      }
      return;
    }

    if (tagName === "td") {
      const text = cleanText($el.text());
      if (isLikelyArticleHeading(text)) {
        startArticle(text);
      }
      return;
    }

    if (classes.includes("none") || classes.includes("hang") || classes.includes("ho") || tagName === "p") {
      const text = extractLineText($, $el);
      if (!text) return;

      if (isLikelyArticleHeading(text)) {
        startArticle(text);
        return;
      }

      const level = classes.includes("ho") ? 2 : classes.includes("hang") ? 1 : 0;
      const formatted = `${"  ".repeat(level)}${text}`;
      if (inSupplementary) {
        supplementaryLines.push(formatted);
      } else if (current) {
        current.lines.push(formatted);
      }
    }
  });

  pushCurrent();

  if (supplementaryLines.length > 0) {
    articles.push({
      articleNo: "부칙",
      articleTitle: "부칙",
      lines: [normalizeBody(supplementaryLines)],
    });
  }

  const parsed = dedupeArticles(articles).map((article, index) => ({
    articleNo: article.articleNo,
    articleTitle: article.articleTitle,
    articleBody: normalizeBody(article.lines),
    seqContents: index + 1,
  }));

  if (parsed.length > 0) {
    return { regulationName, articles: parsed };
  }

  const readableText = extractReadableText($);
  const textParsed = fallbackParseByText(readableText).map((article, index) => ({
    ...article,
    seqContents: index + 1,
  }));
  if (textParsed.length > 0) return { regulationName, articles: textParsed };

  return {
    regulationName,
    articles: fallbackParseWholeDocument($, readableText, fallbackName),
  };
}

function parseArticleHeading(text: string): {
  articleNo: string;
  articleTitle: string | null;
  remainder: string | null;
} | null {
  const match = text.match(ARTICLE_HEADING_RE);
  if (!match) return null;
  const articleNo = normalizeArticleNo(match[1]);
  let rest = cleanText(match[2] ?? "");
  let articleTitle: string | null = null;

  const titleMatch = rest.match(/^[({（]\s*([^)}）]+?)\s*[)}）]\s*(.*)$/u);
  if (titleMatch) {
    articleTitle = cleanText(titleMatch[1]) || null;
    rest = cleanText(titleMatch[2] ?? "");
  } else if (rest && rest.length <= 30 && !/[.。]/u.test(rest)) {
    articleTitle = rest;
    rest = "";
  }

  return {
    articleNo,
    articleTitle,
    remainder: rest || null,
  };
}

function isLikelyArticleHeading(text: string): boolean {
  if (!text || text.length > 140) return false;
  if (/^부칙/u.test(text)) return true;
  return ARTICLE_HEADING_RE.test(text);
}

function extractLineText($: cheerio.CheerioAPI, $el: cheerio.Cheerio<any>): string {
  const spanText = $el
    .find("span")
    .map((_, span) => cleanText($(span).text()))
    .get()
    .filter(Boolean)
    .join("");
  return cleanText(spanText || $el.text());
}

function cleanText(value: string): string {
  return value
    .replace(/\u00a0/g, " ")
    .replace(/[ \t\r\f\v]+/g, " ")
    .replace(/\n\s+/g, "\n")
    .trim();
}

function normalizeBody(lines: string[]): string {
  return lines
    .flatMap((line) => line.split(/\n+/u))
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0)
    .join("\n")
    .trim();
}

function dedupeArticles(articles: WorkingArticle[]): WorkingArticle[] {
  const byNo = new Map<string, WorkingArticle>();
  for (const article of articles) {
    const existing = byNo.get(article.articleNo);
    if (!existing) {
      byNo.set(article.articleNo, article);
      continue;
    }
    existing.lines.push(...article.lines);
    if (!existing.articleTitle && article.articleTitle) {
      existing.articleTitle = article.articleTitle;
    }
  }
  return Array.from(byNo.values()).filter((article) => normalizeBody(article.lines).length > 0);
}

function fallbackParseByText(text: string): ParsedArticleForDb[] {
  const normalized = text.replace(/\u00a0/g, " ").replace(/\r/g, "\n");
  const matches = Array.from(normalized.matchAll(/제\s*\d+\s*조(?:\s*의\s*\d+)?/gu));
  if (matches.length === 0) return [];

  return matches
    .map((match, index) => {
      const start = match.index ?? 0;
      const end = matches[index + 1]?.index ?? normalized.length;
      const chunk = cleanText(normalized.slice(start, end));
      const heading = parseArticleHeading(chunk.split(/\n/u)[0] ?? match[0]);
      const body = chunk.replace(ARTICLE_NO_RE, "").trim();
      return {
        articleNo: normalizeArticleNo(match[0]),
        articleTitle: heading?.articleTitle ?? null,
        articleBody: body || chunk,
        seqContents: index + 1,
      };
    })
    .filter((article) => article.articleBody.length > 0);
}

function fallbackParseWholeDocument(
  $: cheerio.CheerioAPI,
  readableText: string,
  fallbackName: string,
): ParsedArticleForDb[] {
  const text = cleanDocumentFallbackText(readableText);
  if (isFileOnlyPage($)) {
    return [
      {
        articleNo: "원문",
        articleTitle: "원문 파일",
        articleBody: [
          fallbackName,
          "이 규정은 규정관리시스템에서 HTML 본문을 제공하지 않고 HWP/PDF 원문 파일로 제공됩니다.",
          "로컬 검색 DB에는 이 규정의 원문 전문이 저장되지 않았습니다.",
          "규정 검색 화면의 HWP/PDF 다운로드 버튼으로 원문을 확인하세요.",
        ].join("\n"),
        seqContents: 1,
      },
    ];
  }

  if (!isMeaningfulFallbackText($, text)) return [];

  if (text.includes("주관부서의 요청에 따라 해당 규정은 규정집에 미등재")) {
    return [
      {
        articleNo: "안내",
        articleTitle: "미등재 안내",
        articleBody: text,
        seqContents: 1,
      },
    ];
  }

  if (text.includes("[별표/서식 파일]") || text.includes("별지서식다운로드")) {
    return [
      {
        articleNo: "별표/서식",
        articleTitle: "별표 및 서식",
        articleBody: text,
        seqContents: 1,
      },
    ];
  }

  return [
    {
      articleNo: "본문",
      articleTitle: null,
      articleBody: text,
      seqContents: 1,
    },
  ];
}

function extractReadableText($: cheerio.CheerioAPI): string {
  const $body = $("body").clone();
  $body
    .find(
      [
        "script",
        "style",
        "noscript",
        "iframe",
        "select",
        "button",
        "input",
        "img",
        ".btn_box",
        ".search_area",
        ".font_control",
        ".regcont_tab",
        "#Popup_lawtit",
      ].join(", "),
    )
    .remove();
  return cleanText($body.text());
}

function cleanDocumentFallbackText(text: string): string {
  return cleanText(text)
    .replace(/^연혁숨기기\s*연혁보기\s*/u, "")
    .replace(/\s*별지서식다운로드\s*/gu, "\n")
    .replace(/\n{3,}/gu, "\n\n")
    .trim();
}

function isNoDocPage($: cheerio.CheerioAPI): boolean {
  return $(".nodoc_topwrap, .root_info_nodoc").length > 0;
}

function isFileOnlyPage($: cheerio.CheerioAPI): boolean {
  if (isNoDocPage($)) return true;
  const hasOriginalDownload = $("a[href*=\"fileDown\"]")
    .toArray()
    .some((element) => /fileDown\(\s*['"]?\d+['"]?\s*,\s*['"]?ori(?:Pdf)?['"]?\s*\)/iu.test($(element).attr("href") ?? ""));
  const hasContentFrame = $("#lawDetailContent, iframe[name=\"lawFullContent\"]").length > 0;
  const hasTitle = $(".rule_subject .Stit").text().trim().length > 0;
  return hasOriginalDownload && hasContentFrame && hasTitle;
}

function isMeaningfulFallbackText($: cheerio.CheerioAPI, text: string): boolean {
  const compact = text.replace(/\s+/g, " ").trim();
  if (compact.length < 40) return false;
  if (compact.includes("처리 중 입니다") && compact.length < 140) return false;
  if ($("#lawDetailContent, #lawFullTitle").length > 0 && !/제\s*\d+\s*조/u.test(compact)) return false;
  if (!/[가-힣A-Za-z]/u.test(compact)) return false;
  return true;
}
