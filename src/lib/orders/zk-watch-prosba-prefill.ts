import { randomId } from "@/lib/ensure-crypto";
import { buildZkWatchLineViews } from "@/lib/sales/zk-watch-lines";
import type { ProductLineDraft } from "@/components/orders/request-product-lines";
import {
  applyProsbaLineStockMap,
  uniqueProsbaLineTwIds,
  type ProsbaLineStockSnapshot,
} from "@/lib/orders/prosba-stock-check";
import {
  prosbaStockTwIdsKey,
  readProsbaStockCache,
} from "@/lib/orders/prosba-stock-fetch-cache";
import type { IndividualRequestKind, SalesZkWatch } from "@/types/database";
import { prosbaHref } from "./prosba-url";

export const ZK_PROSBA_PREFILL_STORAGE_KEY = "ontime-prosba-zk-prefill";

export type ZkProsbaPrefillMode = "full" | "supplement";

export type ZkProsbaPrefill = {
  zkWatchId: string | null;
  clientName: string;
  clientKhId: number | null;
  zkNumber: string;
  lines: ProductLineDraft[];
  mode?: ZkProsbaPrefillMode;
  supplementLineCount?: number;
  lineKeys?: string[];
  requestKind?: IndividualRequestKind;
};

export type ZkProsbaPrefillOptions = {
  lineKeys?: string[];
  mode?: ZkProsbaPrefillMode;
  requestKind?: IndividualRequestKind;
  /** Opcjonalny stan z Subiekta (np. z karty ZK) — dołączany do linii prefill. */
  stockByTwId?: Record<number, ProsbaLineStockSnapshot>;
};

function resolvePrefillStockMap(
  lines: ProductLineDraft[],
  stockByTwId?: Record<number, ProsbaLineStockSnapshot>
): Record<number, ProsbaLineStockSnapshot> {
  const twIds = uniqueProsbaLineTwIds(lines);
  const fromCache = twIds.length ? readProsbaStockCache(prosbaStockTwIdsKey(twIds)) : null;
  return { ...(fromCache ?? {}), ...(stockByTwId ?? {}) };
}

/** Uzupełnia linie prefill o stan magazynowy z mapy tw_Id → snapshot. */
export function enrichZkProsbaPrefillWithStock(
  prefill: ZkProsbaPrefill,
  stockByTwId?: Record<number, ProsbaLineStockSnapshot>
): ZkProsbaPrefill {
  const stock = resolvePrefillStockMap(prefill.lines, stockByTwId);
  if (!Object.keys(stock).length) return prefill;
  const { next } = applyProsbaLineStockMap(prefill.lines, stock);
  return { ...prefill, lines: next };
}

