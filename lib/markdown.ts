/**
 * A deliberately tiny, safe formatting language for diary text.
 * It produces a token tree that React renders as text nodes — HTML is never
 * interpreted, so diary content can't inject markup or scripts.
 *
 * Supported:
 *   **bold**   *italic* or _italic_   > quote line   - bullet line
 *   Blank line = new paragraph, single newline = line break.
 */

export type Inline = { kind: "text" | "bold" | "italic"; text: string };

export type Block =
  | { kind: "paragraph"; lines: Inline[][] }
  | { kind: "quote"; lines: Inline[][] }
  | { kind: "list"; items: Inline[][] };

export function parseInline(line: string): Inline[] {
  const out: Inline[] = [];
  const re = /\*\*(.+?)\*\*|\*(?!\s)(.+?)(?<!\s)\*|(?<![\p{L}\p{N}])_(?!\s)(.+?)(?<!\s)_(?![\p{L}\p{N}])/gu;
  let last = 0;
  for (const m of line.matchAll(re)) {
    const idx = m.index ?? 0;
    if (idx > last) out.push({ kind: "text", text: line.slice(last, idx) });
    if (m[1] !== undefined) out.push({ kind: "bold", text: m[1] });
    else out.push({ kind: "italic", text: (m[2] ?? m[3]) as string });
    last = idx + m[0].length;
  }
  if (last < line.length) out.push({ kind: "text", text: line.slice(last) });
  return out.length ? out : [{ kind: "text", text: "" }];
}

export function parseBlocks(content: string): Block[] {
  const blocks: Block[] = [];
  const chunks = content.replace(/\r\n?/g, "\n").split(/\n{2,}/);
  for (const chunk of chunks) {
    const lines = chunk.split("\n");
    if (lines.every((l) => l.trim() === "")) continue;
    let current: Block | null = null;
    for (const line of lines) {
      const quote = /^>\s?(.*)$/.exec(line);
      const bullet = /^\s*[-•]\s+(.*)$/.exec(line);
      if (quote) {
        if (current?.kind !== "quote") {
          current = { kind: "quote", lines: [] };
          blocks.push(current);
        }
        current.lines.push(parseInline(quote[1] ?? ""));
      } else if (bullet) {
        if (current?.kind !== "list") {
          current = { kind: "list", items: [] };
          blocks.push(current);
        }
        current.items.push(parseInline(bullet[1] ?? ""));
      } else {
        if (current?.kind !== "paragraph") {
          current = { kind: "paragraph", lines: [] };
          blocks.push(current);
        }
        current.lines.push(parseInline(line));
      }
    }
  }
  return blocks;
}

/** Plain-text preview (formatting markers removed), for cards and search results. */
export function toPlainText(content: string): string {
  return content
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/(^|[^*])\*(?!\s)(.+?)(?<!\s)\*/g, "$1$2")
    .replace(/(^|[^\p{L}\p{N}])_(?!\s)(.+?)(?<!\s)_(?![\p{L}\p{N}])/gu, "$1$2")
    .replace(/^>\s?/gm, "")
    .replace(/^\s*[-•]\s+/gm, "• ")
    .replace(/\s+/g, " ")
    .trim();
}

export function preview(content: string, max = 160): string {
  const text = toPlainText(content);
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}
