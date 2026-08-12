/**
 * Szkice list zębów na ZK (przed prośbą).
 * Per lineKey, single-kind — bez dual-commit (ZK ma osobne SKU przednie/boczne).
 */
import type { ProductLineDraft } from "@/components/orders/request-product-lines";
import { isStockExemptTwId } from "@/lib/orders/teeth-stock-exempt";
import {
  buildZkWatchLineViews,
  parseZkWatchLineChecks,
  type ZkWatchLineView,
} from "@/lib/sales/zk-watch-lines";
import {
  getZkWatchProsbaScopeLineKeys,
  needsProsbaByKeyFromChecks,
  productLineViews,
} from "@/lib/sales/zk-watch-prosba-scope";
import type { ZkWatchRefreshDiff } from "@/lib/sales/zk-watch-refresh-diff";
import {
  isTeethManufacturer,
  isTeethProductLine,
  parseTeethKind,
  type TeethKind,
  type TeethLineDetail,
  type TeethManufacturer,
  type TeethProductLine,
} from "@/lib/teeth/teeth-catalog";
import { enrichTeethRegistryEntry } from "@/lib/teeth/teeth-dual-kind";
import { teethLineDetailsComplete } from "@/lib/teeth/teeth-validation";
import type { SalesZkWatch } from "@/types/database";

export type ZkTeethLineDraft = {
  lineKey: string;
  subiektTwId: number;
  teethManufacturer: TeethManufacturer | null;
  teethProductLine: TeethProductLine;
  teethKind: TeethKind;
  /** Wymagana długość listy = ZK ob_Ilosc w momencie zapisu. */
  expectedQuantity: number;
  teethDetails: TeethLineDetail[];
  updatedAt: string;
};

export type ZkTeethDraftsMap = Record<string, ZkTeethLineDraft>;

export type ZkTeethLineCandidate = {
  lineKey: string;
  view: ZkWatchLineView;
  subiektTwId: number;
  teethManufacturer: TeethManufacturer | null;
  teethProductLine: TeethProductLine | null;
  teethKind: TeethKind | null;
  /** Brak kind w rejestrze/nazwie — UI musi wymusić wybór. */
  needsKindChoice: boolean;
};

function normalizeTwId(value: unknown): number | null {
  const n = Math.trunc(Number(value));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function normalizeDetail(raw: unknown): TeethLineDetail | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const position = Math.trunc(Number(o.position));
  const color = typeof o.color === "string" ? o.color : "";
  if (!Number.isFinite(position) || position < 1 || !color.trim()) return null;
  const kind = parseTeethKind(typeof o.kind === "string" ? o.kind : null);
  const jaw =
    o.jaw === "upper" || o.jaw === "lower"
      ? o.jaw
      : null;
  const mould =
    typeof o.mould === "string"
      ? o.mould
      : typeof o.size === "string"
        ? o.size
        : null;
  return {
    position,
    color,
    ...(mould != null ? { mould } : {}),
    ...(jaw ? { jaw } : {}),
    ...(kind ? { kind } : {}),
  };
}

export function parseZkTeethDrafts(raw: unknown): ZkTeethDraftsMap {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: ZkTeethDraftsMap = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const lineKey = key.trim();
    if (!lineKey || !value || typeof value !== "object") continue;
    const o = value as Record<string, unknown>;
    const subiektTwId = normalizeTwId(o.subiektTwId);
    const productLine =
      typeof o.teethProductLine === "string" && isTeethProductLine(o.teethProductLine)
        ? o.teethProductLine
        : null;
    const kind = parseTeethKind(
      typeof o.teethKind === "string" ? o.teethKind : null
    );
    const expectedQuantity = Math.trunc(Number(o.expectedQuantity));
    if (
      subiektTwId == null ||
      !productLine ||
      !kind ||
      !Number.isFinite(expectedQuantity) ||
      expectedQuantity < 1
    ) {
      continue;
    }
    const manufacturerRaw =
      typeof o.teethManufacturer === "string" ? o.teethManufacturer : null;
    const teethManufacturer =
      manufacturerRaw && isTeethManufacturer(manufacturerRaw)
        ? manufacturerRaw
        : null;
    const detailsRaw = Array.isArray(o.teethDetails) ? o.teethDetails : [];
    const teethDetails = detailsRaw
      .map(normalizeDetail)
      .filter((d): d is TeethLineDetail => d != null)
      .map((d) => ({ ...d, kind: d.kind ?? kind }));
    const updatedAt =
      typeof o.updatedAt === "string" && o.updatedAt.trim()
        ? o.updatedAt
        : new Date(0).toISOString();
    out[lineKey] = {
      lineKey: typeof o.lineKey === "string" && o.lineKey.trim() ? o.lineKey.trim() : lineKey,
      subiektTwId,
      teethManufacturer,
      teethProductLine: productLine,
      teethKind: kind,
      expectedQuantity,
      teethDetails,
      updatedAt,
    };
  }
  return out;
}

export function serializeZkTeethDrafts(drafts: ZkTeethDraftsMap): ZkTeethDraftsMap {
  return { ...drafts };
}

