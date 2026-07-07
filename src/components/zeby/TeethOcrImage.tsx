"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { ModalShell } from "@/components/ui/ModalShell";
import { Spinner } from "@/components/ui/Spinner";
import { actionGetOcrImageUrl } from "@/app/actions/teeth-orders";
import { IconAlertCircle } from "@/components/icons/StrokeIcons";

export function TeethOcrImage({
  imagePath,
  className,
}: {
  imagePath: string | null | undefined;
  className?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [zoomOpen, setZoomOpen] = useState(false);

  useEffect(() => {
    if (!imagePath) {
      setUrl(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(false);
    void actionGetOcrImageUrl(imagePath)
      .then((result) => {
        if (cancelled) return;
        setUrl(result.url);
        if (!result.url) setError(true);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [imagePath]);

  if (!imagePath) return null;

  if (loading) {
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

  if (error || !url) {
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
        <img
          src={url}
          alt="Zdjęcie kartki z zamówieniem zębów"
          className="h-full max-h-full w-full object-contain"
          onError={() => setError(true)}
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
          <img
            src={url}
            alt="Zdjęcie kartki z zamówieniem zębów"
            className="max-h-[80vh] w-auto rounded-lg object-contain"
            onError={() => setError(true)}
          />
        </div>
      </ModalShell>
    </>
  );
}
