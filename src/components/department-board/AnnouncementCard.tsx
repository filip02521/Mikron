"use client";

import { useEffect, useRef, useState } from "react";
import { NOTE_COLOR_CARD, NOTE_COLOR_SWATCH } from "@/components/notatnik/note-styles";
import { Button } from "@/components/ui/Button";
import { IconPin } from "@/components/icons/StrokeIcons";
import {
  authorLabelFromProfile,
  formatBoardDate,
} from "@/lib/department-board/format";
import type { DepartmentBoardThreadRow } from "@/lib/data/department-board";
import { cn } from "@/lib/cn";
import {
  actionArchiveAnnouncement,
  actionMarkAnnouncementRead,
  actionToggleAnnouncementPin,
} from "@/app/actions/department-board";

export function AnnouncementCard({
  thread,
  unread = false,
  canManage = false,
  autoMarkRead = false,
  embedded = false,
  onChanged,
}: {
  thread: DepartmentBoardThreadRow;
  unread?: boolean;
  canManage?: boolean;
  autoMarkRead?: boolean;
  embedded?: boolean;
  onChanged?: () => void;
}) {
  const articleRef = useRef<HTMLElement | null>(null);
  const markedRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locallyRead, setLocallyRead] = useState(!unread);
  const threadSyncKey = `${thread.id}\0${unread}`;
  const [storedThreadSyncKey, setStoredThreadSyncKey] = useState(threadSyncKey);
  if (threadSyncKey !== storedThreadSyncKey) {
    setStoredThreadSyncKey(threadSyncKey);
    setLocallyRead(!unread);
  }
  const author = authorLabelFromProfile(thread.author, "Zakupy");
  const cardTone = NOTE_COLOR_CARD[thread.color] ?? NOTE_COLOR_CARD.default;
  const colorSwatch = NOTE_COLOR_SWATCH[thread.color] ?? NOTE_COLOR_SWATCH.default;
  const showUnread = unread && !locallyRead;

  const leftAccent = showUnread
    ? "border-l-sky-500"
    : thread.pinned
      ? "border-l-indigo-500"
      : "border-l-slate-200";

  useEffect(() => {
    markedRef.current = false;
  }, [thread.id, unread]);

  useEffect(() => {
    if (!autoMarkRead || !showUnread || !articleRef.current) return;

    const node = articleRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.some((e) => e.isIntersecting && e.intersectionRatio >= 0.45);
        if (!visible || markedRef.current) return;
        markedRef.current = true;
        void actionMarkAnnouncementRead(thread.id)
          .then(() => {
            setLocallyRead(true);
          })
          .catch(() => {
            markedRef.current = false;
          });
      },
      { threshold: [0.45, 0.6] }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [autoMarkRead, showUnread, thread.id, onChanged]);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      onChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Operacja nie powiodła się.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article
      ref={articleRef}
      id={`announcement-${thread.id}`}
      className={cn(
        embedded
          ? cn(
              "border-l-[3px] bg-white px-3 py-3 transition-colors sm:px-4",
              leftAccent,
              showUnread && "bg-sky-50/30"
            )
          : cn(
              "relative rounded-md border p-4 shadow-sm",
              cardTone,
              thread.pinned && "ring-1 ring-indigo-200/80",
              showUnread && "ring-2 ring-sky-300/70 ring-offset-1"
            )
      )}
    >
      {thread.pinned ? (
        <span
          className="absolute right-3 top-3 text-indigo-500"
          title="Przypięte"
          aria-label="Przypięte"
        >
          <IconPin size={14} strokeWidth={2.5} />
        </span>
      ) : null}

      <header className="space-y-1 pr-8">
        <div className="flex flex-wrap items-center gap-2">
          {embedded ? (
            <span
              className={cn("h-2 w-2 shrink-0 rounded-full", colorSwatch)}
              aria-hidden
            />
          ) : (
            <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-900">
              Ogłoszenie · zakupy
            </span>
          )}
          {showUnread ? (
            <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-800">
              Nowe
            </span>
          ) : null}
        </div>
        <h3 className="text-sm font-semibold text-slate-900">{thread.title}</h3>
        <p className="text-xs text-slate-600">
          {author} · {formatBoardDate(thread.published_at)}
          {thread.expires_at ? (
            <span className="text-slate-500">
              {" "}
              · ważne do {formatBoardDate(thread.expires_at)}
            </span>
          ) : null}
        </p>
      </header>

      <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
        {thread.body}
      </div>

      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {showUnread && !autoMarkRead ? (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await actionMarkAnnouncementRead(thread.id);
                setLocallyRead(true);
              })
            }
          >
            Oznacz jako przeczytane
          </Button>
        ) : null}
        {canManage ? (
          <>
            <Button
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={() =>
                void run(() => actionToggleAnnouncementPin(thread.id, !thread.pinned))
              }
            >
              {thread.pinned ? "Odepnij" : "Przypnij"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => void run(() => actionArchiveAnnouncement(thread.id))}
            >
              Archiwizuj
            </Button>
          </>
        ) : null}
      </div>
    </article>
  );
}