export type TeethDraftRegistryLookup = {
  twIds: ReadonlySet<number>;
  manufacturerByTwId: ReadonlyMap<number, TeethManufacturer | null>;
  productLineByTwId: ReadonlyMap<number, TeethProductLine | null>;
  kindByTwId: ReadonlyMap<number, TeethKind | null>;
  nameByTwId?: ReadonlyMap<number, string | null>;
  /**
   * false = fetch katalogu się nie udał (fail-closed na bramkach).
   * true/undefined = katalog załadowany (może być pusty — wtedy brak kandydatów).
   */
  catalogAvailable?: boolean;
};

/** Linie zębowe w zakresie needs_prosba (tylko zamówienie — caller filtruje informację). */
export function collectZkTeethLineCandidates(
  watch: Pick<SalesZkWatch, "line_checks" | "subiekt_snapshot" | "line_summary">,
  registry: TeethDraftRegistryLookup,
  options?: { lineKeys?: string[] | null }
): ZkTeethLineCandidate[] {
  const views = productLineViews(buildZkWatchLineViews(watch as SalesZkWatch));
  const scopeKeys =
    options?.lineKeys !== undefined
      ? options.lineKeys
      : getZkWatchProsbaScopeLineKeys(watch, views);
  if (scopeKeys !== null && scopeKeys.length === 0) return [];
  const scopeSet = scopeKeys === null ? null : new Set(scopeKeys);

  const out: ZkTeethLineCandidate[] = [];
  for (const view of views) {
    if (scopeSet && !scopeSet.has(view.key)) continue;
    const twId = normalizeTwId(view.subiektTwId);
    if (twId == null || !isStockExemptTwId(twId, registry.twIds)) continue;

    const name =
      registry.nameByTwId?.get(twId)?.trim() || view.product.trim() || "";
    const enriched = enrichTeethRegistryEntry({
      twId,
      manufacturer: registry.manufacturerByTwId.get(twId) ?? null,
      productLine: registry.productLineByTwId.get(twId) ?? null,
      kind: registry.kindByTwId.get(twId) ?? null,
      name,
    });

    const teethManufacturer =
      enriched?.manufacturer ?? registry.manufacturerByTwId.get(twId) ?? null;
    const teethProductLine =
      enriched?.productLine ?? registry.productLineByTwId.get(twId) ?? null;
    const teethKind = enriched?.kind ?? registry.kindByTwId.get(twId) ?? null;

    out.push({
      lineKey: view.key,
      view,
      subiektTwId: twId,
      teethManufacturer,
      teethProductLine,
      teethKind,
      needsKindChoice: !teethKind || !teethProductLine,
    });
  }
  return out;
}

export function isZkTeethDraftComplete(
  draft: ZkTeethLineDraft,
  viewQuantity: number | null
): boolean {
  const expected =
    viewQuantity != null && viewQuantity > 0 ? viewQuantity : draft.expectedQuantity;
  if (expected < 1) return false;
  if (draft.expectedQuantity !== expected) return false;
  if (draft.teethDetails.length !== expected) return false;
  if (
    draft.teethDetails.some(
      (d) => d.kind != null && d.kind !== draft.teethKind
    )
  ) {
    return false;
  }
  return teethLineDetailsComplete({
    teethDetails: draft.teethDetails,
    quantity: String(expected),
    product: "",
    subiektTwId: draft.subiektTwId,
    adminProductLine: draft.teethProductLine,
    adminManufacturer: draft.teethManufacturer,
    isTeethProduct: true,
  });
}

/**
 * Czy wszystkie linie zębowe w zakresie needs_prosba mają kompletne szkice.
 * Dla informacja / brak zębów → true (nie blokuj).
 */
export function zkWatchTeethDraftsReady(
  watch: Pick<
    SalesZkWatch,
    "line_checks" | "subiekt_snapshot" | "line_summary" | "teeth_drafts"
  >,
  registry: TeethDraftRegistryLookup,
  options?: {
    lineKeys?: string[] | null;
    /** Domyślnie zamowienie — informacja nie wymaga draftów. */
    requestKind?: "zamowienie" | "informacja";
  }
): boolean {
  if (options?.requestKind === "informacja") return true;
  if (registry.catalogAvailable === false) return false;
  const candidates = collectZkTeethLineCandidates(watch, registry, {
    lineKeys: options?.lineKeys,
  });
  if (candidates.length === 0) return true;
  const drafts = parseZkTeethDrafts(watch.teeth_drafts);
  for (const c of candidates) {
    const draft = drafts[c.lineKey];
    if (!draft) return false;
    if (!isZkTeethDraftComplete(draft, c.view.quantity)) return false;
  }
  return true;
}

