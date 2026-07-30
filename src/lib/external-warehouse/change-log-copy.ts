import type { ExternalWarehousePrunedSnapshot } from "@/lib/external-warehouse/lines";
import type { ExternalWarehouseRefreshDiff } from "@/lib/external-warehouse/diff";

const MAX_DETAIL_ITEMS = 6;

function lineLabel(
  snapshot: ExternalWarehousePrunedSnapshot | null | undefined,
  key: string
): string {
  const line = snapshot?.lines.find((l) => l.key === key);
  const name = (line?.tw_Nazwa ?? "").trim();
  const symbol = (line?.tw_Symbol ?? "").trim();
  if (name) return name;
  if (symbol) return symbol;
  return key;
}

function lineQty(
  snapshot: ExternalWarehousePrunedSnapshot | null | undefined,
  key: string
): number | null {
  const line = snapshot?.lines.find((l) => l.key === key);
  return line?.ob_Ilosc ?? null;
}

function formatQty(qty: number | null | undefined): string {
  if (qty == null || !Number.isFinite(qty)) return "?";
  return qty === Math.trunc(qty) ? String(Math.trunc(qty)) : String(qty);
}

function formatQtyDelta(from: number | null, to: number | null): string {
  if (from != null && to != null && Number.isFinite(from) && Number.isFinite(to)) {
    const delta = Math.round((to - from) * 10000) / 10000;
    const signed =
      delta > 0 ? `+${formatQty(delta)}` : formatQty(delta);
    return `${formatQty(from)} → ${formatQty(to)} (${signed} szt.)`;
  }
  if (to != null) return `→ ${formatQty(to)} szt.`;
  if (from != null) return `${formatQty(from)} szt. → ?`;
  return "zmiana ilości";
}

function joinDetails(items: string[]): string {
  if (!items.length) return "";
  const shown = items.slice(0, MAX_DETAIL_ITEMS);
  const rest = items.length - shown.length;
  const body = shown.join("; ");
  return rest > 0 ? `${body}; +${rest} więcej` : body;
}

/** Rodzaje wpisów o zmianach treści ZK (sync / powiązania). */
export const GADKI_ZK_CONTENT_LOG_KINDS = new Set([
  "lines_added",
  "lines_removed",
  "qty_changed",
  "zk_linked",
  "zk_unlinked",
]);

export function isGadkiZkContentLogKind(kind: string): boolean {
  return GADKI_ZK_CONTENT_LOG_KINDS.has(kind);
}

/**
 * Buduje czytelne wpisy dziennika dla diffu syncu ZK
 * (np. „usunięto 40 szt. Towaru”, „pozycja usunięta”).
 */
export function buildZkDiffChangeLogEntries(input: {
  siteId: string;
  linkId: string;
  zkNumber: string;
  diff: ExternalWarehouseRefreshDiff;
  previous: ExternalWarehousePrunedSnapshot | null;
  next: ExternalWarehousePrunedSnapshot;
  actorUserId?: string | null;
}): {
  siteId: string;
  zkLinkId: string;
  kind: string;
  summary: string;
  meta: Record<string, unknown>;
  actorUserId?: string | null;
}[] {
  const out: {
    siteId: string;
    zkLinkId: string;
    kind: string;
    summary: string;
    meta: Record<string, unknown>;
    actorUserId?: string | null;
  }[] = [];
  const zk = input.zkNumber;

  if (input.diff.removedLineKeys.length) {
    const details = input.diff.removedLineKeys.map((key) => {
      const label = lineLabel(input.previous, key);
      const qty = lineQty(input.previous, key);
      return qty != null
        ? `„${label}” (${formatQty(qty)} szt.)`
        : `„${label}”`;
    });
    const n = input.diff.removedLineKeys.length;
    out.push({
      siteId: input.siteId,
      zkLinkId: input.linkId,
      kind: "lines_removed",
      summary:
        n === 1
          ? `${zk}: usunięto z ZK ${details[0]}`
          : `${zk}: usunięto z ZK ${n} poz. — ${joinDetails(details)}`,
      meta: {
        keys: input.diff.removedLineKeys.slice(0, 40),
        details: details.slice(0, 40),
      },
      actorUserId: input.actorUserId,
    });
  }

  if (input.diff.addedLineKeys.length) {
    const details = input.diff.addedLineKeys.map((key) => {
      const label = lineLabel(input.next, key);
      const qty = lineQty(input.next, key);
      return qty != null
        ? `„${label}” (${formatQty(qty)} szt.)`
        : `„${label}”`;
    });
    const n = input.diff.addedLineKeys.length;
    out.push({
      siteId: input.siteId,
      zkLinkId: input.linkId,
      kind: "lines_added",
      summary:
        n === 1
          ? `${zk}: dodano do ZK ${details[0]}`
          : `${zk}: dodano do ZK ${n} poz. — ${joinDetails(details)}`,
      meta: {
        keys: input.diff.addedLineKeys.slice(0, 40),
        details: details.slice(0, 40),
      },
      actorUserId: input.actorUserId,
    });
  }

  if (input.diff.quantityChanged.length) {
    const details = input.diff.quantityChanged.map((c) => {
      const label = lineLabel(input.next, c.key) || lineLabel(input.previous, c.key);
      return `„${label}” ${formatQtyDelta(c.from, c.to)}`;
    });
    const n = input.diff.quantityChanged.length;
    out.push({
      siteId: input.siteId,
      zkLinkId: input.linkId,
      kind: "qty_changed",
      summary:
        n === 1
          ? `${zk}: zmiana ilości ${details[0]}`
          : `${zk}: zmiana ilości (${n}) — ${joinDetails(details)}`,
      meta: {
        changes: input.diff.quantityChanged.slice(0, 40),
        details: details.slice(0, 40),
      },
      actorUserId: input.actorUserId,
    });
  }

  return out;
}
