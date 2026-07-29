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
    if (!d) continue;
    const parts: string[] = [];
    if (d.addedLineKeys.length) parts.push(`dodano ${d.addedLineKeys.length}`);
    if (d.removedLineKeys.length) parts.push(`usunięto ${d.removedLineKeys.length}`);
    if (d.quantityChanged.length) {
      parts.push(`zmieniono ilość: ${d.quantityChanged.length}`);
    }
    if (parts.length) {
      changes.push({ zkNumber: r.zkNumber, text: parts.join(", ") });
    }
  }

  return { changes, errors };
}
