"use client";

import Link from "next/link";
import type { SalesNote } from "@/types/database";
import { pinnedNoteFollowUpHint } from "@/lib/sales/sales-day-start";
import { NOTE_COLOR_CARD } from "@/components/notatnik/note-styles";
import { cn } from "@/lib/cn";
import { salesChromeInsetClass, salesTypography } from "@/lib/ui/ontime-theme";

function noteTitle(note: SalesNote): string {
  return note.title?.trim() || note.body.trim().slice(0, 64) || "Notatka";
}

export function SalesDayStartPinnedNotes({
  notes,
  overflow,
  previewHref,
}: {
  notes: SalesNote[];
  overflow: number;
  previewHref: (href: string) => string;
}) {
  if (!notes.length && overflow <= 0) return null;

  return (
    <div className={cn("border-t border-slate-100 bg-slate-50/60 py-3", salesChromeInsetClass)}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-sm leading-none text-indigo-600" aria-hidden>
            📌
          </span>
          <p className={cn(salesTypography.sectionLabel, "normal-case tracking-normal text-slate-600")}>
            Przypięte — kontekst roboczy
          </p>
        </div>
        <Link
          href={previewHref("/notatnik")}
          className="text-xs font-semibold text-indigo-700 hover:underline"
        >
          Notatnik
        </Link>
      </div>
      <ul className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5 snap-x snap-mandatory">
        {notes.map((note) => {
          const followUp = pinnedNoteFollowUpHint(note);
          return (
            <li key={note.id} className="w-[min(100%,14rem)] shrink-0 snap-start">
              <Link
                href={previewHref(`/notatnik#note-${note.id}`)}
                className={cn(
                  "block min-h-[4.5rem] rounded-md border p-2.5 shadow-sm transition hover:shadow-md",
                  NOTE_COLOR_CARD[note.color]
                )}
              >
                <p className="line-clamp-2 text-xs font-semibold text-slate-900">{noteTitle(note)}</p>
                {followUp ? (
                  <p className="mt-1 text-[10px] font-medium text-violet-800">{followUp}</p>
                ) : (
                  <p className="mt-1 line-clamp-2 text-[10px] text-slate-600">
                    {note.body.trim().slice(0, 80)}
                  </p>
                )}
              </Link>
            </li>
          );
        })}
        {overflow > 0 ? (
          <li className="flex w-24 shrink-0 items-center justify-center">
            <Link
              href={previewHref("/notatnik")}
              className="text-center text-xs font-semibold text-indigo-700 hover:underline"
            >
              +{overflow} więcej
            </Link>
          </li>
        ) : null}
      </ul>
    </div>
  );
}
