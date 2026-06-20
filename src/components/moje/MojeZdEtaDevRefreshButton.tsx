"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { clearMojeZdEtaSessionSync } from "@/components/moje/MojeZdEtaSyncClient";
import type { MojeZdEtaRefreshResult } from "@/lib/subiekt/zd-eta-sync";
import { ZD_ETA_MOJE_CLIENT_FETCH_TIMEOUT_MS } from "@/lib/subiekt/zd-eta-sync";
import { cn } from "@/lib/cn";

/**
 * Przycisk roboczy — wymusza POST /api/sales/zd-eta-refresh (force + browse ZD).
 * Widoczny tylko gdy NEXT_PUBLIC_ZD_ETA_DEV_REFRESH=true.
 */
export function MojeZdEtaDevRefreshButton({ className }: { className?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);

  if (process.env.NEXT_PUBLIC_ZD_ETA_DEV_REFRESH !== "true") {
    return null;
  }

  const run = async () => {
    if (busy) return;
    setBusy(true);
    setLastResult(null);
    clearMojeZdEtaSessionSync();

    const controller = new AbortController();
    const timeoutId = window.setTimeout(
      () => controller.abort(),
      ZD_ETA_MOJE_CLIENT_FETCH_TIMEOUT_MS
    );

    try {
      const res = await fetch("/api/sales/zd-eta-refresh", {
        method: "POST",
        signal: controller.signal,
      });
      const body = (await res.json()) as MojeZdEtaRefreshResult & { error?: string };
      if (!res.ok) {
        setLastResult(body.error ?? `Błąd HTTP ${res.status}`);
        return;
      }
      if (body.skipped && body.reason === "subiekt_offline") {
        setLastResult("Subiekt niedostępny");
        return;
      }
      if (body.skipped && body.reason === "lock_held") {
        setLastResult("Sync już trwa — spróbuj za chwilę");
        return;
      }
      setLastResult(
        `OK: ${body.updated ?? 0} z terminem, ${body.cleared ?? 0} bez dopasowania, ${body.processed ?? 0}/${body.candidates ?? 0} przetworzonych` +
          (body.timedOut ? " (timeout)" : "")
      );
      router.refresh();
    } catch {
      setLastResult("Timeout lub błąd sieci");
    } finally {
      window.clearTimeout(timeoutId);
      setBusy(false);
    }
  };

  return (
    <div
      className={cn(
        "mb-3 flex flex-wrap items-center gap-2 rounded-md border border-amber-300/80 bg-amber-50 px-3 py-2 text-sm text-amber-950",
        className
      )}
    >
      <span className="font-medium">Dev: terminy ZD</span>
      <button
        type="button"
        onClick={() => void run()}
        disabled={busy}
        className="rounded border border-amber-500 bg-white px-2 py-1 text-xs font-medium hover:bg-amber-100 disabled:opacity-50"
      >
        {busy ? "Szukam w Subiekcie…" : "Wymuś odświeżenie terminów ZD"}
      </button>
      {lastResult ? <span className="text-xs text-amber-900">{lastResult}</span> : null}
    </div>
  );
}
