import type { ParsedArticleForDb, ParsedRegulationForDb } from "./database";

const ARTICLE_HEADING_REGEX = /(?:^|\n)\s*(제\s*\d+\s*조(?:\s*의\s*\d+)?)\s*(?:[（(]\s*([^)\n）]+)\s*[)）])?/gu;

export function parseCustomRegulationBody(regulationName: string, body: string): ParsedRegulationForDb {
  const normalizedBody = body.replace(/\r\n/g, "\n").trim();
  const matches = Array.from(normalizedBody.matchAll(ARTICLE_HEADING_REGEX));
  if (matches.length === 0) {
    return {
      regulationName,
      articles: [
        {
          articleNo: "전체",
          articleTitle: null,
          articleBody: normalizedBody,
          seqContents: 1,
        },
      ],
    };
  }

  const articles: ParsedArticleForDb[] = matches.map((match, index) => {
    const headingStart = match.index ?? 0;
    const bodyStart = headingStart + match[0].length;
    const nextStart = matches[index + 1]?.index ?? normalizedBody.length;
    const articleNo = normalizeCustomArticleNo(match[1]);
    const articleTitle = match[2]?.trim() || null;
    const articleBody = normalizedBody.slice(bodyStart, nextStart).trim() || `${articleNo}${articleTitle ? ` (${articleTitle})` : ""}`;

    return {
      articleNo,
      articleTitle,
      articleBody,
      seqContents: index + 1,
    };
  });

  return { regulationName, articles };
}

function normalizeCustomArticleNo(value: string): string {
  return value.replace(/\s+/g, "");
}
