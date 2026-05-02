export function HighlightedText({ text, terms = [] }: { text: string; terms?: string[] }) {
  const normalizedTerms = terms
    .map((term) => term.trim())
    .filter((term) => term.length > 0)
    .sort((a, b) => b.length - a.length);

  if (normalizedTerms.length === 0) return <>{text}</>;

  const pattern = new RegExp(`(${normalizedTerms.map(escapeRegExp).join("|")})`, "giu");
  const parts = text.split(pattern);

  return (
    <>
      {parts.map((part, index) =>
        normalizedTerms.some((term) => term.localeCompare(part, undefined, { sensitivity: "accent" }) === 0) ? (
          <mark key={`${part}-${index}`} className="search-highlight">
            {part}
          </mark>
        ) : (
          <span key={`${part}-${index}`}>{part}</span>
        ),
      )}
    </>
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
