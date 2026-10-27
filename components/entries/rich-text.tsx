import { Fragment } from "react";
import { parseBlocks, type Inline } from "@/lib/markdown";

/** Renders diary text from tokens as React text nodes — never as raw HTML. */
function InlineLine({ tokens }: { tokens: Inline[] }) {
  return (
    <>
      {tokens.map((tok, i) =>
        tok.kind === "bold" ? (
          <strong key={i} className="font-semibold">
            {tok.text}
          </strong>
        ) : tok.kind === "italic" ? (
          <em key={i}>{tok.text}</em>
        ) : (
          <Fragment key={i}>{tok.text}</Fragment>
        ),
      )}
    </>
  );
}

function Lines({ lines }: { lines: Inline[][] }) {
  return (
    <>
      {lines.map((l, i) => (
        <Fragment key={i}>
          {i > 0 && <br />}
          <InlineLine tokens={l} />
        </Fragment>
      ))}
    </>
  );
}

export function RichText({ content, className }: { content: string; className?: string }) {
  const blocks = parseBlocks(content);
  return (
    <div className={className}>
      {blocks.map((b, i) => {
        if (b.kind === "quote")
          return (
            <blockquote key={i} className="mb-8 border-l-2 border-lavender pl-4 italic text-ink-soft last:mb-0">
              <Lines lines={b.lines} />
            </blockquote>
          );
        if (b.kind === "list")
          return (
            <ul key={i} className="mb-8 list-disc pl-6 marker:text-tulip last:mb-0">
              {b.items.map((item, j) => (
                <li key={j}>
                  <InlineLine tokens={item} />
                </li>
              ))}
            </ul>
          );
        return (
          <p key={i} className="mb-8 whitespace-pre-wrap break-words last:mb-0">
            <Lines lines={b.lines} />
          </p>
        );
      })}
    </div>
  );
}
