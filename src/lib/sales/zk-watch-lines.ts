import type { SubiektDocument, SubiektDocumentLine } from "@/lib/subiekt/types";
import type { SalesZkWatch } from "@/types/database";

export type ZkWatchLineCheckStored = {
  key: string;
  arrived: boolean;
};

export type ZkWatchLineView = {
  key: string;
  product: string;
  symbol: string | null;
  quantityLabel: string | null;
  /** Ilość sztuk z pozycji ZK (Subiekt ob_Ilosc). */
  quantity: number | null;
  subiektTwId: number | null;
  arrived: boolean;
};

/** Pozycje usługowe (pakowanie, koszt dostawy) — nie liczą się w checkliście towaru. */
const ZK_SHIPPING_COST_SYMBOL_RE = /^KOSZTY(?:\/|$)/i;

export function isZkWatchShippingCostLine(line: SubiektDocumentLine): boolean {
  const symbol = (line.tw_Symbol ?? "").trim();
  if (symbol && ZK_SHIPPING_COST_SYMBOL_RE.test(symbol)) return true;

  const name = (line.tw_Nazwa ?? "").trim().toLowerCase();
  if (!name) return false;
  if (name.includes("pakowanie przesyłki")) return true;
  if (name.includes("koszty dostawy")) return true;
  if (name.includes("koszt") && name.includes("przesyłk")) return true;
  return false;
}

export function zkLineKey(line: SubiektDocumentLine, index: number): string {
  if (line.ob_Id != null && Number.isFinite(Number(line.ob_Id))) {
    return `ob:${Math.trunc(Number(line.ob_Id))}`;
  }
  if (line.ob_TowId != null && Number.isFinite(Number(line.ob_TowId))) {
    const sym = (line.tw_Symbol ?? "").trim().replace(/\s+/g, "_");
    return `tw:${Math.trunc(Number(line.ob_TowId))}:${sym || index}`;
  }
  return `idx:${index}`;
}

function formatLineQuantity(qty: number | null | undefined): string | null {
  if (qty == null || !Number.isFinite(Number(qty))) return null;
  const n = Number(qty);
  const label = n === Math.trunc(n) ? String(Math.trunc(n)) : String(n);
  return `${label} szt.`;
}

function parseLineQuantity(qty: number | null | undefined): number | null {
  if (qty == null || !Number.isFinite(Number(qty))) return null;
  const n = Number(qty);
  if (n <= 0) return null;
  return n === Math.trunc(n) ? Math.trunc(n) : n;
}

function lineViewFromSubiekt(
  line: SubiektDocumentLine,
  index: number,
  arrivedByKey: Map<string, boolean>
): ZkWatchLineView {
  const key = zkLineKey(line, index);
  const product = (line.tw_Nazwa ?? line.tw_Symbol ?? "Pozycja").trim();
  const symbol = line.tw_Symbol?.trim() || null;
  const quantity = parseLineQuantity(line.ob_Ilosc);
  return {
    key,
    product,
    symbol: symbol && symbol !== product ? symbol : null,
    quantityLabel: formatLineQuantity(line.ob_Ilosc),
    quantity,
    subiektTwId:
      line.ob_TowId != null && Number.isFinite(Number(line.ob_TowId))
        ? Math.trunc(Number(line.ob_TowId))
        : null,
    arrived: arrivedByKey.get(key) ?? false,
  };
}

export function parseZkWatchLineChecks(raw: unknown): ZkWatchLineCheckStored[] {
  if (!Array.isArray(raw)) return [];
  const out: ZkWatchLineCheckStored[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const key = "key" in item && typeof item.key === "string" ? item.key.trim() : "";
    if (!key) continue;
    const arrived = "arrived" in item && item.arrived === true;
    out.push({ key, arrived });
  }
  return out;
}

export function arrivedByKeyFromChecks(
  checks: ZkWatchLineCheckStored[]
): Map<string, boolean> {
  return new Map(checks.map((c) => [c.key, c.arrived]));
}

export function buildZkWatchLineViews(watch: SalesZkWatch): ZkWatchLineView[] {
  const arrivedByKey = arrivedByKeyFromChecks(parseZkWatchLineChecks(watch.line_checks));
  const snap = watch.subiekt_snapshot as SubiektDocument | null;
  const pozycje = snap?.dok_Pozycja ?? [];

  if (pozycje.length > 0) {
    return pozycje
      .filter((line) => !isZkWatchShippingCostLine(line))
      .map((line, index) => lineViewFromSubiekt(line, index, arrivedByKey));
  }

  if (watch.line_summary?.trim()) {
    const key = "summary";
    return [
      {
        key,
        product: watch.line_summary.trim(),
        symbol: null,
        quantityLabel: null,
        quantity: null,
        subiektTwId: null,
        arrived: arrivedByKey.get(key) ?? false,
      },
    ];
  }

  return [];
}

export function summarizeZkWatchLines(views: ZkWatchLineView[]): {
  total: number;
  arrived: number;
  pending: number;
} {
  const total = views.length;
  const arrived = views.filter((v) => v.arrived).length;
  return { total, arrived, pending: total - arrived };
}

/** Wszystkie pozycje towarowe oznaczone jako „na miejscu”. */
export function allZkWatchLinesArrived(views: ZkWatchLineView[]): boolean {
  const { total, arrived } = summarizeZkWatchLines(views);
  return total > 0 && arrived === total;
}

export function formatZkLinesProgress(views: ZkWatchLineView[]): string | null {
  const { total, arrived } = summarizeZkWatchLines(views);
  if (!total) return null;
  if (arrived === 0) return `${total} ${total === 1 ? "pozycja" : total < 5 ? "pozycje" : "pozycji"}`;
  return `${arrived}/${total} na miejscu`;
}

/** Krótki licznik na wierszu ZK. */
export function formatZkLinesShort(views: ZkWatchLineView[]): string | null {
  const { total, arrived } = summarizeZkWatchLines(views);
  if (!total) return null;
  return `${arrived}/${total}`;
}

/** Jedna linia podglądu na zwiniętej karcie. */
export function formatZkLinesPreview(views: ZkWatchLineView[]): string | null {
  const { total, arrived } = summarizeZkWatchLines(views);
  if (!total) return null;
  const firstPending = views.find((v) => !v.arrived);
  const first = firstPending ?? views[0];
  if (!first) return `${arrived}/${total}`;
  const name =
    first.product.length > 42 ? `${first.product.slice(0, 41).trim()}…` : first.product;
  return `${name} · ${arrived}/${total}`;
}

export function checksFromLineViews(views: ZkWatchLineView[]): ZkWatchLineCheckStored[] {
  return views.map((v) => ({ key: v.key, arrived: v.arrived }));
}

/** Po odświeżeniu z Subiekta — zachowaj stan dla pozycji o tym samym kluczu. */
export function mergeLineChecksAfterRefresh(
  previous: ZkWatchLineCheckStored[],
  nextViews: ZkWatchLineView[]
): ZkWatchLineCheckStored[] {
  const old = arrivedByKeyFromChecks(previous);
  return nextViews.map((v) => ({
    key: v.key,
    arrived: old.get(v.key) ?? false,
  }));
}
