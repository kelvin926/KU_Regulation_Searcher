import type { DetectedQueryLanguage } from "../../shared/types";

export interface NormalizedSearchQueryResult {
  queries: string[];
}

const MAX_NORMALIZED_QUERY_COUNT = 6;

export function buildSearchQueryNormalizerPrompt({
  question,
  language,
}: {
  question: string;
  language: DetectedQueryLanguage;
}): string {
  return `You normalize non-Korean natural-language questions into Korean search queries for Korea University regulation articles.

Rules:
- Return JSON only: {"queries":["..."]}.
- Write every query in Korean.
- Do not answer the user's question.
- Preserve named departments, campuses, graduate schools, and regulation-specific terms when they appear.
- Prefer Korean KU regulation wording such as 휴학, 일반휴학, 군입대 휴학, 복학, 자퇴, 자퇴원, 장학금, 등록금, 영어강의, 외국어강의, 책임수업시간, 총학생회, 학생자치.
- For compound questions, produce several focused search variants instead of one broad sentence.
- Use at most ${MAX_NORMALIZED_QUERY_COUNT} queries.

Detected language: ${language}
Question:
${question}`;
}

export function parseNormalizedSearchQueries(text: string): NormalizedSearchQueryResult {
  const raw = extractJsonObject(text);
  if (!raw) return { queries: [] };

  try {
    const parsed = JSON.parse(raw) as unknown;
    const record = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
    const values = Array.isArray(record.queries) ? record.queries : [];
    const queries = unique(
      values
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.replace(/\s+/g, " ").trim())
        .filter((value) => value.length >= 2),
    ).slice(0, MAX_NORMALIZED_QUERY_COUNT);
    return { queries };
  } catch {
    return { queries: [] };
  }
}

function extractJsonObject(text: string): string | null {
  const fenced = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/u);
  if (fenced?.[1]) return fenced[1];
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  return text.slice(start, end + 1);
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}
