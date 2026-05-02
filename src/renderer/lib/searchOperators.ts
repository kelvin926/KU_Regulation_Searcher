export function extractSearchTerms(...queries: Array<string | undefined>): string[] {
  const terms = new Set<string>();
  for (const query of queries) {
    for (const term of tokenizeSearch(query ?? "")) {
      const cleaned = cleanTerm(term);
      if (cleaned && !["AND", "OR", "NOT"].includes(cleaned.toUpperCase())) terms.add(cleaned);
    }
  }
  return Array.from(terms).slice(0, 24);
}

export function matchesSearchQuery(text: string, query: string): boolean {
  const parsed = parseQuery(query);
  if (parsed.include.length === 0 && parsed.any.length === 0 && parsed.exclude.length === 0) return true;
  const haystack = text.toLowerCase();

  if (parsed.include.some((term) => !haystack.includes(term.toLowerCase()))) return false;
  if (parsed.any.length > 0 && parsed.any.every((term) => !haystack.includes(term.toLowerCase()))) return false;
  if (parsed.exclude.some((term) => haystack.includes(term.toLowerCase()))) return false;
  return true;
}

function parseQuery(query: string): { include: string[]; any: string[]; exclude: string[] } {
  const include: string[] = [];
  const any: string[] = [];
  const exclude: string[] = [];
  let nextIsExclude = false;
  let nextIsAny = false;

  for (const token of tokenizeSearch(query)) {
    const upper = token.toUpperCase();
    if (upper === "OR" || token === "|") {
      const previous = include.pop();
      if (previous) any.push(previous);
      nextIsAny = true;
      continue;
    }
    if (upper === "NOT") {
      nextIsExclude = true;
      continue;
    }

    const isMinus = token.startsWith("-") && token.length > 1;
    const term = cleanTerm(isMinus ? token.slice(1) : token);
    if (!term) continue;

    if (isMinus || nextIsExclude) {
      exclude.push(term);
      nextIsExclude = false;
      nextIsAny = false;
    } else if (nextIsAny) {
      any.push(term);
      nextIsAny = false;
    } else {
      include.push(term);
    }
  }

  return { include, any, exclude };
}

function tokenizeSearch(input: string): string[] {
  return Array.from(input.matchAll(/"([^"]+)"|(\S+)/gu), (match) => match[1] ?? match[2]);
}

function cleanTerm(value: string): string {
  return value.replace(/^[-+]/u, "").replace(/[()]/g, "").trim();
}
