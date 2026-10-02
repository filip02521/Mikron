import type { ExternalWarehouseRefreshDiff } from "@/lib/external-warehouse/diff";

export function externalWarehouseChangeSummary(
  kind: string,
  fallback: string
): string {
  return fallback.trim() || kind;
}

export function formatSyncDiffBanner(
  results: {
    zkNumber: string;
    diff: ExternalWarehouseRefreshDiff | null;
    error?: string | null;
    /** Pozycje z automatycznie skorygowanymi paletami. */
    rebalanced?: number;
    /** ZK podmienione na nowy dokument o tym samym numerze. */
    replacedDokId?: number;
  }[]
): {
  changes: { zkNumber: string; text: string }[];
  errors: { zkNumber: string; message: string }[];
} {
  const changes: { zkNumber: string; text: string }[] = [];
  const errors: { zkNumber: string; message: string }[] = [];

  for (const r of results) {
    if (r.error) {
      errors.push({ zkNumber: r.zkNumber, message: r.error });
      continue;
    }
    const d = r.diff;
    const parts: string[] = [];
    if (r.replacedDokId) parts.push("podpięto nowy dokument ZK o tym samym numerze");
    if (r.rebalanced) {
      parts.push(
        r.rebalanced === 1
          ? "palety 1 pozycji dopasowano do nowej ilości"
          : `palety ${r.rebalanced} pozycji dopasowano do nowej ilości`
      );
    }
    if (!d) {
      if (parts.length) changes.push({ zkNumber: r.zkNumber, text: parts.join(", ") });
      continue;
    }
    if (d.addedLineKeys.length) parts.push(`dodano ${d.addedLineKeys.length}`);
    if (d.removedLineKeys.length) parts.push(`usunięto ${d.removedLineKeys.length}`);
    if (d.quantityChanged.length) {
      parts.push(`zmieniono ilość: ${d.quantityChanged.length}`);
    }
    if (d.productChanged?.length) {
      parts.push(`zmieniono dane towaru: ${d.productChanged.length}`);
    }
    if (parts.length) {
      changes.push({ zkNumber: r.zkNumber, text: parts.join(", ") });
    }
  }

  return { changes, errors };
}

export type SyncResultLike = {
  zkNumber: string;
  status: string;
  diff: ExternalWarehouseRefreshDiff | null;
  error?: string | null;
  rebalanced?: number;
  replacedDokId?: number;
};

/** Czy wynik syncu to błąd do pokazania (offline, brak ZK w Subiekcie, inny błąd). */
export function isSyncResultError(r: Pick<SyncResultLike, "status">): boolean {
  return r.status === "error" || r.status === "unavailable" || r.status === "missing";
}

/** Komunikat po „Odśwież teraz”: co się zmieniło, co się nie udało. */
export function summarizeSyncResults(results: readonly SyncResultLike[]): {
  tone: "success" | "info" | "warning";
  title: string;
  items: string[];
} {
  const banner = formatSyncDiffBanner(
    results.map((r) => ({
      zkNumber: r.zkNumber,
      diff: r.diff,
      error: isSyncResultError(r) ? (r.error ?? r.status) : null,
      rebalanced: r.rebalanced,
      replacedDokId: r.replacedDokId,
    }))
  );
  const items = [
    ...banner.errors.map((e) => `${e.zkNumber}: ${e.message}`),
    ...banner.changes.map((c) => `${c.zkNumber}: ${c.text}`),
  ];
  const busy = results.filter((r) => r.status === "locked" || r.status === "cas_conflict").length;
  if (busy) items.push(`${busy} ZK odświeża się w innym oknie — wynik pojawi się za chwilę.`);
  if (banner.errors.length) {
    return { tone: "warning", title: "Część ZK nie zsynchronizowała się", items };
  }
  if (banner.changes.length) return { tone: "info", title: "Zaktualizowano dane z Subiekta", items };
  return {
    tone: "success",
    title: "Wszystkie ZK są aktualne",
    items: busy ? items : [`Sprawdzono ${results.length} ZK — bez zmian w Subiekcie.`],
  };
}
