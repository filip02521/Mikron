"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { formatInlineNoteText, parseNoteBodyBlocks } from "@/lib/sales/note-body-format";

export function NoteBodyDisplay({
  body,
  className,
  emptyClassName,
  onTodoToggle,
}: {
  body: string;
  className?: string;
  emptyClassName?: string;
  /** Wywoływany gdy użytkownik kliknie checkbox w trybie odczytu. */
  onTodoToggle?: (lineIndex: number, checked: boolean) => void;
}) {
  const blocks = useMemo(() => parseNoteBodyBlocks(body), [body]);
  const trimmed = body.trim();
  const [localChecked, setLocalChecked] = useState<Record<number, boolean>>({});

  if (!trimmed) {
    return <p className={cn("text-sm italic text-slate-400", emptyClassName)}>Brak treści</p>;
  }

  // Zliczaj pozycje todo w całej notatce, aby identyfikować linie
  let todoLineCounter = 0;

  return (
    <div className={cn("note-body-display space-y-1.5 text-[13px] leading-snug text-slate-900/90", className)}>
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
        if (block.type === "todo") {
          return (
            <ul key={`todo-${index}`} className="todo-list">
              {block.items.map((item, itemIndex) => {
                const lineIndex = todoLineCounter++;
                const isChecked = localChecked[lineIndex] ?? item.checked;
                return (
                  <li key={itemIndex} data-checked={isChecked}>
                    <span
                      className="todo-checkbox"
                      data-checked={isChecked}
                      aria-hidden
                      onClick={
                        onTodoToggle
                          ? (e) => {
                              e.stopPropagation();
                              const next = !isChecked;
                              setLocalChecked((prev) => ({ ...prev, [lineIndex]: next }));
                              onTodoToggle(lineIndex, next);
                            }
                          : undefined
                      }
                    />
                    <span
                      className={cn("whitespace-pre-wrap", onTodoToggle && "cursor-pointer")}
                      onClick={
                        onTodoToggle
                          ? (e) => {
                              e.stopPropagation();
                              const next = !isChecked;
                              setLocalChecked((prev) => ({ ...prev, [lineIndex]: next }));
                              onTodoToggle(lineIndex, next);
                            }
                          : undefined
                      }
                    >
                      {formatInlineNoteText(item.text)}
                    </span>
                  </li>
                );
              })}
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
