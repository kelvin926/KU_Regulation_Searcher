export interface ParsedSearchOperators {
  includeTerms: string[];
  anyTerms: string[];
  excludeTerms: string[];
  highlightTerms: string[];
  hasOperators: boolean;
}

export function parseSearchOperators(input: string): ParsedSearchOperators {
  const tokens = tokenizeSearch(input);
  const includeTerms: string[] = [];
  const anyTerms: string[] = [];
  const excludeTerms: string[] = [];
  let nextIsExclude = false;
  let nextIsAny = false;
  let hasOperators = false;

  for (const token of tokens) {
    const upper = token.toUpperCase();
    if (upper === "OR" || token === "|") {
      hasOperators = true;
      const previous = includeTerms.pop();
      if (previous) anyTerms.push(previous);
      nextIsAny = true;
      continue;
    }
    if (upper === "NOT") {
      hasOperators = true;
      nextIsExclude = true;
      continue;
    }

    const isMinus = token.startsWith("-") && token.length > 1;
    const term = cleanTerm(isMinus ? token.slice(1) : token);
    if (!term) continue;

    if (isMinus || nextIsExclude) {
      hasOperators = true;
      excludeTerms.push(term);
      nextIsExclude = false;
      nextIsAny = false;
      continue;
    }

    if (nextIsAny) {
      anyTerms.push(term);
      nextIsAny = false;
      continue;
    }

    includeTerms.push(term);
  }

  return {
    includeTerms,
    anyTerms,
    excludeTerms,
    highlightTerms: unique([...includeTerms, ...anyTerms]),
    hasOperators: hasOperators || /["|]/u.test(input),
  };
}

function tokenizeSearch(input: string): string[] {
  const tokens: string[] = [];
  for (const match of input.matchAll(/"([^"]+)"|(\S+)/gu)) {
    tokens.push(match[1] ?? match[2]);
  }
  return tokens;
}

function cleanTerm(value: string): string {
  return value.replace(/[()]/g, "").trim();
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}
