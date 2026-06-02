import { randomId } from "@/lib/ensure-crypto";
import { isZkWatchShippingCostLine } from "@/lib/sales/zk-watch-lines";
import type { SubiektDocumentLine } from "@/lib/subiekt/types";
import type { ProductLineDraft } from "@/components/orders/request-product-lines";
import type { SalesZkWatch } from "@/types/database";
import { prosbaHref } from "./prosba-url";

export const ZK_PROSBA_PREFILL_STORAGE_KEY = "ontime-prosba-zk-prefill";

export type ZkProsbaPrefill = {
  clientName: string;
  clientKhId: number | null;
  zkNumber: string;
  lines: ProductLineDraft[];
};

export function extractProsbaLinesFromZkWatch(watch: SalesZkWatch): ProductLineDraft[] {
  const snap = watch.subiekt_snapshot as { dok_Pozycja?: SubiektDocumentLine[] } | null;
  const pozycje = snap?.dok_Pozycja ?? [];

  const fromSnapshot: ProductLineDraft[] = [];
  for (const line of pozycje) {
    if (isZkWatchShippingCostLine(line)) continue;
    const product = (line.tw_Nazwa ?? line.tw_Symbol ?? "").trim();
    const symbol = (line.tw_Symbol ?? "").trim();
    if (!product && !symbol) continue;
    fromSnapshot.push({
      id: randomId(),
      symbol,
      mikranCode: "",
      product: product || symbol,
      quantity: line.ob_Ilosc != null ? String(line.ob_Ilosc) : "1",
      clientName: watch.client_label,
      clientKhId: watch.client_kh_id,
      subiektTwId: line.ob_TowId ?? null,
    });
  }

  if (fromSnapshot.length > 0) return fromSnapshot;

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

export function stashZkProsbaPrefill(watch: SalesZkWatch): void {
  if (typeof sessionStorage === "undefined") return;
  const payload: ZkProsbaPrefill = {
    clientName: watch.client_label,
    clientKhId: watch.client_kh_id,
    zkNumber: watch.zk_number,
    lines: extractProsbaLinesFromZkWatch(watch),
  };
  sessionStorage.setItem(ZK_PROSBA_PREFILL_STORAGE_KEY, JSON.stringify(payload));
}

export function readZkProsbaPrefill(): ZkProsbaPrefill | null {
  if (typeof sessionStorage === "undefined") return null;
  const raw = sessionStorage.getItem(ZK_PROSBA_PREFILL_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ZkProsbaPrefill;
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

/** Minimalny prefill z URL (nowa karta / brak sessionStorage), gdy serwer nie zwróci ZK. */
export function buildProsbaPrefillFromUrlParams(options: {
  klient?: string | null;
  kh?: string | null;
  zk?: string | null;
}): ZkProsbaPrefill | null {
  const clientName = options.klient?.trim() ?? "";
  const clientKhId = parseProsbaClientKhParam(options.kh ?? null);
  const zkNumber = options.zk?.trim() ?? "";
  if (!clientName && clientKhId == null && !zkNumber) return null;

  return {
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

export function prosbaHrefFromZkWatch(watch: SalesZkWatch): string {
  return prosbaHref({
    salesPersonId: watch.sales_person_id,
    fromZk: true,
    zk: watch.zk_number,
    klient: watch.client_label,
    clientKhId: watch.client_kh_id,
  });
}