function normalizeSubiektTwId(value: unknown): number | null {
  const n = Math.trunc(Number(value));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function normalizePrefillKhId(value: unknown): number | null {
  const n = Math.trunc(Number(value));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Bezpieczny payload Server Action → klient (tylko JSON-serializowalne pola). */
export function zkProsbaPrefillFromWatch(
  watch: SalesZkWatch,
  options?: ZkProsbaPrefillOptions
): ZkProsbaPrefill {
  const lines = extractProsbaLinesFromZkWatch(watch, options).map((line) => ({
    id: String(line.id),
    symbol: String(line.symbol ?? ""),
    mikranCode: String(line.mikranCode ?? ""),
    product: String(line.product ?? ""),
    quantity: String(line.quantity ?? "1"),
    ...(line.zkQuantity != null ? { zkQuantity: line.zkQuantity } : {}),
    ...(line.clientName != null ? { clientName: String(line.clientName) } : {}),
    clientKhId: normalizePrefillKhId(line.clientKhId),
    subiektTwId: normalizeSubiektTwId(line.subiektTwId),
  }));

  const mode =
    options?.mode ??
    (options?.requestKind === "informacja"
      ? "full"
      : options?.lineKeys?.length
        ? "supplement"
        : "full");

  return enrichZkProsbaPrefillWithStock(
    {
      zkWatchId: watch.id ? String(watch.id) : null,
      clientName: String(watch.client_label ?? "").trim(),
      clientKhId: normalizePrefillKhId(watch.client_kh_id),
      zkNumber: String(watch.zk_number ?? "").trim(),
      lines,
      mode,
      ...(mode === "supplement" ? { supplementLineCount: lines.length } : {}),
      ...(options?.lineKeys?.length ? { lineKeys: [...options.lineKeys] } : {}),
      ...(options?.requestKind ? { requestKind: options.requestKind } : {}),
    },
    options?.stockByTwId
  );
}

export function extractProsbaLinesFromZkWatch(
  watch: SalesZkWatch,
  options?: Pick<ZkProsbaPrefillOptions, "lineKeys">
): ProductLineDraft[] {
  const lineKeyFilter =
    options?.lineKeys?.length ? new Set(options.lineKeys) : null;
  const lineViews = buildZkWatchLineViews(watch);
  const productViews = lineViews.filter((line) => line.key !== "summary");

  const fromSnapshot: ProductLineDraft[] = [];
  for (const view of productViews) {
    if (lineKeyFilter && !lineKeyFilter.has(view.key)) continue;
    fromSnapshot.push({
      id: randomId(),
      symbol: view.symbol ?? "",
      mikranCode: "",
      product: view.product,
      quantity: view.quantity != null ? String(view.quantity) : "1",
      zkQuantity: view.quantity != null ? view.quantity : null,
      clientName: watch.client_label,
      clientKhId: watch.client_kh_id,
      subiektTwId: normalizeSubiektTwId(view.subiektTwId),
    });
  }

  if (fromSnapshot.length > 0) return fromSnapshot;

  if (lineKeyFilter) return [];

  if (watch.line_summary?.trim()) {
    return [
      {
        id: randomId(),
        symbol: "",
        mikranCode: "",
        product: watch.line_summary.trim(),
        quantity: "1",
        clientName: watch.client_label,
        clientKhId: watch.client_kh_id,
      },
    ];
  }

  return [
    {
      id: randomId(),
      symbol: "",
      mikranCode: "",
      product: "",
      quantity: "1",
      clientName: watch.client_label,
      clientKhId: watch.client_kh_id,
    },
  ];
}

export function stashZkProsbaPrefill(
  watch: SalesZkWatch,
  options?: ZkProsbaPrefillOptions
): boolean {
  const payload = zkProsbaPrefillFromWatch(watch, options);
  if (!payload.lines.length) return false;
  if (typeof sessionStorage === "undefined") return false;
  sessionStorage.setItem(ZK_PROSBA_PREFILL_STORAGE_KEY, JSON.stringify(payload));
  return true;
}

export function readZkProsbaPrefill(): ZkProsbaPrefill | null {
  if (typeof sessionStorage === "undefined") return null;
  const raw = sessionStorage.getItem(ZK_PROSBA_PREFILL_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ZkProsbaPrefill>;
    if (!parsed?.lines?.length) return null;
    return {
      zkWatchId: parsed.zkWatchId ?? null,
      clientName: parsed.clientName ?? "",
      clientKhId: parsed.clientKhId ?? null,
      zkNumber: parsed.zkNumber ?? "",
      lines: parsed.lines.map((line) => ({
        ...line,
        subiektTwId:
          line.subiektTwId != null && Number.isFinite(Number(line.subiektTwId))
            ? Math.trunc(Number(line.subiektTwId))
            : undefined,
        onHand: line.onHand ?? undefined,
        reserved: line.reserved ?? undefined,
        available: line.available ?? undefined,
        stockSource:
          line.stockSource === "subiekt" || line.stockSource === null
            ? line.stockSource ?? undefined
            : undefined,
        zkQuantity:
          typeof line.zkQuantity === "number" && Number.isFinite(line.zkQuantity)
            ? line.zkQuantity
            : undefined,
      })),
      mode: parsed.mode,
      supplementLineCount: parsed.supplementLineCount,
      lineKeys: parsed.lineKeys,
      requestKind:
        parsed.requestKind === "informacja" || parsed.requestKind === "zamowienie"
          ? parsed.requestKind
          : undefined,
    };
  } catch {
    return null;
  }
}

export function clearZkProsbaPrefill(): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.removeItem(ZK_PROSBA_PREFILL_STORAGE_KEY);
}

export function parseProsbaClientKhParam(value: string | null | undefined): number | null {
  const n = value ? Math.trunc(Number(value)) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function parseProsbaZkLineKeysParam(value: string | null | undefined): string[] | undefined {
  if (!value?.trim()) return undefined;
  const keys = value
    .split(",")
    .map((key) => key.trim())
    .filter(Boolean);
  return keys.length ? keys : undefined;
}

/** Minimalny prefill z URL (nowa karta / brak sessionStorage), gdy serwer nie zwróci ZK. */
export function buildProsbaPrefillFromUrlParams(options: {
  klient?: string | null;
  kh?: string | null;
  zk?: string | null;
  zkWatch?: string | null;
}): ZkProsbaPrefill | null {
  const clientName = options.klient?.trim() ?? "";
  const clientKhId = parseProsbaClientKhParam(options.kh ?? null);
  const zkNumber = options.zk?.trim() ?? "";
  const zkWatchId = options.zkWatch?.trim() || null;
  if (!clientName && clientKhId == null && !zkNumber && !zkWatchId) return null;

  return {
    zkWatchId,
    clientName: clientName || zkNumber,
    clientKhId,
    zkNumber,
    lines: [
      {
        id: randomId(),
        symbol: "",
        mikranCode: "",
        product: "",
        quantity: "1",
        clientName: clientName || undefined,
        clientKhId,
      },
    ],
  };
}

export function prosbaHrefFromZkWatch(
  watch: SalesZkWatch,
  options?: Pick<ZkProsbaPrefillOptions, "lineKeys" | "requestKind">
): string {
  return prosbaHref({
    salesPersonId: watch.sales_person_id,
    fromZk: true,
    zkWatchId: watch.id,
    zk: watch.zk_number,
    klient: watch.client_label,
    clientKhId: watch.client_kh_id,
    zkLineKeys: options?.lineKeys,
    requestKind: options?.requestKind,
  });
}
