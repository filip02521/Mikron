import type { ExternalWarehousePrunedSnapshot } from "@/lib/external-warehouse/lines";
import { parsePrunedSnapshot } from "@/lib/external-warehouse/lines";

export type ExternalWarehouseProductChange = {
  key: string;
  /** Nazwa / symbol przed i po (np. poprawiona nazwa towaru albo inny towar w tej samej pozycji). */
  from: string;
  to: string;
  /** Inny towar (ob_TowId) — nie tylko poprawiona nazwa. */
  productSwapped: boolean;
};

export type ExternalWarehouseRefreshDiff = {
  addedLineKeys: string[];
  removedLineKeys: string[];
  quantityChanged: { key: string; from: number | null; to: number | null }[];
  /** Zmiana danych towaru w tej samej pozycji ZK (opcjonalne — starsze diffy go nie mają). */
  productChanged?: ExternalWarehouseProductChange[];
};

export const EMPTY_EXTERNAL_WAREHOUSE_REFRESH_DIFF: ExternalWarehouseRefreshDiff = {
  addedLineKeys: [],
  removedLineKeys: [],
  quantityChanged: [],
  productChanged: [],
};

function productLabel(line: { tw_Nazwa: string | null; tw_Symbol: string | null }): string {
  const name = (line.tw_Nazwa ?? "").trim();
  const symbol = (line.tw_Symbol ?? "").trim();
  if (name && symbol) return `${name} (${symbol})`;
  return name || symbol;
}

export function computeExternalWarehouseRefreshDiff(
  previous: ExternalWarehousePrunedSnapshot | null,
  next: ExternalWarehousePrunedSnapshot | null
): ExternalWarehouseRefreshDiff {
  const prevByKey = new Map(
    (previous?.lines ?? []).map((l) => [l.key, l.ob_Ilosc])
  );
  const nextByKey = new Map((next?.lines ?? []).map((l) => [l.key, l.ob_Ilosc]));
  const prevLines = new Map((previous?.lines ?? []).map((l) => [l.key, l]));

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

  const productChanged: ExternalWarehouseProductChange[] = [];
  for (const line of next?.lines ?? []) {
    const prev = prevLines.get(line.key);
    if (!prev) continue;
    const from = productLabel(prev);
    const to = productLabel(line);
    const productSwapped =
      prev.ob_TowId != null && line.ob_TowId != null && prev.ob_TowId !== line.ob_TowId;
    if (from !== to || productSwapped) {
      productChanged.push({ key: line.key, from, to, productSwapped });
    }
  }

  return { addedLineKeys, removedLineKeys, quantityChanged, productChanged };
}

export function hasExternalWarehouseRefreshDiff(
  diff: ExternalWarehouseRefreshDiff
): boolean {
  return (
    diff.addedLineKeys.length > 0 ||
    diff.removedLineKeys.length > 0 ||
    diff.quantityChanged.length > 0 ||
    (diff.productChanged?.length ?? 0) > 0
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
  if (diff.productChanged?.length) {
    parts.push(`${diff.productChanged.length} zm. towaru`);
  }
  return `${zkNumber}: ${parts.join(", ") || "bez zmian"}`;
}
