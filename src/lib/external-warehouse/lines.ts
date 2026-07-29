import { createHash } from "crypto";
import type { SubiektDocument, SubiektDocumentLine } from "@/lib/subiekt/types";
import {
  isZkWatchShippingCostLine,
  zkLineKey,
} from "@/lib/sales/zk-watch-lines";

/** Przycięta pozycja ZK — bez cen i zbędnych pól Subiekta. */
export type ExternalWarehousePrunedLine = {
  key: string;
  tw_Symbol: string | null;
  tw_Nazwa: string | null;
  ob_Ilosc: number | null;
  ob_TowId: number | null;
  ob_Id: number | null;
};

/** Przycięty snapshot dokumentu — tylko to, czego potrzebuje magazyn. */
export type ExternalWarehousePrunedSnapshot = {
  dok_Id: number;
  dok_NrPelny: string | null;
  dok_Status: number | null;
  lines: ExternalWarehousePrunedLine[];
};

export type ExternalWarehouseLineDto = {
  key: string;
  symbol: string | null;
  product: string;
  quantity: number | null;
  quantityLabel: string | null;
  palletLabel: string | null;
  note: string | null;
  orphan?: boolean;
};

function parseLineQuantity(qty: number | null | undefined): number | null {
  if (qty == null || !Number.isFinite(Number(qty))) return null;
  const n = Number(qty);
  if (n <= 0) return null;
  return n === Math.trunc(n) ? Math.trunc(n) : n;
}

function formatLineQuantity(qty: number | null | undefined): string | null {
  if (qty == null || !Number.isFinite(Number(qty))) return null;
  const n = Number(qty);
  const label = n === Math.trunc(n) ? String(Math.trunc(n)) : String(n);
  return `${label} szt.`;
}

export function isExternalWarehouseShippingCostLine(
  line: SubiektDocumentLine
): boolean {
  return isZkWatchShippingCostLine(line);
}

export function pruneSubiektZkSnapshot(
  doc: SubiektDocument
): ExternalWarehousePrunedSnapshot {
  const dokId = Math.trunc(Number(doc.dok_Id));
  const pozycje = doc.dok_Pozycja ?? [];
  const lines: ExternalWarehousePrunedLine[] = [];

  pozycje.forEach((line, index) => {
    if (isExternalWarehouseShippingCostLine(line)) return;
    const key = zkLineKey(line, index);
    lines.push({
      key,
      tw_Symbol: line.tw_Symbol?.trim() || null,
      tw_Nazwa: line.tw_Nazwa?.trim() || null,
      ob_Ilosc: parseLineQuantity(line.ob_Ilosc),
      ob_TowId:
        line.ob_TowId != null && Number.isFinite(Number(line.ob_TowId))
          ? Math.trunc(Number(line.ob_TowId))
          : null,
      ob_Id:
        line.ob_Id != null && Number.isFinite(Number(line.ob_Id))
          ? Math.trunc(Number(line.ob_Id))
          : null,
    });
  });

  return {
    dok_Id: Number.isFinite(dokId) ? dokId : 0,
    dok_NrPelny: doc.dok_NrPelny?.trim() || null,
    dok_Status: doc.dok_Status ?? null,
    lines,
  };
}

export function parsePrunedSnapshot(
  raw: unknown
): ExternalWarehousePrunedSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (!Array.isArray(obj.lines)) return null;
  const lines: ExternalWarehousePrunedLine[] = [];
  for (const item of obj.lines) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const key = typeof row.key === "string" ? row.key.trim() : "";
    if (!key) continue;
    lines.push({
      key,
      tw_Symbol: typeof row.tw_Symbol === "string" ? row.tw_Symbol : null,
      tw_Nazwa: typeof row.tw_Nazwa === "string" ? row.tw_Nazwa : null,
      ob_Ilosc: parseLineQuantity(
        typeof row.ob_Ilosc === "number" ? row.ob_Ilosc : null
      ),
      ob_TowId:
        typeof row.ob_TowId === "number" && Number.isFinite(row.ob_TowId)
          ? Math.trunc(row.ob_TowId)
          : null,
      ob_Id:
        typeof row.ob_Id === "number" && Number.isFinite(row.ob_Id)
          ? Math.trunc(row.ob_Id)
          : null,
    });
  }
  const dokId =
    typeof obj.dok_Id === "number" && Number.isFinite(obj.dok_Id)
      ? Math.trunc(obj.dok_Id)
      : 0;
  return {
    dok_Id: dokId,
    dok_NrPelny: typeof obj.dok_NrPelny === "string" ? obj.dok_NrPelny : null,
    dok_Status:
      typeof obj.dok_Status === "number" ? obj.dok_Status : null,
    lines,
  };
}

/** Hash linii (key+qty) po filtrze shipping — do CAS / skip change_log. */
export function hashExternalWarehouseLines(
  lines: Pick<ExternalWarehousePrunedLine, "key" | "ob_Ilosc">[]
): string {
  const payload = [...lines]
    .map((l) => `${l.key}:${l.ob_Ilosc ?? ""}`)
    .sort()
    .join("|");
  return createHash("sha256").update(payload).digest("hex");
}

export function lineDtosFromPrunedSnapshot(
  snapshot: ExternalWarehousePrunedSnapshot | null,
  metaByKey: Map<string, { pallet_label: string | null; note: string | null }>
): ExternalWarehouseLineDto[] {
  if (!snapshot) return [];
  return snapshot.lines.map((line) => {
    const meta = metaByKey.get(line.key);
    const product = (line.tw_Nazwa ?? line.tw_Symbol ?? "Pozycja").trim();
    const symbol = line.tw_Symbol?.trim() || null;
    return {
      key: line.key,
      symbol: symbol && symbol !== product ? symbol : null,
      product,
      quantity: line.ob_Ilosc,
      quantityLabel: formatLineQuantity(line.ob_Ilosc),
      palletLabel: meta?.pallet_label ?? null,
      note: meta?.note ?? null,
    };
  });
}

/** Meta bez linii w snapshotcie — sekcja „Usunięte z ZK”. */
export function orphanLineDtosFromMeta(
  snapshot: ExternalWarehousePrunedSnapshot | null,
  metaRows: { line_key: string; pallet_label: string | null; note: string | null }[]
): ExternalWarehouseLineDto[] {
  const live = new Set(snapshot?.lines.map((l) => l.key) ?? []);
  return metaRows
    .filter((m) => !live.has(m.line_key))
    .map((m) => ({
      key: m.line_key,
      symbol: null,
      product: m.line_key,
      quantity: null,
      quantityLabel: null,
      palletLabel: m.pallet_label,
      note: m.note,
      orphan: true,
    }));
}

export function snapshotLineKeys(
  snapshot: ExternalWarehousePrunedSnapshot | null
): Set<string> {
  return new Set(snapshot?.lines.map((l) => l.key) ?? []);
}