export function zkWatchIncompleteTeethLineKeys(
  watch: Pick<
    SalesZkWatch,
    "line_checks" | "subiekt_snapshot" | "line_summary" | "teeth_drafts"
  >,
  registry: TeethDraftRegistryLookup,
  options?: { lineKeys?: string[] | null; requestKind?: "zamowienie" | "informacja" }
): string[] {
  if (options?.requestKind === "informacja") return [];
  if (registry.catalogAvailable === false) {
    const views = productLineViews(buildZkWatchLineViews(watch as SalesZkWatch));
    if (options?.lineKeys?.length) {
      return options.lineKeys.filter((key) => views.some((v) => v.key === key));
    }
    return views.map((v) => v.key);
  }
  const candidates = collectZkTeethLineCandidates(watch, registry, {
    lineKeys: options?.lineKeys,
  });
  if (candidates.length === 0) return [];
  const drafts = parseZkTeethDrafts(watch.teeth_drafts);
  return candidates
    .filter((c) => {
      const draft = drafts[c.lineKey];
      return !draft || !isZkTeethDraftComplete(draft, c.view.quantity);
    })
    .map((c) => c.lineKey);
}

/** Merge po odświeżeniu Subiekta — zachowaj po key, usuń osierocone, invaliduj qty. */
export function mergeZkTeethDraftsAfterRefresh(
  previous: unknown,
  nextViews: ZkWatchLineView[],
  diff?: ZkWatchRefreshDiff
): ZkTeethDraftsMap {
  const prev = parseZkTeethDrafts(previous);
  const nextKeys = new Set(
    productLineViews(nextViews).map((v) => v.key)
  );
  const qtyByKey = new Map(
    productLineViews(nextViews).map((v) => [v.key, v.quantity])
  );
  const qtyChangedKeys = new Set(
    (diff?.quantityChanged ?? []).map((q) => q.key)
  );

  const out: ZkTeethDraftsMap = {};
  for (const [key, draft] of Object.entries(prev)) {
    if (!nextKeys.has(key)) continue;
    const qty = qtyByKey.get(key) ?? null;
    if (qtyChangedKeys.has(key) && qty != null && qty > 0) {
      out[key] = {
        ...draft,
        expectedQuantity: qty,
        // zachowaj details — completeness padnie jeśli length !== qty
      };
      continue;
    }
    out[key] = draft;
  }
  return out;
}

/** Usuń drafty dla kluczy pokrytych prośbą / wyłączonych z zakresu. */
export function clearZkTeethDraftsForKeys(
  previous: unknown,
  keysToClear: Iterable<string>
): ZkTeethDraftsMap {
  const prev = parseZkTeethDrafts(previous);
  const clear = new Set(keysToClear);
  if (clear.size === 0) return prev;
  const out: ZkTeethDraftsMap = {};
  for (const [key, draft] of Object.entries(prev)) {
    if (clear.has(key)) continue;
    out[key] = draft;
  }
  return out;
}

/** Drafty do usunięcia gdy scope needs_prosba=false. */
export function teethDraftKeysExcludedFromScope(
  watch: Pick<SalesZkWatch, "line_checks" | "teeth_drafts">
): string[] {
  const drafts = parseZkTeethDrafts(watch.teeth_drafts);
  const needs = needsProsbaByKeyFromChecks(
    parseZkWatchLineChecks(watch.line_checks)
  );
  return Object.keys(drafts).filter((key) => needs.get(key) === false);
}

export function upsertZkTeethDraft(
  previous: unknown,
  draft: ZkTeethLineDraft
): ZkTeethDraftsMap {
  const prev = parseZkTeethDrafts(previous);
  return {
    ...prev,
    [draft.lineKey]: {
      ...draft,
      teethDetails: draft.teethDetails.map((d, i) => ({
        ...d,
        position: i + 1,
        kind: d.kind ?? draft.teethKind,
      })),
      updatedAt: draft.updatedAt || new Date().toISOString(),
    },
  };
}

/** Nałóż szkic na linię prefill prośby. */
export function applyZkTeethDraftToProductLine(
  line: ProductLineDraft,
  draft: ZkTeethLineDraft | undefined
): ProductLineDraft {
  if (!draft) return line;
  return {
    ...line,
    subiektTwId: draft.subiektTwId,
    quantity: String(draft.expectedQuantity),
    teethManufacturer: draft.teethManufacturer,
    teethProductLine: draft.teethProductLine,
    teethKind: draft.teethKind,
    teethDetails: draft.teethDetails.map((d) => ({ ...d })),
  };
}

export function buildZkTeethDraftFromInput(input: {
  lineKey: string;
  subiektTwId: number;
  teethManufacturer: TeethManufacturer | null;
  teethProductLine: TeethProductLine;
  teethKind: TeethKind;
  expectedQuantity: number;
  teethDetails: TeethLineDetail[];
}): ZkTeethLineDraft {
  return {
    lineKey: input.lineKey,
    subiektTwId: input.subiektTwId,
    teethManufacturer: input.teethManufacturer,
    teethProductLine: input.teethProductLine,
    teethKind: input.teethKind,
    expectedQuantity: input.expectedQuantity,
    teethDetails: input.teethDetails.map((d, i) => ({
      ...d,
      position: i + 1,
      kind: input.teethKind,
    })),
    updatedAt: new Date().toISOString(),
  };
}
