import type { ExternalWarehousePrunedSnapshot } from "@/lib/external-warehouse/lines";
import { parsePrunedSnapshot } from "@/lib/external-warehouse/lines";

export type ExternalWarehouseRefreshDiff = {
  addedLineKeys: string[];
  removedLineKeys: string[];
  quantityChanged: { key: string; from: number | null; to: number | null }[];
};

export const EMPTY_EXTERNAL_WAREHOUSE_REFRESH_DIFF: ExternalWarehouseRefreshDiff = {
  addedLineKeys: [],
  removedLineKeys: [],
  quantityChanged: [],
};

export function computeExternalWarehouseRefreshDiff(
  previous: ExternalWarehousePrunedSnapshot | null,
  next: ExternalWarehousePrunedSnapshot | null
): ExternalWarehouseRefreshDiff {
  const prevByKey = new Map(
    (previous?.lines ?? []).map((l) => [l.key, l.ob_Ilosc])
  );
  const nextByKey = new Map((next?.lines ?? []).map((l) => [l.key, l.ob_Ilosc]));

  const addedLineKeys: string[] = [];
  const removedLineKeys: string[] = [];
  const quantityChanged: ExternalWarehouseRefreshDiff["quantityChanged"] = [];

  for (const key of nextByKey.keys()) {
    if (!prevByKey.has(key)) addedLineKeys.push(key);
  }
  for (const key of prevByKey.keys()) {
    if (!nextByKey.has(key)) removedLineKeys.push(key);
  }
  for (const [key, toQty] of nextByKey) {
    if (!prevByKey.has(key)) continue;
    const fromQty = prevByKey.get(key) ?? null;
    if (fromQty !== toQty) {
      quantityChanged.push({ key, from: fromQty, to: toQty ?? null });
    }
  }

  return { addedLineKeys, removedLineKeys, quantityChanged };
}

export function hasExternalWarehouseRefreshDiff(
  diff: ExternalWarehouseRefreshDiff
): boolean {
  return (
    diff.addedLineKeys.length > 0 ||
    diff.removedLineKeys.length > 0 ||
    diff.quantityChanged.length > 0
  );
}

export function diffFromStoredSnapshots(
  previousRaw: unknown,
  next: ExternalWarehousePrunedSnapshot
): ExternalWarehouseRefreshDiff {
  return computeExternalWarehouseRefreshDiff(
    parsePrunedSnapshot(previousRaw),
    next
  );
}

export function summarizeRefreshDiff(
  diff: ExternalWarehouseRefreshDiff,
  zkNumber: string
): string {
  const parts: string[] = [];
  if (diff.addedLineKeys.length) {
    parts.push(`+${diff.addedLineKeys.length} poz.`);
  }
  if (diff.removedLineKeys.length) {
    parts.push(`−${diff.removedLineKeys.length} poz.`);
  }
  if (diff.quantityChanged.length) {
    parts.push(`${diff.quantityChanged.length} zm. ilości`);
  }
  return `${zkNumber}: ${parts.join(", ") || "bez zmian"}`;
}
