import type { ProductLineDraft } from "@/components/orders/request-product-lines";
import type { AddIndividualOrdersEntry } from "@/lib/orders/individual-request-edit";
import type { ProsbaLineStockSnapshot } from "@/lib/orders/prosba-stock-check";
import {
  extractProsbaLinesFromZkWatch,
  zkProsbaPrefillFromWatch,
} from "@/lib/orders/zk-watch-prosba-prefill";
import { MAX_BATCH_ORDER_LINES } from "@/lib/security/text-limits";
import {
  buildZkWatchLineViews,
  parseZkWatchLineChecks,
  type ZkWatchLineView,
} from "@/lib/sales/zk-watch-lines";
import type { ZkWatchOrderHints } from "@/lib/sales/zk-watch-order-link";
import {
  getZkWatchProsbaScopeLineKeys,
  isZkWatchProsbaScopeConfigured,
} from "@/lib/sales/zk-watch-prosba-scope";
import {
  zkWatchTeethDraftsReady,
  type TeethDraftRegistryLookup,
} from "@/lib/sales/zk-watch-teeth-draft";
import type { SalesZkWatch } from "@/types/database";

/**
 * Snapshot stanu z UI — pusty obiekt `{}` traktujemy jak brak (serwer pobierze Subiekt),
 * żeby nie ominąć walidacji podczas ładowania magazynu w modalu zakresu.
 */
export function resolveClientAutoProsbaStockSnapshot(
  stockByTwId?: Record<number, ProsbaLineStockSnapshot>
): Record<number, ProsbaLineStockSnapshot> | undefined {
  if (!stockByTwId || Object.keys(stockByTwId).length === 0) return undefined;
  return stockByTwId;
}

export type AutoProsbaResultCode =
  | "created"
  | "created_partial_verification"
  | "created_supplement"
  | "created_with_skipped_lines"
  | "redirect_open_prosba"
  | "skipped_already_covered"
  | "blocked_teeth_incomplete"
  | "blocked_teeth_catalog"
  | "blocked_no_lines"
  | "blocked_no_scope"
  | "blocked_watch_closed"
  | "blocked_unauthorized"
  | "blocked_batch_lock"
  | "blocked_batch_size"
  | "error_stock_ack_required"
  | "error_generic";

export type AutoProsbaBlockReason =
  | "no_effective_lines"
  | "redirect_open_prosba"
  | "skipped_already_covered"
  | "teeth_incomplete";

export type AutoProsbaBlockedCode = Exclude<
  AutoProsbaResultCode,
  | "created"
  | "created_partial_verification"
  | "created_supplement"
  | "created_with_skipped_lines"
>;

export type AutoProsbaEligibilityResult =
  | { ok: true; lineKeys: string[] }
  | { ok: false; code: AutoProsbaBlockedCode };

function hasOpenMatchingProsba(hints: ZkWatchOrderHints): boolean {
  return hints.matchingOpenRequestCount > 0;
}

/** uncoveredLineKeys ∩ scopeLineKeys — jedyna dozwolona lista kluczy do prośby. */
export function resolveAutoProsbaLineKeys(
  watch: SalesZkWatch,
  hints: Pick<ZkWatchOrderHints, "uncoveredLineKeys">,
  lineViews?: ZkWatchLineView[]
): string[] {
  const views = lineViews ?? buildZkWatchLineViews(watch);
  const scopeKeys = getZkWatchProsbaScopeLineKeys(watch, views);
  if (scopeKeys === null) return [];
  const uncovered = new Set(hints.uncoveredLineKeys);
  return scopeKeys.filter((key) => uncovered.has(key));
}

export function countAutoProsbaLineKeyGap(input: {
  selectedScopeCount: number;
  effectiveLineCount: number;
}): { selected: number; effective: number; skipped: number } {
  const selected = input.selectedScopeCount;
  const effective = input.effectiveLineCount;
  return { selected, effective, skipped: Math.max(0, selected - effective) };
}

export function deriveAutoProsbaSubmitMode(
  hints: ZkWatchOrderHints,
  lineKeys: string[]
): "new" | "supplement" {
  if (lineKeys.length === 0) return "new";
  if (hasOpenMatchingProsba(hints)) return "supplement";
  if (hints.openProsbaCoveredLineKeys.length > 0) return "supplement";
  return "new";
}

