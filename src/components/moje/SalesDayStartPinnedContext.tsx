"use client";

import Link from "next/link";
import { buildNotatnikPageHref } from "@/lib/sales/notepad-page-tabs";
import type { SalesDayStartPinnedAnnouncement } from "@/lib/sales/sales-day-start";
import { pinnedNoteFollowUpHint } from "@/lib/sales/sales-day-start";
import { salesBoardAnnouncementHref } from "@/lib/data/department-board";
import type { SalesNote } from "@/types/database";
import { NOTE_COLOR_CARD } from "@/components/notatnik/note-styles";
import { cn } from "@/lib/cn";
import { salesChromeInsetClass, salesTypography } from "@/lib/ui/ontime-theme";

function noteTitle(note: SalesNote): string {
  return note.title?.trim() || note.body.trim().slice(0, 64) || "Notatka";
}

function announcementTitle(announcement: SalesDayStartPinnedAnnouncement): string {
  return announcement.title.trim() || announcement.body.trim().slice(0, 64) || "Ogłoszenie";
}

function PinnedScrollCards({ children }: { children: React.ReactNode }) {
  return (
    <ul className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5 snap-x snap-mandatory">
      {children}
    </ul>
  );
}

export function SalesDayStartPinnedContext({
  announcements,
  announcementOverflow,
  notes,
  noteOverflow,
  previewHref,
}: {
  announcements: SalesDayStartPinnedAnnouncement[];
  announcementOverflow: number;
  notes: SalesNote[];
  noteOverflow: number;
  previewHref: (href: string) => string;
}) {
  const hasAnnouncements = announcements.length > 0 || announcementOverflow > 0;
  const hasNotes = notes.length > 0 || noteOverflow > 0;
  if (!hasAnnouncements && !hasNotes) return null;

  const boardHref = previewHref("/tablica?widok=ogloszenia");
  const notepadHref = previewHref(buildNotatnikPageHref({ tab: "notes" }));

  return (
    <div className={cn("border-t border-slate-100 bg-slate-50/60 py-3", salesChromeInsetClass)}>
      <div
        className={cn(
          "grid gap-4",
          hasAnnouncements && hasNotes ? "md:grid-cols-2" : "grid-cols-1"
        )}
      >
        {hasAnnouncements ? (
          <section className="min-w-0">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <span className="text-sm leading-none text-sky-600" aria-hidden>
                  📢
                </span>
                <p
                  className={cn(
                    salesTypography.sectionLabel,
                    "normal-case tracking-normal text-slate-600"
                  )}
                >
                  Od zakupów
                </p>
              </div>
              <Link href={boardHref} className="text-xs font-semibold text-indigo-700 hover:underline">
                Tablica
              </Link>
            </div>
            <PinnedScrollCards>
              {announcements.map((announcement) => {
                const bodyPreview = announcement.body.trim().slice(0, 80);
                return (
                <li key={announcement.id} className="w-[min(100%,14rem)] shrink-0 snap-start">
                  <Link
                    href={previewHref(salesBoardAnnouncementHref(announcement.id))}
                    className="block min-h-[4.5rem] rounded-md border border-sky-200/80 bg-sky-50/70 p-2.5 shadow-sm transition hover:shadow-md"
                  >
                    <p className="line-clamp-2 text-xs font-semibold text-slate-900">
                      {announcementTitle(announcement)}
                    </p>
                    {bodyPreview ? (
                      <p className="mt-1 line-clamp-2 text-[10px] text-slate-600">{bodyPreview}</p>
                    ) : null}
                  </Link>
                </li>
              );
              })}
              {announcementOverflow > 0 ? (
                <li className="flex w-24 shrink-0 items-center justify-center">
                  <Link
                    href={boardHref}
                    className="text-center text-xs font-semibold text-indigo-700 hover:underline"
                  >
                    +{announcementOverflow} więcej
                  </Link>
                </li>
              ) : null}
            </PinnedScrollCards>
          </section>
        ) : null}

        {hasNotes ? (
          <section className="min-w-0">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <span className="text-sm leading-none text-indigo-600" aria-hidden>
                  📌
                </span>
                <p
                  className={cn(
                    salesTypography.sectionLabel,
                    "normal-case tracking-normal text-slate-600"
                  )}
                >
                  Twój notatnik
                </p>
              </div>
              <Link href={notepadHref} className="text-xs font-semibold text-indigo-700 hover:underline">
                Notatki
              </Link>
            </div>
            <PinnedScrollCards>
              {notes.map((note) => {
                const followUp = pinnedNoteFollowUpHint(note);
                return (
                  <li key={note.id} className="w-[min(100%,14rem)] shrink-0 snap-start">
                    <Link
                      href={previewHref(
                        buildNotatnikPageHref({ tab: "notes", hash: `note-${note.id}` })
                      )}
                      className={cn(
                        "block min-h-[4.5rem] rounded-md border p-2.5 shadow-sm transition hover:shadow-md",
                        NOTE_COLOR_CARD[note.color]
                      )}
                    >
                      <p className="line-clamp-2 text-xs font-semibold text-slate-900">
                        {noteTitle(note)}
                      </p>
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
              {noteOverflow > 0 ? (
                <li className="flex w-24 shrink-0 items-center justify-center">
                  <Link
                    href={notepadHref}
                    className="text-center text-xs font-semibold text-indigo-700 hover:underline"
                  >
                    +{noteOverflow} więcej
                  </Link>
                </li>
              ) : null}
            </PinnedScrollCards>
          </section>
        ) : null}
      </div>
    </div>
  );
}
