"use client";

import { useEffect, useReducer, useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/cn";
import { ModalShell } from "@/components/ui/ModalShell";
import { Spinner } from "@/components/ui/Spinner";
import { actionGetOcrImageUrl } from "@/app/actions/teeth-orders";
import { IconAlertCircle } from "@/components/icons/StrokeIcons";

type FetchState = { status: "idle" | "loading" | "done" | "error"; url: string | null };

type FetchAction =
  | { type: "start" }
  | { type: "success"; url: string }
  | { type: "error" };

function fetchReducer(state: FetchState, action: FetchAction): FetchState {
  switch (action.type) {
    case "start":
      return { status: "loading", url: null };
    case "success":
      return { status: "done", url: action.url };
    case "error":
      return { status: "error", url: null };
    default:
      return state;
  }
}

export function TeethOcrImage({
  imagePath,
  className,
}: {
  imagePath: string | null | undefined;
  className?: string;
}) {
  const [state, dispatch] = useReducer(fetchReducer, { status: "idle", url: null });
  const [zoomOpen, setZoomOpen] = useState(false);

  useEffect(() => {
    if (!imagePath) return;
    let cancelled = false;
    dispatch({ type: "start" });
    void actionGetOcrImageUrl(imagePath)
      .then((result) => {
        if (cancelled) return;
        if (result.url) dispatch({ type: "success", url: result.url });
        else dispatch({ type: "error" });
      })
      .catch(() => {
        if (!cancelled) dispatch({ type: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [imagePath]);

  if (!imagePath) return null;

  if (state.status === "loading") {
    return (
      <div
        className={cn(
          "flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-500",
          className,
        )}
      >
        <Spinner size="sm" />
        Wczytywanie zdjęcia…
      </div>
    );
  }

  if (state.status === "error" || !state.url) {
    return (
      <div
        className={cn(
          "flex items-center gap-1.5 rounded-md border border-amber-200/80 bg-amber-50/80 px-2 py-1 text-[11px] font-medium text-amber-800",
          className,
        )}
      >
        <IconAlertCircle size={12} />
        Nie udało się wczytać zdjęcia
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setZoomOpen(true)}
        className={cn(
          "group relative block cursor-zoom-in overflow-hidden rounded-lg border border-slate-200 bg-slate-50 transition-shadow hover:shadow-md",
          className,
        )}
        title="Kliknij aby powiększyć"
        aria-label="Powiększ zdjęcie kartki"
      >
        <Image
          src={state.url}
          alt="Zdjęcie kartki z zamówieniem zębów"
          fill
          unoptimized
          className="h-full max-h-full w-full object-contain"
          onError={() => dispatch({ type: "error" })}
        />
        <div className="pointer-events-none absolute inset-0 flex items-end justify-end bg-gradient-to-t from-black/30 to-transparent p-1.5 opacity-0 transition-opacity group-hover:opacity-100">
          <span className="rounded bg-white/90 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">
            Powiększ
          </span>
        </div>
      </button>

      <ModalShell
        open={zoomOpen}
        onClose={() => setZoomOpen(false)}
        title="Zdjęcie kartki"
        size="xl"
        tier="raised"
        bodyClassName="p-2 sm:p-3"
      >
        <div className="flex items-center justify-center">
          <Image
            src={state.url}
            alt="Powiększone zdjęcie kartki z zamówieniem zębów"
            width={800}
            height={600}
            unoptimized
            className="max-h-[80vh] w-auto rounded-lg object-contain"
            onError={() => dispatch({ type: "error" })}
          />
        </div>
      </ModalShell>
    </>
  );
}
