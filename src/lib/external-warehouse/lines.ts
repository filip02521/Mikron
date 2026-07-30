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

export type ExternalWarehouseLineMetaFields = {
  pallet_label: string | null;
  note: string | null;
};

export type ExternalWarehouseLineShareInput = {
  id: string;
  pallet_label: string;
  qty: number;
  note?: string | null;
};

export type ExternalWarehouseLineDto = {
  key: string;
  /** Unikalny klucz wiersza UI (pozycja / udział / reszta). */
  rowKey: string;
  symbol: string | null;
  product: string;
  quantity: number | null;
  quantityLabel: string | null;
  palletLabel: string | null;
  note: string | null;
  orphan?: boolean;
  /** Notatka pozycji (line_meta) — widoczna też przy pełnym rozbiciu. */
  lineNote?: string | null;
  /** Id wiersza shares — gdy wiersz to konkretny udział. */
  shareId?: string | null;
  /** Ilość z ZK (cała pozycja) — przy rozbiciu. */
  lineQuantity?: number | null;
  /** Pozycja ma udziały na wielu paletach. */
  isSplit?: boolean;
  /** Reszta ilości bez palety (sum shares < qty ZK). */
  isRemainder?: boolean;
  /** Σ udziałów > qty ZK (np. po syncu zmniejszającym ilość). */
  overAllocated?: boolean;
};

function parseLineQuantity(qty: number | null | undefined): number | null {
  if (qty == null || !Number.isFinite(Number(qty))) return null;
  const n = Number(qty);
  if (n <= 0) return null;
  return n === Math.trunc(n) ? Math.trunc(n) : n;
}

export function formatLineQuantity(qty: number | null | undefined): string | null {
  if (qty == null || !Number.isFinite(Number(qty))) return null;
  const n = Number(qty);
  const label = n === Math.trunc(n) ? String(Math.trunc(n)) : String(n);
  return `${label} szt.`;
}

function roundQty(n: number): number {
  return Math.round(n * 10000) / 10000;
}

function sumShareQty(shares: { qty: number }[]): number {
  return roundQty(shares.reduce((acc, s) => acc + Number(s.qty || 0), 0));
}

function baseProductFields(line: {
  key: string;
  tw_Symbol?: string | null;
  tw_Nazwa?: string | null;
}): Pick<ExternalWarehouseLineDto, "key" | "symbol" | "product"> {
  const product = (line.tw_Nazwa ?? line.tw_Symbol ?? "Pozycja").trim();
  const symbol = line.tw_Symbol?.trim() || null;
  return {
    key: line.key,
    symbol: symbol && symbol !== product ? symbol : null,
    product: product || line.key,
  };
}

/**
 * Buduje DTO pozycji: 1 wiersz (meta.pallet) albo N udziałów + opcjonalna reszta.
 */
