"use client";

import { useEffect, useId, useRef, useState, type RefObject } from "react";
import { Button } from "@/components/ui/Button";
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
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Escape zamyka i oddaje fokus przyciskowi; klik poza listą zamyka — jak każde menu w aplikacji.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    };
    const onPointer = (e: PointerEvent) => {
      const t = e.target as Node;
      if (listRef.current?.contains(t) || triggerRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

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
      <Button
        ref={triggerRef}
        type="button"
        size="sm"
        variant="secondary"
        aria-label="Wstaw emotkę"
        aria-expanded={open}
        aria-controls={listId}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={cn("px-2 text-sm", open && "bg-slate-100", className)}
      >
        <span aria-hidden>🙂</span>
      </Button>
      {open ? (
        <div ref={listRef} id={listId} role="group" aria-label="Emotki" className="mt-1.5 flex w-full max-w-[17rem] basis-full flex-wrap gap-0.5 rounded-md border border-slate-200 bg-slate-50/80 p-1.5">
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
