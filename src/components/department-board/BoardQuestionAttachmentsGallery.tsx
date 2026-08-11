"use client";

import { useEffect, useReducer, useState } from "react";
import Image from "next/image";
import { ModalShell } from "@/components/ui/ModalShell";
import { Spinner } from "@/components/ui/Spinner";
import { IconAlertCircle } from "@/components/icons/StrokeIcons";
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

export function BoardQuestionAttachmentsGallery({
  attachments,
  className,
}: {
  attachments: DepartmentBoardThreadAttachment[];
  className?: string;
}) {
  const [state, dispatch] = useReducer(fetchReducer, { status: "idle", urls: {} });
  const [zoom, setZoom] = useState<{ url: string; name: string } | null>(null);

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

  if (!attachments.length) return null;

  if (state.status === "loading" || state.status === "idle") {
    return (
      <div
        className={cn(
          "flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] font-medium text-slate-500",
          className
        )}
      >
        <Spinner size="sm" />
        Wczytywanie zdjęć…
      </div>
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

  return (
    <>
      <ul className={cn("flex flex-wrap gap-2", className)}>
        {attachments.map((att, index) => {
          const url = state.urls[att.id];
          if (!url) return null;
          return (
            <li key={att.id}>
              <button
                type="button"
                onClick={() =>
                  setZoom({
                    url,
                    name: att.file_name || `Zdjęcie ${index + 1}`,
                  })
                }
                className="group relative h-24 w-24 cursor-zoom-in overflow-hidden rounded-md border border-slate-200 bg-slate-50 transition-shadow hover:shadow-md sm:h-28 sm:w-28"
                title="Powiększ zdjęcie"
                aria-label={`Powiększ zdjęcie ${index + 1}`}
              >
                <Image
                  src={url}
                  alt={att.file_name || `Zdjęcie ${index + 1}`}
                  fill
                  unoptimized
                  className="object-cover"
                />
                <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/40 to-transparent px-1.5 py-1 text-[10px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
                  Powiększ
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <ModalShell
        open={zoom != null}
        onClose={() => setZoom(null)}
        title={zoom?.name ?? "Zdjęcie"}
        size="xl"
        tier="raised"
        bodyClassName="p-2 sm:p-3"
      >
        {zoom ? (
          <div className="flex items-center justify-center">
            <Image
              src={zoom.url}
              alt={zoom.name}
              width={960}
              height={720}
              unoptimized
              className="max-h-[80vh] w-auto rounded-lg object-contain"
            />
          </div>
        ) : null}
      </ModalShell>
    </>
  );
}
