"use client";

import { useEffect, useReducer, useState } from "react";
import Image from "next/image";
import { ModalShell } from "@/components/ui/ModalShell";
import { Spinner } from "@/components/ui/Spinner";
import {
  IconAlertCircle,
  IconChevronLeft,
  IconChevronRight,
} from "@/components/icons/StrokeIcons";
import { actionGetBoardQuestionImageUrl } from "@/app/actions/department-board";
import type { DepartmentBoardThreadAttachment } from "@/types/database";
import { cn } from "@/lib/cn";

type FetchState = {
  status: "idle" | "loading" | "done" | "error";
  urls: Record<string, string>;
};

type FetchAction =
  | { type: "start" }
  | { type: "success"; urls: Record<string, string> }
  | { type: "error" };

function fetchReducer(_state: FetchState, action: FetchAction): FetchState {
  switch (action.type) {
    case "start":
      return { status: "loading", urls: {} };
    case "success":
      return { status: "done", urls: action.urls };
    case "error":
      return { status: "error", urls: {} };
    default:
      return { status: "idle", urls: {} };
  }
}

/** Wklejone zrzuty mają techniczne nazwy (zrzut-<timestamp>.jpg) — pokazujemy ludzką. */
function attachmentDisplayName(fileName: string | null | undefined, index: number): string {
  const name = fileName?.trim();
  if (!name) return `Zdjęcie ${index + 1}`;
  if (/^zrzut-\d+\.[a-z]+$/i.test(name)) return "Zrzut ekranu";
  return name;
}

const thumbClass =
  "relative h-24 w-24 overflow-hidden rounded-md border border-slate-200 bg-slate-50 sm:h-28 sm:w-28";

export function BoardQuestionAttachmentsGallery({
  attachments,
  className,
}: {
  attachments: DepartmentBoardThreadAttachment[];
  className?: string;
}) {
  const [state, dispatch] = useReducer(fetchReducer, { status: "idle", urls: {} });
  const [zoomIndex, setZoomIndex] = useState<number | null>(null);

  const idsKey = attachments.map((a) => a.id).join(",");

  useEffect(() => {
    if (!attachments.length) return;
    let cancelled = false;
    const snapshot = attachments;
    dispatch({ type: "start" });
    void Promise.all(
      snapshot.map(async (att) => {
        const result = await actionGetBoardQuestionImageUrl(att.id);
        return [att.id, result.url] as const;
      })
    )
      .then((pairs) => {
        if (cancelled) return;
        const urls: Record<string, string> = {};
        let any = false;
        for (const [id, url] of pairs) {
          if (url) {
            urls[id] = url;
            any = true;
          }
        }
        if (!any) dispatch({ type: "error" });
        else dispatch({ type: "success", urls });
      })
      .catch(() => {
        if (!cancelled) dispatch({ type: "error" });
      });
    return () => {
      cancelled = true;
    };
    // idsKey — stabilny klucz; nie zależymy od referencji tablicy z RSC.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- idsKey covers identity
  }, [idsKey]);

  const viewable = attachments.filter((att) => state.urls[att.id]);
  const zoomed = zoomIndex != null ? viewable[zoomIndex] : undefined;
  const zoomUrl = zoomed ? state.urls[zoomed.id] : undefined;
  const canBrowse = viewable.length > 1;

  const step = (delta: number) =>
    setZoomIndex((i) =>
      i == null ? i : (i + delta + viewable.length) % viewable.length
    );

  useEffect(() => {
    if (zoomIndex == null || viewable.length < 2) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") step(1);
      else if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- step zależy tylko od długości
  }, [zoomIndex, viewable.length]);

  if (!attachments.length) return null;

  if (state.status === "loading" || state.status === "idle") {
    return (
      <ul className={cn("flex flex-wrap gap-2", className)} aria-label="Wczytywanie zdjęć">
        {attachments.map((att) => (
          <li key={att.id} className={cn(thumbClass, "flex items-center justify-center")}>
            <Spinner size="sm" />
          </li>
        ))}
      </ul>
    );
  }

  if (state.status === "error") {
    return (
      <div
        className={cn(
          "flex items-center gap-1.5 rounded-md border border-amber-200/80 bg-amber-50/80 px-2.5 py-1.5 text-[11px] font-medium text-amber-800",
          className
        )}
      >
        <IconAlertCircle size={12} />
        Nie udało się wczytać zdjęć
      </div>
    );
  }

  const zoomName = zoomed ? attachmentDisplayName(zoomed.file_name, zoomIndex ?? 0) : "Zdjęcie";

  return (
    <>
      <ul className={cn("flex flex-wrap gap-2", className)}>
        {viewable.map((att, index) => {
          const url = state.urls[att.id]!;
          return (
            <li key={att.id}>
              <button
                type="button"
                onClick={() => setZoomIndex(index)}
                className={cn(
                  thumbClass,
                  "group block cursor-zoom-in transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40"
                )}
                title="Powiększ zdjęcie"
                aria-label={`Powiększ zdjęcie ${index + 1}`}
              >
                <Image
                  src={url}
                  alt={attachmentDisplayName(att.file_name, index)}
                  fill
                  unoptimized
                  className="object-cover"
                />
                <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-black/45 px-1.5 py-1 text-[10px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
                  Powiększ
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <ModalShell
        open={zoomed != null}
        onClose={() => setZoomIndex(null)}
        title={canBrowse ? `${zoomName} (${(zoomIndex ?? 0) + 1}/${viewable.length})` : zoomName}
        size="xl"
        tier="raised"
        bodyClassName="p-2 sm:p-3"
        footer={
          zoomUrl ? (
            <div className="flex w-full items-center justify-between gap-2">
              <a
                href={zoomUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
              >
                Otwórz w pełnym rozmiarze
              </a>
              {canBrowse ? (
                <span className="hidden text-[11px] text-slate-400 sm:inline">
                  Strzałki ← → przełączają zdjęcia
                </span>
              ) : null}
            </div>
          ) : null
        }
      >
        {zoomUrl ? (
          <div className="relative flex items-center justify-center">
            <Image
              key={zoomUrl}
              src={zoomUrl}
              alt={zoomName}
              width={960}
              height={720}
              unoptimized
              className="max-h-[75vh] w-auto rounded-lg object-contain"
            />
            {canBrowse ? (
              <>
                <button
                  type="button"
                  onClick={() => step(-1)}
                  className="absolute left-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-slate-900/60 text-white hover:bg-slate-900/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  aria-label="Poprzednie zdjęcie"
                >
                  <IconChevronLeft size={20} />
                </button>
                <button
                  type="button"
                  onClick={() => step(1)}
                  className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-slate-900/60 text-white hover:bg-slate-900/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  aria-label="Następne zdjęcie"
                >
                  <IconChevronRight size={20} />
                </button>
              </>
            ) : null}
          </div>
        ) : null}
      </ModalShell>
    </>
  );
}