export function expandLineDtos(input: {
  key: string;
  tw_Symbol?: string | null;
  tw_Nazwa?: string | null;
  quantity: number | null;
  meta?: ExternalWarehouseLineMetaFields | null;
  shares?: ExternalWarehouseLineShareInput[];
  orphan?: boolean;
}): ExternalWarehouseLineDto[] {
  const base = baseProductFields({
    key: input.key,
    tw_Symbol: input.tw_Symbol,
    tw_Nazwa: input.tw_Nazwa,
  });
  const lineNote = input.meta?.note ?? null;
  const shares = [...(input.shares ?? [])].sort((a, b) =>
    a.pallet_label.localeCompare(b.pallet_label, "pl", { sensitivity: "base" })
  );
  const lineQty = input.quantity;

  if (shares.length === 0) {
    return [
      {
        ...base,
        rowKey: input.key,
        quantity: lineQty,
        quantityLabel: formatLineQuantity(lineQty),
        palletLabel: input.meta?.pallet_label ?? null,
        note: lineNote,
        orphan: input.orphan,
        shareId: null,
        lineQuantity: lineQty,
        isSplit: false,
      },
    ];
  }

  const allocated = sumShareQty(shares);
  const overAllocated =
    lineQty != null && Number.isFinite(lineQty) && allocated > lineQty + 1e-9;
  const rows: ExternalWarehouseLineDto[] = shares.map((share, index) => {
    const qty = parseLineQuantity(share.qty) ?? Number(share.qty);
    return {
      ...base,
      rowKey: `${input.key}#share:${share.id}`,
      quantity: qty,
      quantityLabel: formatLineQuantity(qty),
      palletLabel: share.pallet_label,
      note: share.note?.trim() || null,
      lineNote: index === 0 ? lineNote : null,
      orphan: input.orphan,
      shareId: share.id,
      lineQuantity: lineQty,
      isSplit: true,
      overAllocated: overAllocated || undefined,
    };
  });

  if (lineQty != null && Number.isFinite(lineQty) && !overAllocated) {
    const rem = roundQty(lineQty - allocated);
    if (rem > 1e-9) {
      rows.push({
        ...base,
        rowKey: `${input.key}#remainder`,
        quantity: rem,
        quantityLabel: formatLineQuantity(rem),
        palletLabel: null,
        note: lineNote,
        lineNote: null,
        orphan: input.orphan,
        shareId: null,
        lineQuantity: lineQty,
        isSplit: true,
        isRemainder: true,
      });
    }
  }

  return rows;
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
  metaByKey: Map<string, ExternalWarehouseLineMetaFields>,
  sharesByKey: Map<string, ExternalWarehouseLineShareInput[]> = new Map()
): ExternalWarehouseLineDto[] {
  if (!snapshot) return [];
  const out: ExternalWarehouseLineDto[] = [];
  for (const line of snapshot.lines) {
    out.push(
      ...expandLineDtos({
        key: line.key,
        tw_Symbol: line.tw_Symbol,
        tw_Nazwa: line.tw_Nazwa,
        quantity: line.ob_Ilosc,
        meta: metaByKey.get(line.key) ?? null,
        shares: sharesByKey.get(line.key) ?? [],
      })
    );
  }
  return out;
}

/** Meta / shares bez linii w snapshotcie — sekcja „Usunięte z ZK”. */
export function orphanLineDtosFromMeta(
  snapshot: ExternalWarehousePrunedSnapshot | null,
  metaRows: { line_key: string; pallet_label: string | null; note: string | null }[],
  shareRows: {
    id: string;
    line_key: string;
    pallet_label: string;
    qty: number;
    note?: string | null;
  }[] = []
): ExternalWarehouseLineDto[] {
  const live = new Set(snapshot?.lines.map((l) => l.key) ?? []);
  const metaByKey = new Map(
    metaRows
      .filter((m) => !live.has(m.line_key))
      .map((m) => [
        m.line_key,
        { pallet_label: m.pallet_label, note: m.note } satisfies ExternalWarehouseLineMetaFields,
      ])
  );
  const sharesByKey = new Map<string, ExternalWarehouseLineShareInput[]>();
  for (const s of shareRows) {
    if (live.has(s.line_key)) continue;
    const bucket = sharesByKey.get(s.line_key);
    const item = {
      id: s.id,
      pallet_label: s.pallet_label,
      qty: Number(s.qty),
      note: s.note ?? null,
    };
    if (bucket) bucket.push(item);
    else sharesByKey.set(s.line_key, [item]);
  }

  const keys = new Set([...metaByKey.keys(), ...sharesByKey.keys()]);
  const out: ExternalWarehouseLineDto[] = [];
  for (const key of keys) {
    out.push(
      ...expandLineDtos({
        key,
        tw_Nazwa: key,
        quantity: null,
        meta: metaByKey.get(key) ?? { pallet_label: null, note: null },
        shares: sharesByKey.get(key) ?? [],
        orphan: true,
      })
    );
  }
  return out;
}

export function snapshotLineKeys(
  snapshot: ExternalWarehousePrunedSnapshot | null
): Set<string> {
  return new Set(snapshot?.lines.map((l) => l.key) ?? []);
}

export function snapshotLineQty(
  snapshot: ExternalWarehousePrunedSnapshot | null,
  lineKey: string
): number | null {
  const line = snapshot?.lines.find((l) => l.key === lineKey);
  return line?.ob_Ilosc ?? null;
}
