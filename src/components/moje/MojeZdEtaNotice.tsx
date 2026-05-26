"use client";

import { cn } from "@/lib/cn";
import type { ZdEtaFetchMeta } from "@/lib/subiekt/zd-eta-cache";

export type MojeZdEtaNoticeState =
  | { status: "idle" }
  | { status: "loading"; eligibleCount: number }
  | { status: "ready"; meta: ZdEtaFetchMeta }
  | { status: "unavailable"; message: string }
  | { status: "error"; message: string };

function formatTime(ts: number): string {
  return new Intl.DateTimeFormat("pl-PL", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(ts));
}

function formatRelativeRefresh(nextRefreshAt: number): string {
  const min = Math.max(0, Math.round((nextRefreshAt - Date.now()) / 60_000));
  if (min < 60) return `za ok. ${min} min`;
  const h = Math.round(min / 60);
  return h === 1 ? "za ok. 1 godz." : `za ok. ${h} godz.`;
}

export function MojeZdEtaNotice({
  state,
  className,
}: {
  state: MojeZdEtaNoticeState;
  className?: string;
}) {
  if (state.status === "idle") return null;

  const tone =
    state.status === "loading"
      ? "indigo"
      : state.status === "ready"
        ? "ok"
        : state.status === "error"
          ? "warn"
          : "muted";

  let title = "";
  let body = "";

  if (state.status === "loading") {
    title = "Sprawdzamy terminy w Subiekcie";
    body =
      state.eligibleCount > 0
        ? `Porównujemy ${state.eligibleCount} ${
            state.eligibleCount === 1 ? "prośbę" : "prośby"
          } z dokumentami ZD u powiązanego dostawcy w Subiekcie — lista jest już dostępna poniżej ze szacunkami z historii.`
        : "Lista jest już dostępna — szacunki z historii dostaw. Terminy z ZD sprawdzamy tylko dla dostawców powiązanych z Subiektem (kh_Id w administracji).";
  } else if (state.status === "ready") {
    const { meta } = state;
    title = meta.servedFromCache
      ? "Terminy ZD z pamięci podręcznej"
      : "Zaktualizowano terminy ZD";
    const skipped =
      meta.skippedNoSubiektLink > 0
        ? `${meta.skippedNoSubiektLink} ${
            meta.skippedNoSubiektLink === 1 ? "prośba" : "prośby"
          } pominięte — dostawca bez powiązania z Subiektem (ustaw w kartach dostawców).`
        : "";
    const matched =
      meta.matchedCount > 0
        ? `${meta.matchedCount} z ${meta.eligibleCount} ${
            meta.eligibleCount === 1 ? "prośby" : "prośb"
          } ma termin z dokumentu ZD.`
        : meta.eligibleCount > 0
          ? "Nie znaleźliśmy ZD u tego dostawcy z pasującą pozycją (inna nazwa towaru lub brak daty na ZD) — zostają szacunki z historii."
          : "";
    body = [
      matched,
      skipped,
      `Ostatnie sprawdzenie: ${formatTime(meta.fetchedAt)} · kolejne ${formatRelativeRefresh(meta.nextRefreshAt)}.`,
    ]
      .filter(Boolean)
      .join(" ");
  } else if (state.status === "unavailable") {
    title = "Terminy bez ZD Subiekta";
    body = state.message;
  } else {
    title = "Terminy ZD tymczasowo niedostępne";
    body = `${state.message} Pokazujemy szacunki z historii dostaw.`;
  }

  return (
    <div
      className={cn(
        "rounded-xl border px-3 py-2.5 text-xs leading-relaxed",
        tone === "indigo" && "border-indigo-200/90 bg-indigo-50/60 text-indigo-950",
        tone === "ok" && "border-emerald-200/90 bg-emerald-50/50 text-emerald-950",
        tone === "warn" && "border-amber-200/90 bg-amber-50/60 text-amber-950",
        tone === "muted" && "border-slate-200/90 bg-slate-50/80 text-slate-600",
        className
      )}
      role="status"
      aria-live="polite"
    >
      <p className="font-semibold">{title}</p>
      <p className="mt-0.5 opacity-90">{body}</p>
    </div>
  );
}
