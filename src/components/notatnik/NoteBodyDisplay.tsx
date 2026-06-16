"use client";

import { useMemo } from "react";
import { cn } from "@/lib/cn";
import { formatInlineNoteText, parseNoteBodyBlocks } from "@/lib/sales/note-body-format";

export function NoteBodyDisplay({
  body,
  className,
  emptyClassName,
}: {
  body: string;
  className?: string;
  emptyClassName?: string;
}) {
  const blocks = useMemo(() => parseNoteBodyBlocks(body), [body]);
  const trimmed = body.trim();

  if (!trimmed) {
    return <p className={cn("text-sm italic text-slate-400", emptyClassName)}>Brak treści</p>;
  }

  return (
    <div className={cn("space-y-1.5 text-[13px] leading-snug text-slate-900/90", className)}>
      {blocks.map((block, index) => {
        if (block.type === "paragraph") {
          return (
            <p key={`p-${index}`} className="whitespace-pre-wrap">
              {formatInlineNoteText(block.text)}
            </p>
          );
        }
        if (block.type === "ul") {
          return (
            <ul key={`ul-${index}`} className="list-disc space-y-1 pl-5 marker:text-slate-400">
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex} className="whitespace-pre-wrap">
                  {formatInlineNoteText(item)}
                </li>
              ))}
            </ul>
          );
        }
        return (
          <ol
            key={`ol-${index}`}
            className="list-decimal space-y-1 pl-5 marker:font-medium marker:text-slate-500"
          >
            {block.items.map((item, itemIndex) => (
              <li key={itemIndex} className="whitespace-pre-wrap">
                {formatInlineNoteText(item)}
              </li>
            ))}
          </ol>
        );
      })}
    </div>
  );
}