export function assessZkWatchAutoProsbaEligibility(input: {
  watch: SalesZkWatch;
  hints: ZkWatchOrderHints;
  teethRegistry: TeethDraftRegistryLookup;
  lineViews?: ZkWatchLineView[];
}): AutoProsbaEligibilityResult {
  const { watch, hints, teethRegistry, lineViews } = input;
  const views = lineViews ?? buildZkWatchLineViews(watch);

  if (watch.closed_at || watch.archived_at) {
    return { ok: false, code: "blocked_watch_closed" };
  }

  const checks = parseZkWatchLineChecks(watch.line_checks);
  if (!isZkWatchProsbaScopeConfigured(checks, views)) {
    return { ok: false, code: "blocked_no_scope" };
  }

  const lineKeys = resolveAutoProsbaLineKeys(watch, hints, views);

  if (lineKeys.length === 0) {
    if (hasOpenMatchingProsba(hints)) {
      return { ok: false, code: "redirect_open_prosba" };
    }
    return { ok: false, code: "skipped_already_covered" };
  }

  if (lineKeys.length > MAX_BATCH_ORDER_LINES) {
    return { ok: false, code: "blocked_batch_size" };
  }

  if (teethRegistry.catalogAvailable === false) {
    return { ok: false, code: "blocked_teeth_catalog" };
  }

  if (
    !zkWatchTeethDraftsReady(watch, teethRegistry, {
      lineKeys,
      requestKind: "zamowienie",
    })
  ) {
    return { ok: false, code: "blocked_teeth_incomplete" };
  }

  const lines = extractProsbaLinesFromZkWatch(watch, { lineKeys });
  if (!lines.length) {
    return { ok: false, code: "blocked_no_lines" };
  }

  return { ok: true, lineKeys };
}

/** Budowa linii do dialogów (klient) — bez side-effectów. */
export function buildClientAutoProsbaLines(input: {
  watch: SalesZkWatch;
  hints: ZkWatchOrderHints;
  teethRegistry: TeethDraftRegistryLookup;
  stockByTwId?: Record<number, ProsbaLineStockSnapshot>;
}): {
  lineKeys: string[];
  lines: ProductLineDraft[];
  blocked?: AutoProsbaBlockReason;
} {
  const { watch, hints, teethRegistry, stockByTwId } = input;

  const lineKeys = resolveAutoProsbaLineKeys(watch, hints);
  if (!lineKeys.length) {
    if (hasOpenMatchingProsba(hints)) {
      return { lineKeys: [], lines: [], blocked: "redirect_open_prosba" };
    }
    return { lineKeys: [], lines: [], blocked: "skipped_already_covered" };
  }

  const prefill = zkProsbaPrefillFromWatch(watch, {
    lineKeys,
    mode: "supplement",
    requestKind: "zamowienie",
    teethRegistry,
    stockByTwId,
  });

  if (prefill.teethDraftsIncomplete) {
    return { lineKeys: [], lines: [], blocked: "teeth_incomplete" };
  }
  if (!prefill.lines.length) {
    return { lineKeys: [], lines: [], blocked: "no_effective_lines" };
  }

  return { lineKeys, lines: prefill.lines };
}

/** Mapowanie linii prefill → entries (serwer, po enrich stock). */
export function mapAutoProsbaLinesToEntries(
  watch: SalesZkWatch,
  lines: ProductLineDraft[],
  lineKeys: string[]
): AddIndividualOrdersEntry[] {
  return lines.map((line) => ({
    salesPersonId: watch.sales_person_id,
    symbol: line.symbol,
    mikranCode: line.mikranCode,
    product: line.product,
    quantity: line.quantity,
    requestKind: "zamowienie" as const,
    clientName: line.clientName ?? watch.client_label,
    clientKhId: line.clientKhId ?? watch.client_kh_id,
    subiektTwId: line.subiektTwId ?? null,
    onHand: line.onHand ?? null,
    reserved: line.reserved ?? null,
    available: line.available ?? null,
    stockSource: line.stockSource ?? null,
    requestNote: line.requestNote?.trim() || undefined,
    sourceZkWatchId: watch.id,
    sourceZkNumber: watch.zk_number,
    sourceZkLineKeys: lineKeys,
    teethDetails: line.teethDetails ?? undefined,
  }));
}

/** Budowa entries po enrich stock (serwer) — ten sam prefill co klient. */
export function buildServerAutoProsbaEntries(input: {
  watch: SalesZkWatch;
  lineKeys: string[];
  teethRegistry: TeethDraftRegistryLookup;
  stockByTwId: Record<number, ProsbaLineStockSnapshot>;
}): AddIndividualOrdersEntry[] {
  const { watch, lineKeys, teethRegistry, stockByTwId } = input;
  const prefill = zkProsbaPrefillFromWatch(watch, {
    lineKeys,
    mode: "supplement",
    requestKind: "zamowienie",
    teethRegistry,
    stockByTwId,
  });
  return mapAutoProsbaLinesToEntries(watch, prefill.lines, lineKeys);
}

export function resolveAutoProsbaResultCodeAfterSubmit(input: {
  hints: ZkWatchOrderHints;
  lineKeys: string[];
  selectedScopeCount?: number;
  complete: number;
  verification: number;
}): AutoProsbaResultCode {
  const { hints, lineKeys, selectedScopeCount, complete, verification } = input;

  if (
    selectedScopeCount != null &&
    selectedScopeCount > lineKeys.length &&
    (complete > 0 || verification > 0)
  ) {
    return "created_with_skipped_lines";
  }

  if (verification > 0) {
    return "created_partial_verification";
  }

  if (deriveAutoProsbaSubmitMode(hints, lineKeys) === "supplement") {
    return "created_supplement";
  }

  return "created";
}
