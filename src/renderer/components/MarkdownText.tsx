import type { ReactNode } from "react";

type MarkdownBlock =
  | { type: "paragraph"; lines: string[] }
  | { type: "ordered-list" | "unordered-list"; items: string[] };

export function MarkdownText({ text, className }: { text: string; className?: string }) {
  const blocks = parseMarkdownBlocks(text);

  return (
    <div className={className}>
      {blocks.map((block, index) => {
        if (block.type === "paragraph") {
          return <p key={index}>{renderParagraph(block.lines, index)}</p>;
        }

        const ListTag = block.type === "ordered-list" ? "ol" : "ul";
        return (
          <ListTag key={index}>
            {block.items.map((item, itemIndex) => (
              <li key={itemIndex}>{renderParagraph(item.split("\n"), itemIndex)}</li>
            ))}
          </ListTag>
        );
      })}
    </div>
  );
}

export function parseMarkdownBlocks(text: string): MarkdownBlock[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: MarkdownBlock[] = [];
  let paragraphLines: string[] = [];
  let listType: "ordered-list" | "unordered-list" | null = null;
  let listItems: string[] = [];

  const flushParagraph = () => {
    if (paragraphLines.length === 0) return;
    blocks.push({ type: "paragraph", lines: paragraphLines });
    paragraphLines = [];
  };

  const flushList = () => {
    if (!listType || listItems.length === 0) return;
    blocks.push({ type: listType, items: listItems });
    listType = null;
    listItems = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (!line.trim()) {
      flushParagraph();
      flushList();
      continue;
    }

    const orderedListMatch = line.match(/^\s*\d+[.)]\s+(.+)$/);
    const unorderedListMatch = line.match(/^\s*[-*]\s+(.+)$/);

    if (orderedListMatch || unorderedListMatch) {
      const nextListType = orderedListMatch ? "ordered-list" : "unordered-list";
      const itemText = orderedListMatch?.[1] ?? unorderedListMatch?.[1] ?? "";
      flushParagraph();
      if (listType && listType !== nextListType) {
        flushList();
      }
      listType = nextListType;
      listItems.push(itemText);
      continue;
    }

    const continuationMatch = line.match(/^\s{2,}(.+)$/);
    if (continuationMatch && listType && listItems.length > 0) {
      listItems[listItems.length - 1] = `${listItems[listItems.length - 1]}\n${continuationMatch[1]}`;
      continue;
    }

    flushList();
    paragraphLines.push(line);
  }

  flushParagraph();
  flushList();
  return blocks;
}

function renderParagraph(lines: string[], keyPrefix: number): ReactNode[] {
  return lines.flatMap((line, index) => {
    const nodes = renderInlineMarkdown(line, `${keyPrefix}-${index}`);
    if (index === lines.length - 1) return nodes;
    return [...nodes, <br key={`${keyPrefix}-${index}-br`} />];
  });
}

function renderInlineMarkdown(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let index = 0;
  let key = 0;

  while (index < text.length) {
    const codeStart = text.indexOf("`", index);
    const boldStart = text.indexOf("**", index);
    const nextMarker = getNextMarker(codeStart, boldStart);

    if (!nextMarker) {
      nodes.push(text.slice(index));
      break;
    }

    if (nextMarker.position > index) {
      nodes.push(text.slice(index, nextMarker.position));
    }

    if (nextMarker.type === "code") {
      const codeEnd = text.indexOf("`", nextMarker.position + 1);
      if (codeEnd === -1) {
        nodes.push(text.slice(nextMarker.position));
        break;
      }
      nodes.push(<code key={`${keyPrefix}-code-${key++}`}>{text.slice(nextMarker.position + 1, codeEnd)}</code>);
      index = codeEnd + 1;
      continue;
    }

    const boldEnd = text.indexOf("**", nextMarker.position + 2);
    if (boldEnd === -1) {
      nodes.push(text.slice(nextMarker.position));
      break;
    }

    const boldText = text.slice(nextMarker.position + 2, boldEnd);
    if (!boldText.trim()) {
      nodes.push("**");
      index = nextMarker.position + 2;
      continue;
    }

    nodes.push(
      <strong key={`${keyPrefix}-strong-${key++}`}>{renderInlineMarkdown(boldText, `${keyPrefix}-strong-${key}`)}</strong>,
    );
    index = boldEnd + 2;
  }

  return nodes;
}

function getNextMarker(codeStart: number, boldStart: number): { type: "code" | "bold"; position: number } | null {
  if (codeStart === -1 && boldStart === -1) return null;
  if (codeStart === -1) return { type: "bold", position: boldStart };
  if (boldStart === -1) return { type: "code", position: codeStart };
  return codeStart < boldStart ? { type: "code", position: codeStart } : { type: "bold", position: boldStart };
}
