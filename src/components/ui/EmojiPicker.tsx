"use client";

import { useId, useState, type RefObject } from "react";
import { cn } from "@/lib/cn";

/** Emotki, które mają sens w rozmowie działu: potwierdzenia, pilność, logistyka, kilka min. */
const EMOJI = [
  "👍", "🙏", "✅", "❌", "⚠️", "❗", "❓", "🔥",
  "⏰", "📦", "🚚", "📞", "📧", "💰", "🧾", "📅",
  "🙂", "😊", "😅", "😉", "🤔", "😬", "🎉", "👀",
  "💡", "✨", "🤝", "👌", "🚀", "📌", "🫡", "😄",
];

/**
 * Wstawianie emotki w miejscu kursora pola tekstowego. Lista rozwija się w nurcie strony (bez warstwy
 * pływającej), więc nic jej nie ucina w modalu ani na telefonie; w pasku flex zajmuje cały nowy wiersz.
 */
export function EmojiPicker({
  textareaRef,
  value,
  onChange,
  disabled = false,
  className,
}: {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const listId = useId();

  const insert = (emoji: string) => {
    const el = textareaRef.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? start;
    onChange(`${value.slice(0, start)}${emoji}${value.slice(end)}`);
    setOpen(false);
    // Po przerenderowaniu: kursor za wstawioną emotką, pole znów aktywne.
    setTimeout(() => {
      if (!el) return;
      el.focus();
      const pos = start + emoji.length;
      el.setSelectionRange(pos, pos);
    }, 0);
  };

  return (
    <div className="contents">
      <button
        type="button"
        aria-label="Wstaw emotkę"
        aria-expanded={open}
        aria-controls={listId}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex h-8 min-w-8 items-center justify-center rounded-md border border-slate-200 bg-white px-1.5 text-base leading-none shadow-sm transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/45 disabled:cursor-not-allowed disabled:opacity-50",
          open && "bg-slate-100",
          className
        )}
      >
        <span aria-hidden>🙂</span>
      </button>
      {open ? (
        <div id={listId} role="group" aria-label="Emotki" className="mt-1.5 flex w-full max-w-[17rem] basis-full flex-wrap gap-0.5 rounded-md border border-slate-200 bg-slate-50/80 p-1.5">
          {EMOJI.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => insert(e)}
              aria-label={`Wstaw ${e}`}
              className="flex h-7 w-7 items-center justify-center rounded text-lg leading-none transition-colors hover:bg-white active:scale-95 motion-reduce:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/45"
            >
              {e}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
