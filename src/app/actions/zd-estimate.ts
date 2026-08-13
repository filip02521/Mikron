"use server";

import { userFacingErrorText } from "@/lib/ui/user-facing-error";
// @service-role-ok — autoryzacja requireZdEstimateAdmin(); service role z pełnym scope po warstwie aplikacji.
import { requireZdEstimateAdmin } from "@/lib/auth";
import {
  deleteZdEstimateExclusion,
  deleteZdEstimateExclusionsMany,
  fetchZdEstimateExclusions,
  updateZdEstimateExclusionNote,
  upsertZdEstimateExclusion,
  type ZdEstimateExclusionRow,
} from "@/lib/data/zd-estimate-exclusions";
import {
  deleteZdEstimateOnRequest,
  deleteZdEstimateOnRequestsMany,
  fetchZdEstimateOnRequest,
  fetchZdEstimateOnRequests,
  updateZdEstimateOnRequestNote,
  upsertZdEstimateOnRequest,
  type ZdEstimateOnRequestRow,
} from "@/lib/data/zd-estimate-on-request";
import {
  buildBakeExcludedTwIds,
  buildExtraOnlyTwIds,
  buildOrderExcludedTwIds,
  onRequestIdsToClearForExcludedTw,
  onRequestIdsToClearForTw,
  onRequestTwIdSet,
  retargetTwIdToPackIfPiece,
} from "@/lib/orders/zd-estimate-on-request";
import {
  deleteZdEstimatePackaging,
  deleteZdEstimatePackagingMany,
  fetchZdEstimatePackaging,
  upsertZdEstimatePackaging,
  type ZdEstimatePackagingRow,
} from "@/lib/data/zd-estimate-packaging";
import {
  deleteZdProductPair,
  fetchZdProductPairs,
  upsertZdProductPair,
  type ZdProductPairRow,
} from "@/lib/data/zd-product-pairs";
import {
  deleteZdProductBom,
  fetchZdProductBoms,
  upsertZdProductBom,
  type ZdProductBomRow,
} from "@/lib/data/zd-product-boms";
import { bomRowsToRefs } from "@/lib/orders/zd-estimate-bom";
import { ZD_BOM_UI } from "@/lib/orders/zd-estimate-bom-copy";
import { collectMissingZdBomTwIds } from "@/lib/orders/zd-estimate-live-refresh";
import { fetchSuppliersWithSchedules } from "@/lib/data/queries";
import { normalizeIndividualOrders } from "@/lib/data/normalize-order";
import { processIndividualFromSummary, preflightProcessIndividualGlowne } from "@/lib/services/orders";
import {
  defaultZdCreateUwagi,
  buildZdCreateApiBody,
  ensureZdCreateLinesCoverIndividualExtras,
  listZdEstimateSupplierKhIds,
  resolveZdCreateKhId,
  validateZdCreateClientLines,
} from "@/lib/orders/zd-estimate-create-zd";
import {
  buildIndividualEstimateExtras,
  collectIndividualOrderIdsForZdCreate,
  composeZdCreateUwagiWithServices,
  filterPendingOrdersByIds,
  mapIndividualOrderToPendingDto,
  type ZdEstimatePendingIndividualOrder,
} from "@/lib/orders/zd-estimate-individual";
import {
  normalizeZdEstimateBulkProducts,
  normalizeZdEstimateBulkTwIds,
  type ZdEstimateBulkProductInput,
} from "@/lib/orders/zd-estimate-bulk";
import { revalidatePath } from "next/cache";
import { matchSupplierForGroupName } from "@/lib/orders/zd-estimate-group-stock";
import {
  buildManualZdEstimateResult,
  DEFAULT_DNI_ZAPASU,
  salesWindowFromDniZapasu,
  stockPeriodToDniZapasu,
  type ManualZdEstimateResult,
} from "@/lib/orders/zd-estimate-manual";
import {
  summarizePackOrderQty,
  type PackagingLookup,
} from "@/lib/orders/zd-estimate-packaging";
import { mergeZdEstimateExcludedTwIds } from "@/lib/orders/zd-estimate-name-exclude";
import { fetchTeethProductTwIdSet } from "@/lib/data/teeth-products";
import {
  buildPairRatioByTwId,
  buildZdEstimateSnapshotLinesFromDocChecked,
  enrichSnapshotPackagingErrorMessage,
  resolveConfirmedEstimateTwIdsForLink,
} from "@/lib/orders/zd-estimate-snapshot-lines";
import {
  fetchLatestSnapshotHistoryByTwIds,
  fetchRecentZdEstimateOrderSnapshots,
  upsertZdEstimateOrderSnapshot,
  type ZdEstimateHistoryScope,
  type ZdEstimateOrderSnapshotRow,
  type ZdEstimateSnapshotScopeMode,
} from "@/lib/data/zd-estimate-order-snapshots";
import {
  fetchZdEstimateSupplierScope,
  upsertZdEstimateSupplierScope,
} from "@/lib/data/zd-estimate-supplier-scopes";
import {
  resolveZdEstimateSupplierScopeFromSources,
  type ZdEstimateScopeCandidate,
} from "@/lib/orders/zd-estimate-supplier-scope";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createSubiektOrdersZd,
  fetchSubiektOrdersLatestFsDateKey,
  fetchSubiektZdEstimateAll,
  getSubiektOrdersZd,
  searchSubiektOrdersZd,
  searchSubiektProductCechy,
  searchSubiektProductGroups,
  SubiektZdEstimateFirstPageRejectedError,
} from "@/lib/subiekt/api";
import {
  getSubiektConfigSummary,
  resolveSubiektOrdersConfig,
  shouldPersistZdEstimateOrderSnapshots,
  SUBIEKT_ORDERS_LIVE_PORT,
  SUBIEKT_ORDERS_TEST_PORT,
  requireZdEstimateSnapshotHostKind,
  type ZdEstimateSnapshotHostKind,
} from "@/lib/subiekt/config";
import {
  SubiektRequestError,
  SubiektTimeoutError,
} from "@/lib/subiekt/errors";
import { zdListItemMatchesSupplierKhIds } from "@/lib/subiekt/zd-document-kh";
import { isFulfilledZdDocumentStatus } from "@/lib/subiekt/zd-fulfillment-date";
import {
  feedbackFromException,
  getSubiektFeedback,
  type SubiektFeedback,
} from "@/lib/subiekt/feedback";
import { warsawNowParts } from "@/lib/time/warsaw";
import type { SubiektProductCecha, SubiektProductGroup } from "@/lib/subiekt/types";
import {
  assertZdEstimateFilterEcho,
  resolveZdEstimateRunScope,
  type ZdEstimateRunMode,
} from "@/lib/orders/zd-estimate-scope";

export type ZdEstimateHistoryEntryDto = {
  twId: number;
  lastOrderedQty: number;
  linkedAt: string;
};

export type ZdEstimateSupplierOption = {
  id: string;
  name: string;
  stockRaw: string | null;
  stock: number | null;
  dniZapasu: number | null;
  stockLabel: string;
  /** Główny kh_Id Subiekta — do create ZD. */
  subiektKhId: number | null;
  /** Aliasy kh (gdy brak primary — create tylko przy dokładnie 1). */
  additionalSubiektKhIds: number[];
};

export type ZdEstimateGroupOption = {
  grt_Id: number;
  grt_Nazwa: string;
  /** Dopasowana karta OnTime (zapas) — null gdy brak. */
  supplierId: string | null;
  supplierName: string | null;
  dniZapasu: number | null;
  stockLabel: string | null;
  subiektKhId: number | null;
  additionalSubiektKhIds: number[];
};

export type ZdEstimateCechaOption = {
  ctw_Id: number;
  ctw_Nazwa: string;
  supplierId: string | null;
  supplierName: string | null;
  dniZapasu: number | null;
  stockLabel: string | null;
  subiektKhId: number | null;
  additionalSubiektKhIds: number[];
};

export type ZdEstimateRunInput = {
  mode: ZdEstimateRunMode;
  /** Wymagane gdy mode === "grupa". */
  grupaId?: number | null;
  /** Wymagane gdy mode === "cecha". */
  cechaId?: number | null;
  /** Dostawca OnTime — filtr historii snapshotów (kh + aliasy). Bez → brak historii. */
  supplierId?: string | null;
  dniZapasu: number;
  /** yyyy-mm-dd — gdy brak, liczone z dniZapasu względem dziś (Warsaw). */
  dataOd?: string | null;
  dataDo?: string | null;
  zapasMin?: number;
};

export type ZdEstimateRunResult =
  | {
      ok: true;
      result: ManualZdEstimateResult;
      /** Historia snapshotów użyta w Policz (do live refresh). */
      historyByTwId: ZdEstimateHistoryEntryDto[];
      /** Wiszące prośby dostawcy (zamówienie Nowe) — merge po stronie klienta. null = fetch nieudany (nie nadpisuj UI). */
      pendingIndividuals: ZdEstimatePendingIndividualOrder[] | null;
      /** true gdy fetch próśb ucięty limitem (możliwe brakujące). */
      pendingIndividualsTruncated?: boolean;
      /** Komunikat gdy fetch próśb przy Policz się nie udał. */
      pendingIndividualsError?: string | null;
      meta: {
        pagesFetched: number;
        totalCountApi: number;
        truncated: boolean;
        ordersBaseUrl: string;
        durationMs: number;
        /** Liczba pozycji z pełnej odpowiedzi Subiekta (grupa). */
        totalFromSubiekt: number;
        /** Do zamówienia po odjęciu wykluczeń. */
        doZamowieniaCount: number;
        doZamowieniaSuma: number;
        /** Do zamówienia bez uwzględnienia wykluczeń (surowy wynik). */
        doZamowieniaCountRaw: number;
        doZamowieniaSumaRaw: number;
        excludedInGroupCount: number;
        /** Pary z brakującym partnerem po dociągnięciu. */
        pairPartnerMissingCount: number;
        pairMissingTwIds?: number[];
        /** BOM z brakującym parentem/komponentem po dociągnięciu. */
        bomMissingCount: number;
        bomMissingTwIds?: number[];
        /** Suma jednostek ZD (paczki) — spójne z UI / TSV. */
        doZamowieniaZdUnitsSuma: number;
        doZamowieniaZdUnitsSumaRaw: number;
      };
      exclusions: ZdEstimateExclusionRow[];
      onRequests: ZdEstimateOnRequestRow[];
      packaging: ZdEstimatePackagingRow[];
      productPairs: ZdProductPairRow[];
      productBoms: ZdProductBomRow[];
      /** Odświeżony katalog zębów — auto-wykluczenia. */
      teethTwIds: number[];
    }
  | {
      ok: false;
      feedback: SubiektFeedback;
      message: string;
    };

function normalizeDateKey(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  const v = value.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  return v;
}

const ZD_ESTIMATE_PENDING_INDIVIDUALS_LIMIT = 500;

/** Wiszące prośby (zamówienie Nowe) dostawcy do kreatora ZD. */
export async function fetchZdEstimatePendingIndividualOrders(
  supplierId: string
): Promise<{
  orders: ZdEstimatePendingIndividualOrder[];
  truncated: boolean;
}> {
  const id = String(supplierId ?? "").trim();
  if (!id) return { orders: [], truncated: false };
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("individual_orders")
    .select("*, sales_person:sales_people(*)")
    .eq("supplier_id", id)
    .eq("status", "Nowe")
    .or("is_teeth.is.null,is_teeth.eq.false")
    .order("action_at", { ascending: false })
    .limit(ZD_ESTIMATE_PENDING_INDIVIDUALS_LIMIT);
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  const truncated = rows.length >= ZD_ESTIMATE_PENDING_INDIVIDUALS_LIMIT;
  const ordersNorm = normalizeIndividualOrders(rows);
  const out: ZdEstimatePendingIndividualOrder[] = [];
  for (const order of ordersNorm) {
    const dto = mapIndividualOrderToPendingDto(order);
    if (dto) out.push(dto);
  }
  return { orders: out, truncated };
}

export async function actionFetchZdEstimatePendingIndividuals(
  supplierId: string
): Promise<
  | {
      ok: true;
      orders: ZdEstimatePendingIndividualOrder[];
      truncated: boolean;
    }
  | { ok: false; message: string }
> {
  await requireZdEstimateAdmin("read");
  const id = String(supplierId ?? "").trim();
  if (!id) {
    return { ok: false, message: "Brak identyfikatora dostawcy." };
  }
  try {
    const res = await fetchZdEstimatePendingIndividualOrders(id);
    return { ok: true, orders: res.orders, truncated: res.truncated };
  } catch (e) {
    return {
      ok: false,
      message:
        userFacingErrorText(e, "Nie udało się wczytać próśb indywidualnych."),
    };
  }
}

async function resolveSupplierKhIdsForHistory(
  supplierId: string | null | undefined
): Promise<
  | { ok: true; khIds: number[] }
  | { ok: false; message: string }
> {
  const id = String(supplierId ?? "").trim();
  if (!id) {
    return { ok: false, message: "Brak identyfikatora dostawcy." };
  }
  const supabase = createAdminClient();
  const { data: supplier, error } = await supabase
    .from("suppliers")
    .select("id, subiekt_kh_id")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    return { ok: false, message: error.message };
  }
  if (!supplier) {
    return { ok: false, message: "Nie znaleziono dostawcy w OnTime." };
  }
  const { data: aliases, error: aliasErr } = await supabase
    .from("supplier_subiekt_kh_aliases")
    .select("subiekt_kh_id")
    .eq("supplier_id", id);
  if (aliasErr) {
    return {
      ok: false,
      message: `Nie udało się wczytać aliasów kh dostawcy: ${aliasErr.message}`,
    };
  }
  const additional = (aliases ?? [])
    .map((r) => Math.trunc(Number((r as { subiekt_kh_id: number }).subiekt_kh_id)))
    .filter((n) => n > 0);
  const khIds = listZdEstimateSupplierKhIds({
    primaryKhId: (supplier as { subiekt_kh_id: number | null }).subiekt_kh_id,
    additionalKhIds: additional,
  });
  if (khIds.length === 0) {
    return {
      ok: false,
      message:
        "Dostawca nie ma powiązania z Subiektem (kh_Id). Uzupełnij w Administracji → Dostawcy.",
    };
  }
  return { ok: true, khIds };
}

function requireSnapshotScopeMode(
  scopeMode: ZdEstimateSnapshotScopeMode | null | undefined,
  input: { grtId?: number | null; cechaId?: number | null }
):
  | {
      ok: true;
      scopeMode: ZdEstimateSnapshotScopeMode;
      grtId: number | null;
      cechaId: number | null;
    }
  | { ok: false; message: string } {
  if (scopeMode !== "grupa" && scopeMode !== "cecha") {
    return {
      ok: false,
      message: "Zapis historii wymaga zakresu (grupa albo cecha).",
    };
  }
  if (scopeMode === "grupa") {
    const grtId =
      input.grtId != null && Number.isFinite(Number(input.grtId))
        ? Math.trunc(Number(input.grtId))
        : 0;
    if (!(grtId > 0)) {
      return { ok: false, message: "Brak grt_Id dla zakresu grupy." };
    }
    return { ok: true, scopeMode, grtId, cechaId: null };
  }
  const cechaId =
    input.cechaId != null && Number.isFinite(Number(input.cechaId))
      ? Math.trunc(Number(input.cechaId))
      : 0;
  if (!(cechaId > 0)) {
    return { ok: false, message: "Brak cecha_id dla zakresu cechy." };
  }
  return { ok: true, scopeMode, grtId: null, cechaId };
}

function historyMapToDto(
  map: Map<number, { lastOrderedQty: number; linkedAt: string }> | null
): ZdEstimateHistoryEntryDto[] {
  if (!map || map.size === 0) return [];
  return [...map.entries()].map(([twId, v]) => ({
    twId,
    lastOrderedQty: v.lastOrderedQty,
    linkedAt: v.linkedAt,
  }));
}

function historyScopeFromRun(scope: {
  mode: "grupa" | "cecha";
  grupaId?: number | null;
  cechaId?: number | null;
}): ZdEstimateHistoryScope | null {
  if (scope.mode === "grupa" && scope.grupaId != null && scope.grupaId > 0) {
    return { mode: "grupa", grtId: scope.grupaId };
  }
  if (scope.mode === "cecha" && scope.cechaId != null && scope.cechaId > 0) {
    return { mode: "cecha", cechaId: scope.cechaId };
  }
  return null;
}

function enrichGroup(
  group: { grt_Id: number; grt_Nazwa: string },
  suppliers: ZdEstimateSupplierOption[]
): ZdEstimateGroupOption {
  const matched = matchSupplierForGroupName(group.grt_Nazwa, suppliers);
  return {
    grt_Id: group.grt_Id,
    grt_Nazwa: group.grt_Nazwa,
    supplierId: matched?.id ?? null,
    supplierName: matched?.name ?? null,
    dniZapasu: matched?.dniZapasu ?? null,
    stockLabel: matched?.stockLabel ?? null,
    subiektKhId: matched?.subiektKhId ?? null,
    additionalSubiektKhIds: matched?.additionalSubiektKhIds ?? [],
  };
}

function enrichCecha(
  cecha: { ctw_Id: number; ctw_Nazwa: string },
  suppliers: ZdEstimateSupplierOption[]
): ZdEstimateCechaOption {
  const matched = matchSupplierForGroupName(cecha.ctw_Nazwa, suppliers);
  return {
    ctw_Id: cecha.ctw_Id,
    ctw_Nazwa: cecha.ctw_Nazwa,
    supplierId: matched?.id ?? null,
    supplierName: matched?.name ?? null,
    dniZapasu: matched?.dniZapasu ?? null,
    stockLabel: matched?.stockLabel ?? null,
    subiektKhId: matched?.subiektKhId ?? null,
    additionalSubiektKhIds: matched?.additionalSubiektKhIds ?? [],
  };
}

async function loadZdEstimateSupplierOptions(): Promise<
  ZdEstimateSupplierOption[]
> {
  const { formatStockPeriodCompact } = await import("@/lib/display-labels");
  const rows = await fetchSuppliersWithSchedules(undefined, { activeOnly: true });
  const aliasesBySupplier = new Map<string, number[]>();
  try {
    const supabase = createAdminClient();
    const { data: aliases, error } = await supabase
      .from("supplier_subiekt_kh_aliases")
      .select("supplier_id, subiekt_kh_id");
    if (!error) {
      for (const row of aliases ?? []) {
        const sid = String((row as { supplier_id: string }).supplier_id);
        const kh = Math.trunc(
          Number((row as { subiekt_kh_id: number }).subiekt_kh_id)
        );
        if (!(kh > 0)) continue;
        const list = aliasesBySupplier.get(sid) ?? [];
        if (!list.includes(kh)) list.push(kh);
        aliasesBySupplier.set(sid, list);
      }
    }
  } catch {
    /* aliases opcjonalne — create i tak wymaga primary lub 1 alias */
  }

  return rows.map((s) => {
    const dniZapasu = stockPeriodToDniZapasu(
      s.stock_raw,
      s.stock != null ? Number(s.stock) : null
    );
    const primaryRaw = (s as { subiekt_kh_id?: number | null }).subiekt_kh_id;
    const primary =
      primaryRaw != null && Number.isFinite(Number(primaryRaw))
        ? Math.trunc(Number(primaryRaw))
        : null;
    return {
      id: s.id,
      name: s.name,
      stockRaw: s.stock_raw ?? null,
      stock: s.stock != null ? Number(s.stock) : null,
      dniZapasu,
      stockLabel: formatStockPeriodCompact(
        s.stock_raw,
        s.stock != null ? Number(s.stock) : null
      ),
      subiektKhId: primary != null && primary > 0 ? primary : null,
      additionalSubiektKhIds: aliasesBySupplier.get(s.id) ?? [],
    };
  });
}

export async function actionZdEstimateBootstrap(): Promise<{
  configured: boolean;
  liveBaseUrl: string | null;
  ordersBaseUrl: string | null;
  ordersBlockedReason: string | null;
  ordersMessage: string | null;
  /** Port hosta ORDERS (aktualnie używany: live :5080 lub test :5082). */
  ordersPort: number | null;
  ordersHostKind: ZdEstimateSnapshotHostKind | null;
  /** true = aktualna baza live (MIKRAN na :5080). */
  ordersIsLive: boolean;
  ordersHostLabel: string | null;
  /** @deprecated alias ordersPort — zostawione dla starszego UI. */
  testPort: number;
  todayKey: string;
  /** Koniec okna FS: ostatnia FS na hoście ORDERS albo dziś. */
  salesEndKey: string;
  salesEndFromFs: boolean;
  defaultWindow: { dataOd: string; dataDo: string };
  suppliers: ZdEstimateSupplierOption[];
  quickGroups: ZdEstimateGroupOption[];
  exclusions: ZdEstimateExclusionRow[];
  /** Gdy ustawione — nie ufaj pustej liście wykluczeń (błąd odczytu). */
  exclusionsError: string | null;
  onRequests: ZdEstimateOnRequestRow[];
  onRequestsError: string | null;
  packaging: ZdEstimatePackagingRow[];
  packagingError: string | null;
  productPairs: ZdProductPairRow[];
  productPairsError: string | null;
  productBoms: ZdProductBomRow[];
  productBomsError: string | null;
  /** tw_Id z `prosba_teeth_products` — auto-wykluczenie ze szacunku. */
  teethTwIds: number[];
  /** Gdy ustawione — nie ufaj pustej liście zębów (błąd odczytu). */
  teethProductsError: string | null;
}> {
  await requireZdEstimateAdmin("read");

  const summary = getSubiektConfigSummary();
  const todayKey = warsawNowParts().dateKey;

  let salesEndKey = todayKey;
  let salesEndFromFs = false;
  if (summary.ordersConfigured) {
    const latestFs = await fetchSubiektOrdersLatestFsDateKey();
    if (latestFs) {
      salesEndKey = latestFs;
      salesEndFromFs = true;
    }
  }

  const defaultWindow = salesWindowFromDniZapasu(DEFAULT_DNI_ZAPASU, salesEndKey);

  let suppliers: ZdEstimateSupplierOption[] = [];
  try {
    suppliers = (await loadZdEstimateSupplierOptions()).sort((a, b) =>
      a.name.localeCompare(b.name, "pl")
    );
  } catch {
    suppliers = [];
  }

  let exclusions: ZdEstimateExclusionRow[] = [];
  let exclusionsError: string | null = null;
  try {
    exclusions = await fetchZdEstimateExclusions();
  } catch (e) {
    exclusionsError =
      userFacingErrorText(e, "Nie udało się wczytać listy wykluczeń.");
  }

  let onRequests: ZdEstimateOnRequestRow[] = [];
  let onRequestsError: string | null = null;
  try {
    onRequests = await fetchZdEstimateOnRequests();
  } catch (e) {
    onRequestsError =
      userFacingErrorText(e, "Nie udało się wczytać listy „tylko na prośbę”.");
  }

  let packaging: ZdEstimatePackagingRow[] = [];
  let packagingError: string | null = null;
  try {
    packaging = await fetchZdEstimatePackaging();
  } catch (e) {
    packagingError =
      userFacingErrorText(e, "Nie udało się wczytać ustawień opakowań.");
  }

  let productPairs: ZdProductPairRow[] = [];
  let productPairsError: string | null = null;
  try {
    productPairs = await fetchZdProductPairs();
  } catch (e) {
    productPairsError =
      userFacingErrorText(e, "Nie udało się wczytać par kompletów.");
  }

  let productBoms: ZdProductBomRow[] = [];
  let productBomsError: string | null = null;
  try {
    productBoms = await fetchZdProductBoms();
  } catch (e) {
    productBomsError =
      e instanceof Error ? e.message : ZD_BOM_UI.loadError;
  }

  let teethTwIds: number[] = [];
  let teethProductsError: string | null = null;
  try {
    teethTwIds = [...(await fetchTeethProductTwIdSet())].sort((a, b) => a - b);
  } catch (e) {
    teethProductsError =
      userFacingErrorText(e, "Nie udało się wczytać katalogu produktów zębowych.");
  }

  const quickGroups = [
    { grt_Id: 17, grt_Nazwa: "Falcon" },
    { grt_Id: 28, grt_Nazwa: "Ivoclar Technical" },
    { grt_Id: 3, grt_Nazwa: "Ivoclar Clinical" },
    { grt_Id: 264, grt_Nazwa: "Ivoclar DIGITAL" },
  ].map((g) => enrichGroup(g, suppliers));

  return {
    configured: summary.ordersConfigured,
    liveBaseUrl: summary.baseUrl,
    ordersBaseUrl: summary.ordersBaseUrl,
    ordersBlockedReason: summary.ordersBlockedReason,
    ordersMessage: summary.ordersMessage,
    ordersPort: summary.ordersPort,
    ordersHostKind: summary.ordersHostKind,
    ordersIsLive: summary.ordersIsLive,
    ordersHostLabel: summary.ordersHostLabel,
    testPort: summary.ordersPort ?? SUBIEKT_ORDERS_LIVE_PORT,
    todayKey,
    salesEndKey,
    salesEndFromFs,
    defaultWindow,
    suppliers,
    quickGroups,
    exclusions,
    exclusionsError,
    onRequests,
    onRequestsError,
    packaging,
    packagingError,
    productPairs,
    productPairsError,
    productBoms,
    productBomsError,
    teethTwIds,
    teethProductsError,
  };
}

export async function actionSearchZdEstimateGroups(query: string): Promise<
  | { ok: true; groups: ZdEstimateGroupOption[] }
  | { ok: false; message: string; feedback?: SubiektFeedback }
> {
  await requireZdEstimateAdmin("read");
  const q = query.trim();
  if (q.length < 1) return { ok: true, groups: [] };

  const orders = resolveSubiektOrdersConfig();
  if (!orders.ok) {
    const feedback = getSubiektFeedback("not_configured", {
      title: "Brak hosta ORDERS",
      message: orders.message,
      hint: `Ustaw SUBIEKT_API_ORDERS_BASE_URL na :${SUBIEKT_ORDERS_LIVE_PORT} (live) lub :${SUBIEKT_ORDERS_TEST_PORT} (test).`,
    });
    return { ok: false, message: orders.message, feedback };
  }

  try {
    const suppliers = await loadZdEstimateSupplierOptions();
    const { data } = await searchSubiektProductGroups({
      search: q,
      page: 1,
      pageSize: 40,
    });
    const groups = (data ?? [])
      .map((g: SubiektProductGroup) =>
        enrichGroup(
          {
            grt_Id: Number(g.grt_Id),
            grt_Nazwa: String(g.grt_Nazwa ?? "").trim() || `Grupa ${g.grt_Id}`,
          },
          suppliers
        )
      )
      .filter((g) => Number.isFinite(g.grt_Id) && g.grt_Id > 0);
    return { ok: true, groups };
  } catch (e) {
    const feedback = feedbackFromException(e);
    return { ok: false, message: feedback.message, feedback };
  }
}

export async function actionSearchZdEstimateCechy(query: string): Promise<
  | { ok: true; cechy: ZdEstimateCechaOption[] }
  | { ok: false; message: string; feedback?: SubiektFeedback }
> {
  await requireZdEstimateAdmin("read");
  const q = query.trim();
  if (q.length < 1) return { ok: true, cechy: [] };

  const orders = resolveSubiektOrdersConfig();
  if (!orders.ok) {
    const feedback = getSubiektFeedback("not_configured", {
      title: "Brak hosta ORDERS",
      message: orders.message,
      hint: `Ustaw SUBIEKT_API_ORDERS_BASE_URL na :${SUBIEKT_ORDERS_LIVE_PORT} (live) lub :${SUBIEKT_ORDERS_TEST_PORT} (test).`,
    });
    return { ok: false, message: orders.message, feedback };
  }

  try {
    const suppliers = await loadZdEstimateSupplierOptions();
    const { data } = await searchSubiektProductCechy({
      search: q,
      page: 1,
      pageSize: 40,
    });
    const cechy = (data ?? [])
      .map((c: SubiektProductCecha) =>
        enrichCecha(
          {
            ctw_Id: Number(c.ctw_Id),
            ctw_Nazwa:
              String(c.ctw_Nazwa ?? "").trim() || `Cecha ${c.ctw_Id}`,
          },
          suppliers
        )
      )
      .filter((c) => Number.isFinite(c.ctw_Id) && c.ctw_Id > 0);
    return { ok: true, cechy };
  } catch (e) {
    const feedback = feedbackFromException(e);
    return { ok: false, message: feedback.message, feedback };
  }
}

export async function actionRunZdEstimateManual(
  input: ZdEstimateRunInput
): Promise<ZdEstimateRunResult> {
  await requireZdEstimateAdmin("read");

  const orders = resolveSubiektOrdersConfig();
  if (!orders.ok) {
    const feedback = getSubiektFeedback("not_configured", {
      title: "Brak hosta ORDERS",
      message: orders.message,
      hint: `Ustaw SUBIEKT_API_ORDERS_BASE_URL na :${SUBIEKT_ORDERS_LIVE_PORT} (live / aktualna baza) lub :${SUBIEKT_ORDERS_TEST_PORT} (test).`,
    });
    return { ok: false, message: orders.message, feedback };
  }

  const scope = resolveZdEstimateRunScope({
    mode: input.mode,
    grupaId: input.grupaId,
    cechaId: input.cechaId,
  });
  if (!scope.ok) {
    const feedback = getSubiektFeedback("empty_query", {
      title: scope.title,
      message: scope.message,
    });
    return { ok: false, message: feedback.message, feedback };
  }

  const dniZapasu = Math.round(Number(input.dniZapasu));
  if (!Number.isFinite(dniZapasu) || dniZapasu < 1 || dniZapasu > 730) {
    const feedback = getSubiektFeedback("empty_query", {
      title: "Niepoprawny zapas",
      message: "Okres zapasu (dni) musi być w zakresie 1–730.",
    });
    return { ok: false, message: feedback.message, feedback };
  }

  const todayKey = warsawNowParts().dateKey;
  let dataDo = normalizeDateKey(input.dataDo) ?? todayKey;
  let dataOd =
    normalizeDateKey(input.dataOd) ??
    salesWindowFromDniZapasu(dniZapasu, dataDo).dataOd;

  if (dataOd > dataDo) {
    const tmp = dataOd;
    dataOd = dataDo;
    dataDo = tmp;
  }

  const zapasMin = Math.max(0, Number(input.zapasMin) || 0);
  const started = Date.now();

  try {
    // Pełna lista towarów zakresu z Subiekta (nie tylko braki API / nie nasza baza).
    // Echo filtra zaraz po 1. stronie — bez tego stary API mógłby dociągnąć cały katalog.
    const fetched = await fetchSubiektZdEstimateAll(
      {
        ...(scope.mode === "grupa"
          ? { grupaId: scope.grupaId }
          : { cechaId: scope.cechaId }),
        dniZapasu,
        dataOd,
        dataDo,
        zapasMin: zapasMin > 0 ? zapasMin : undefined,
        tylkoBraki: false,
      },
      {
        validateFirstPage: ({ parametry }) =>
          assertZdEstimateFilterEcho({
            mode: scope.mode,
            expectedGrupaId: scope.grupaId,
            expectedCechaId: scope.cechaId,
            parametry,
          }),
      }
    );
    const twIds = fetched.pozycje.map((p) => Number(p.tw_Id) || 0);
    let historyByTwId: Map<
      number,
      { lastOrderedQty: number; linkedAt: string }
    > | null = null;
    const khResolve = await resolveSupplierKhIdsForHistory(input.supplierId);
    const supplierKhIds = khResolve.ok ? khResolve.khIds : [];
    const historyScope = historyScopeFromRun(scope);
    const hostKind = requireZdEstimateSnapshotHostKind(orders.config.baseUrl);
    const historyFilters =
      supplierKhIds.length > 0 && historyScope
        ? {
            supplierKhIds,
            scope: historyScope,
            hostKind,
          }
        : null;
    if (historyFilters) {
      // Zawsze materializuj Mapę przy ważnych filtrach — nawet pustą —
      // żeby drugi fetch (partner/BOM) nie został pominięty.
      historyByTwId = new Map();
      try {
        const snapLines = await fetchLatestSnapshotHistoryByTwIds(
          twIds,
          historyFilters
        );
        for (const [twId, row] of snapLines) {
          historyByTwId.set(twId, {
            lastOrderedQty: row.qty,
            linkedAt: row.linkedAt,
          });
        }
      } catch {
        // Historia opcjonalna — szacunek działa bez snapshotów.
        historyByTwId = null;
      }
    }

    let exclusions: ZdEstimateExclusionRow[];
    try {
      exclusions = await fetchZdEstimateExclusions();
    } catch (e) {
      const message =
        userFacingErrorText(e, "Nie udało się wczytać listy wykluczeń.");
      const feedback = getSubiektFeedback("empty_query", {
        title: "Wykluczenia niedostępne",
        message: `Lista nie została pokazana — bez wykluczeń mogłaby zawierać produkty celowo pomijane. ${message}`,
        hint: "Odśwież stronę lub spróbuj ponownie za chwilę.",
      });
      return { ok: false, message: feedback.message, feedback };
    }

    let onRequests: ZdEstimateOnRequestRow[];
    try {
      onRequests = await fetchZdEstimateOnRequests();
    } catch (e) {
      const message =
        userFacingErrorText(e, "Nie udało się wczytać listy „tylko na prośbę”.");
      const feedback = getSubiektFeedback("empty_query", {
        title: "Lista „tylko na prośbę” niedostępna",
        message: `Lista nie została pokazana — bez flagi mogłyby wejść produkty zamawiane wyłącznie na prośbę. ${message}`,
        hint: "Odśwież stronę lub spróbuj ponownie za chwilę.",
      });
      return { ok: false, message: feedback.message, feedback };
    }

    let packaging: ZdEstimatePackagingRow[];
    try {
      packaging = await fetchZdEstimatePackaging();
    } catch (e) {
      const message =
        userFacingErrorText(e, "Nie udało się wczytać ustawień opakowań.");
      const feedback = getSubiektFeedback("empty_query", {
        title: "Opakowania niedostępne",
        message: `Lista nie została pokazana — bez opakowań qty ZD mogłoby być w sztukach zamiast paczek. ${message}`,
        hint: "Odśwież stronę lub spróbuj ponownie za chwilę.",
      });
      return { ok: false, message: feedback.message, feedback };
    }

    let productPairs: ZdProductPairRow[];
    try {
      productPairs = await fetchZdProductPairs();
    } catch (e) {
      const message =
        userFacingErrorText(e, "Nie udało się wczytać mapy par montaż/demontaż.");
      const feedback = getSubiektFeedback("empty_query", {
        title: "Pary kompletów niedostępne",
        message: `Lista nie została pokazana — bez mapy par pack i piece mogłyby dostać niezależne qty (podwójne zamówienie). ${message}`,
        hint: "Odśwież stronę lub spróbuj ponownie za chwilę.",
      });
      return { ok: false, message: feedback.message, feedback };
    }

    let productBoms: ZdProductBomRow[];
    try {
      productBoms = await fetchZdProductBoms();
    } catch (e) {
      const message =
        e instanceof Error ? e.message : ZD_BOM_UI.loadError;
      const feedback = getSubiektFeedback("empty_query", {
        title: ZD_BOM_UI.estimateBlockedTitle,
        message: ZD_BOM_UI.estimateBlockedMessage(message),
        hint: "Odśwież stronę lub spróbuj ponownie za chwilę.",
      });
      return { ok: false, message: feedback.message, feedback };
    }

    let teethTwIds: number[];
    try {
      teethTwIds = [...(await fetchTeethProductTwIdSet())];
    } catch (e) {
      const message =
        userFacingErrorText(e, "Nie udało się wczytać katalogu produktów zębowych.");
      const feedback = getSubiektFeedback("empty_query", {
        title: "Produkty zębowe niedostępne",
        message: `Lista nie została pokazana — bez katalogu zębów pozycje zębowe mogłyby trafić na ZD. ${message}`,
        hint: "Odśwież stronę lub sprawdź tabelę produktów zębowych w adminie.",
      });
      return { ok: false, message: feedback.message, feedback };
    }

    const bomRefs = bomRowsToRefs(productBoms);

    const presentTw = new Set(
      fetched.pozycje.map((p) => Math.trunc(Number(p.tw_Id) || 0)).filter((id) => id > 0)
    );
    const missingPartnerTwIds = new Set<number>();
    const partnerIdsToFetch: number[] = [];
    for (const pair of productPairs) {
      const hasPack = presentTw.has(pair.packTwId);
      const hasPiece = presentTw.has(pair.pieceTwId);
      if (hasPack === hasPiece) continue;
      const need = hasPack ? pair.pieceTwId : pair.packTwId;
      if (!partnerIdsToFetch.includes(need)) partnerIdsToFetch.push(need);
      missingPartnerTwIds.add(need);
    }

    const bomIdsToFetch = collectMissingZdBomTwIds(
      fetched.pozycje.map((p) => ({ tw_Id: Math.trunc(Number(p.tw_Id) || 0) })),
      bomRefs
    );
    const missingBomTwIds = new Set<number>(bomIdsToFetch);

    let pendingIndividuals: ZdEstimatePendingIndividualOrder[] | null = null;
    let pendingIndividualsTruncated = false;
    let pendingIndividualsError: string | null = null;
    const individualTwIdsToFetch: number[] = [];
    const supplierIdForIndividuals = String(input.supplierId ?? "").trim();
    if (supplierIdForIndividuals) {
      try {
        const pendingRes = await fetchZdEstimatePendingIndividualOrders(
          supplierIdForIndividuals
        );
        pendingIndividuals = pendingRes.orders;
        pendingIndividualsTruncated = pendingRes.truncated;
        if (pendingIndividuals.length) {
          const mikranByTw = new Map<number, string>();
          for (const p of fetched.pozycje) {
            const tw = Math.trunc(Number(p.tw_Id) || 0);
            const plu = String(
              (p as { tw_PLU?: unknown }).tw_PLU ??
                (p as { Tw_PLU?: unknown }).Tw_PLU ??
                ""
            ).trim();
            if (tw > 0 && plu) mikranByTw.set(tw, plu);
          }
          const previewExtras = buildIndividualEstimateExtras({
            orders: pendingIndividuals,
            lines: fetched.pozycje.map((p) => ({
              tw_Id: Math.trunc(Number(p.tw_Id) || 0),
              tw_Symbol: String(p.tw_Symbol ?? ""),
              tw_Nazwa: String(p.tw_Nazwa ?? ""),
            })),
            pairs: productPairs,
            boms: bomRefs,
            teethTwIds,
            mikranByTw,
          });
          for (const tw of previewExtras.twIdsToFetch) {
            if (!individualTwIdsToFetch.includes(tw)) {
              individualTwIdsToFetch.push(tw);
            }
          }
        }
      } catch (e) {
        pendingIndividuals = null;
        pendingIndividualsTruncated = false;
        pendingIndividualsError =
          e instanceof Error
            ? `Nie wczytano próśb przy Policz: ${e.message}`
            : "Nie wczytano próśb przy Policz.";
      }
    } else {
      pendingIndividuals = [];
    }

    const idsToFetch = [
      ...new Set([
        ...partnerIdsToFetch,
        ...bomIdsToFetch,
        ...individualTwIdsToFetch,
      ]),
    ];

    const mergedPozycje = [...fetched.pozycje];
    for (const towarId of idsToFetch) {
      try {
        const one = await fetchSubiektZdEstimateAll({
          towarId,
          dniZapasu,
          dataOd,
          dataDo,
          zapasMin: zapasMin > 0 ? zapasMin : undefined,
          tylkoBraki: false,
          maxPages: 2,
        });
        for (const row of one.pozycje) {
          const id = Math.trunc(Number(row.tw_Id) || 0);
          if (!(id > 0) || presentTw.has(id)) continue;
          mergedPozycje.push(row);
          presentTw.add(id);
          missingPartnerTwIds.delete(id);
          missingBomTwIds.delete(id);
        }
      } catch {
        // zostaje w missing*
      }
    }

    // odśwież historię dla partnerów / BOM
    if (historyByTwId && historyFilters && idsToFetch.length) {
      try {
        const more = await fetchLatestSnapshotHistoryByTwIds(
          idsToFetch,
          historyFilters
        );
        for (const [twId, row] of more) {
          historyByTwId.set(twId, {
            lastOrderedQty: row.qty,
            linkedAt: row.linkedAt,
          });
        }
      } catch {
        /* ignore */
      }
    }

    const packagingByTwId = new Map<number, { unitsPerPackage: number }>();
    for (const row of packaging) {
      packagingByTwId.set(row.subiektTwId, {
        unitsPerPackage: row.unitsPerPackage,
      });
    }

    const onRequestIds = onRequestTwIdSet(onRequests, productPairs);
    const hardBasePreview = mergeZdEstimateExcludedTwIds(
      mergedPozycje.map((p) => ({
        tw_Id: Number(p.tw_Id) || 0,
        tw_Nazwa: String(p.tw_Nazwa ?? ""),
        tw_Symbol: String(p.tw_Symbol ?? ""),
      })),
      exclusions.map((e) => e.subiektTwId),
      { teethTwIds }
    );
    const bakeExcludedPreview = buildBakeExcludedTwIds(
      hardBasePreview,
      onRequestIds
    );

    const result = buildManualZdEstimateResult(
      fetched.parametry,
      mergedPozycje,
      {
        onlyManualBraki: false,
        historyByTwId,
        packagingByTwId,
        productPairs,
        productBoms: bomRefs,
        missingPartnerTwIds,
        missingBomTwIds,
        excludedTwIds: bakeExcludedPreview,
        zapasMin,
      }
    );

    const hardBase = mergeZdEstimateExcludedTwIds(
      result.pozycje,
      exclusions.map((e) => e.subiektTwId),
      { teethTwIds }
    );
    const packagingLookup = new Map<number, PackagingLookup>();
    for (const row of packaging) {
      packagingLookup.set(row.subiektTwId, {
        unitsPerPackage: row.unitsPerPackage,
        packageLabel: row.packageLabel,
      });
    }
    for (const pair of productPairs) {
      const existing = packagingLookup.get(pair.packTwId);
      packagingLookup.set(pair.packTwId, {
        unitsPerPackage: pair.unitsPerPack,
        packageLabel: existing?.packageLabel ?? "op.",
      });
    }
    const individualExtraLookup = (() => {
      if (!pendingIndividuals?.length) return null;
      const mikranByTw = new Map<number, string>();
      for (const p of result.pozycje) {
        const plu = String(p.tw_PLU ?? "").trim();
        if (p.tw_Id > 0 && plu) mikranByTw.set(p.tw_Id, plu);
      }
      const extras = buildIndividualEstimateExtras({
        orders: pendingIndividuals,
        lines: result.pozycje,
        pairs: productPairs,
        boms: bomRefs,
        teethTwIds,
        mikranByTw,
      });
      const map = new Map<number, number>();
      for (const [tw, extra] of extras.byTwId) {
        if (extra.extraPieces > 0) map.set(tw, extra.extraPieces);
      }
      return map.size ? map : null;
    })();
    const extraOnlyTwIds = buildExtraOnlyTwIds(
      onRequestIds,
      individualExtraLookup
    );
    const orderExcluded = buildOrderExcludedTwIds(
      hardBase,
      onRequestIds,
      extraOnlyTwIds
    );

    const packAfter = summarizePackOrderQty(
      result.pozycje,
      packagingLookup,
      orderExcluded,
      individualExtraLookup,
      null,
      extraOnlyTwIds
    );
    // Surowy KPI: bez wykluczeń i bez trybu extra_only (pełny stock+extra).
    const packRaw = summarizePackOrderQty(
      result.pozycje,
      packagingLookup,
      null,
      individualExtraLookup,
      null,
      null
    );
    // Jak filtr „Wykluczone” w UI — orderExcluded (soft bez prośby + hard), nie bake.
    const excludedInGroupCount = result.pozycje.filter((p) =>
      orderExcluded.has(p.tw_Id)
    ).length;

    return {
      ok: true,
      result,
      historyByTwId: historyMapToDto(historyByTwId),
      pendingIndividuals,
      pendingIndividualsTruncated,
      pendingIndividualsError,
      exclusions,
      onRequests,
      packaging,
      productPairs,
      productBoms,
      teethTwIds,
      meta: {
        pagesFetched: fetched.pagesFetched,
        totalCountApi: fetched.totalCountApi,
        truncated: fetched.truncated,
        ordersBaseUrl: orders.config.baseUrl,
        durationMs: Date.now() - started,
        totalFromSubiekt: result.totalFromSubiekt,
        doZamowieniaCount: packAfter.doZamowieniaCount,
        doZamowieniaSuma: packAfter.zdUnitsSuma,
        doZamowieniaCountRaw: packRaw.doZamowieniaCount,
        doZamowieniaSumaRaw: packRaw.zdUnitsSuma,
        doZamowieniaZdUnitsSuma: packAfter.zdUnitsSuma,
        doZamowieniaZdUnitsSumaRaw: packRaw.zdUnitsSuma,
        excludedInGroupCount,
        pairPartnerMissingCount: missingPartnerTwIds.size,
        pairMissingTwIds: [...missingPartnerTwIds],
        bomMissingCount: missingBomTwIds.size,
        bomMissingTwIds: [...missingBomTwIds],
      },
    };
  } catch (e) {
    if (e instanceof SubiektZdEstimateFirstPageRejectedError) {
      const feedback = getSubiektFeedback("empty_query", {
        title: e.title,
        message: e.message,
        hint: "Odśwież API ORDERS (live :5080 / test :5082) albo wybierz inny zakres.",
      });
      return { ok: false, message: feedback.message, feedback };
    }
    const feedback = feedbackFromException(e);
    if (feedback.code === "timeout") {
      return {
        ok: false,
        message: feedback.message,
        feedback: {
          ...feedback,
          title: "Przekroczono czas oczekiwania szacunku",
          message:
            "Budowanie listy do zamówienia trwało zbyt długo (limit czasu API lub serwera).",
          hint: "Spróbuj ponownie albo zawęź zakres. Duże cechy mogą wymagać kilku minut — strona ma limit ~3 min.",
        },
      };
    }
    return {
      ok: false,
      message: feedback.message,
      feedback,
    };
  }
}


async function clearOnRequestRowsForTwIds(twIds: number[]): Promise<void> {
  const pairs = await fetchZdProductPairs();
  const ids = new Set<number>();
  for (const twId of twIds) {
    for (const id of onRequestIdsToClearForTw(twId, pairs)) ids.add(id);
  }
  if (ids.size) await deleteZdEstimateOnRequestsMany([...ids]);
}

/** Hard exclude — nie zdejmuj flagi packa przy wykluczeniu piece. */
async function clearOnRequestRowsForExcludedTwIds(
  twIds: number[]
): Promise<void> {
  const pairs = await fetchZdProductPairs();
  const ids = new Set<number>();
  for (const twId of twIds) {
    for (const id of onRequestIdsToClearForExcludedTw(twId, pairs)) {
      ids.add(id);
    }
  }
  if (ids.size) await deleteZdEstimateOnRequestsMany([...ids]);
}

export type ZdEstimateExclusionActionResult =
  | { ok: true; exclusions: ZdEstimateExclusionRow[] }
  | { ok: false; message: string };

export async function actionListZdEstimateExclusions(): Promise<ZdEstimateExclusionActionResult> {
  await requireZdEstimateAdmin("read");
  try {
    const exclusions = await fetchZdEstimateExclusions();
    return { ok: true, exclusions };
  } catch (e) {
    return {
      ok: false,
      message: userFacingErrorText(e, "Nie udało się pobrać wykluczeń."),
    };
  }
}

export async function actionListZdEstimateTeethTwIds(): Promise<
  | { ok: true; teethTwIds: number[] }
  | { ok: false; message: string }
> {
  await requireZdEstimateAdmin("read");
  try {
    const teethTwIds = [...(await fetchTeethProductTwIdSet())].sort(
      (a, b) => a - b
    );
    return { ok: true, teethTwIds };
  } catch (e) {
    return {
      ok: false,
      message:
        userFacingErrorText(e, "Nie udało się pobrać katalogu produktów zębowych."),
    };
  }
}

export async function actionExcludeZdEstimateProduct(input: {
  subiektTwId: number;
  twSymbol?: string | null;
  twNazwa: string;
  grtId?: number | null;
  grtNazwa?: string | null;
  note?: string;
}): Promise<ZdEstimateExclusionActionResult> {
  const user = await requireZdEstimateAdmin("mutate");
  try {
    await upsertZdEstimateExclusion({
      subiektTwId: input.subiektTwId,
      twSymbol: input.twSymbol,
      twNazwa: input.twNazwa,
      grtId: input.grtId,
      grtNazwa: input.grtNazwa,
      note: input.note,
      createdBy: user.id,
    });
    // Mutual exclusivity — hard exclude wygrywa; nie kasuj flagi packa przy piece.
    try {
      await clearOnRequestRowsForExcludedTwIds([input.subiektTwId]);
    } catch {
      /* ignore — brak wpisu / race */
    }
    const exclusions = await fetchZdEstimateExclusions();
    return { ok: true, exclusions };
  } catch (e) {
    return {
      ok: false,
      message:
        userFacingErrorText(e, "Nie udało się wykluczyć produktu."),
    };
  }
}

export async function actionRestoreZdEstimateProduct(
  subiektTwId: number
): Promise<ZdEstimateExclusionActionResult> {
  await requireZdEstimateAdmin("mutate");
  try {
    await deleteZdEstimateExclusion(subiektTwId);
    const exclusions = await fetchZdEstimateExclusions();
    return { ok: true, exclusions };
  } catch (e) {
    return {
      ok: false,
      message:
        userFacingErrorText(e, "Nie udało się przywrócić produktu."),
    };
  }
}

export async function actionUpdateZdEstimateExclusionNote(input: {
  subiektTwId: number;
  note: string;
}): Promise<ZdEstimateExclusionActionResult> {
  await requireZdEstimateAdmin("mutate");
  try {
    await updateZdEstimateExclusionNote({
      subiektTwId: input.subiektTwId,
      note: input.note,
    });
    const exclusions = await fetchZdEstimateExclusions();
    return { ok: true, exclusions };
  } catch (e) {
    return {
      ok: false,
      message:
        userFacingErrorText(e, "Nie udało się zapisać notatki."),
    };
  }
}

export type ZdEstimateOnRequestActionResult =
  | { ok: true; onRequests: ZdEstimateOnRequestRow[] }
  | { ok: false; message: string };

export type ZdEstimateBulkOnRequestActionResult =
  | {
      ok: true;
      onRequests: ZdEstimateOnRequestRow[];
      succeededTwIds: number[];
      failed: ZdEstimateBulkFailure[];
      truncated: boolean;
    }
  | { ok: false; message: string };

async function resolveOnRequestUpsertTarget(input: {
  subiektTwId: number;
  twSymbol?: string | null;
  twNazwa: string;
  grtId?: number | null;
  grtNazwa?: string | null;
}): Promise<{
  subiektTwId: number;
  twSymbol: string | null;
  twNazwa: string;
  grtId: number | null;
  grtNazwa: string | null;
}> {
  const pairs = await fetchZdProductPairs();
  const hit = retargetTwIdToPackIfPiece(input.subiektTwId, pairs);
  if (!hit.retargeted || !hit.pair) {
    return {
      subiektTwId: Math.trunc(input.subiektTwId),
      twSymbol: input.twSymbol?.trim() || null,
      twNazwa: input.twNazwa,
      grtId: input.grtId ?? null,
      grtNazwa: input.grtNazwa ?? null,
    };
  }
  const pair = pairs.find(
    (p) =>
      p.packTwId === hit.pair!.packTwId && p.pieceTwId === hit.pair!.pieceTwId
  );
  return {
    subiektTwId: hit.twId,
    twSymbol: (pair?.packSymbol ?? input.twSymbol?.trim()) || null,
    twNazwa: pair?.packNazwa?.trim() || input.twNazwa,
    grtId: input.grtId ?? null,
    grtNazwa: input.grtNazwa ?? null,
  };
}

export async function actionListZdEstimateOnRequests(): Promise<ZdEstimateOnRequestActionResult> {
  await requireZdEstimateAdmin("read");
  try {
    const onRequests = await fetchZdEstimateOnRequests();
    return { ok: true, onRequests };
  } catch (e) {
    return {
      ok: false,
      message:
        userFacingErrorText(e, "Nie udało się pobrać listy „tylko na prośbę”."),
    };
  }
}

export async function actionMarkZdEstimateOnRequest(input: {
  subiektTwId: number;
  twSymbol?: string | null;
  twNazwa: string;
  grtId?: number | null;
  grtNazwa?: string | null;
  note?: string;
}): Promise<ZdEstimateOnRequestActionResult> {
  const user = await requireZdEstimateAdmin("mutate");
  try {
    const target = await resolveOnRequestUpsertTarget(input);
    await upsertZdEstimateOnRequest({
      ...target,
      note: input.note,
      createdBy: user.id,
    });
    try {
      await deleteZdEstimateExclusion(target.subiektTwId);
      if (target.subiektTwId !== Math.trunc(input.subiektTwId)) {
        await deleteZdEstimateExclusion(input.subiektTwId);
      }
    } catch {
      /* ignore */
    }
    const onRequests = await fetchZdEstimateOnRequests();
    return { ok: true, onRequests };
  } catch (e) {
    return {
      ok: false,
      message:
        userFacingErrorText(e, "Nie udało się oznaczyć „tylko na prośbę”."),
    };
  }
}

export async function actionClearZdEstimateOnRequest(
  subiektTwId: number
): Promise<ZdEstimateOnRequestActionResult> {
  await requireZdEstimateAdmin("mutate");
  try {
    await clearOnRequestRowsForTwIds([subiektTwId]);
    const onRequests = await fetchZdEstimateOnRequests();
    return { ok: true, onRequests };
  } catch (e) {
    return {
      ok: false,
      message:
        userFacingErrorText(e, "Nie udało się usunąć „tylko na prośbę”."),
    };
  }
}

export async function actionUpdateZdEstimateOnRequestNote(input: {
  subiektTwId: number;
  note: string;
}): Promise<ZdEstimateOnRequestActionResult> {
  await requireZdEstimateAdmin("mutate");
  try {
    await updateZdEstimateOnRequestNote({
      subiektTwId: input.subiektTwId,
      note: input.note,
    });
    const onRequests = await fetchZdEstimateOnRequests();
    return { ok: true, onRequests };
  } catch (e) {
    return {
      ok: false,
      message:
        userFacingErrorText(e, "Nie udało się zapisać notatki."),
    };
  }
}

export async function actionMarkZdEstimateOnRequestProducts(input: {
  products: ZdEstimateBulkProductInput[];
  note?: string;
}): Promise<ZdEstimateBulkOnRequestActionResult> {
  const user = await requireZdEstimateAdmin("mutate");
  const normalized = normalizeZdEstimateBulkProducts(input.products);
  const products = normalized.products;
  if (!products.length) {
    return { ok: false, message: "Zaznacz co najmniej jeden produkt." };
  }
  const truncated = normalized.truncated;
  const note = input.note?.trim().slice(0, 500) || undefined;

  const succeededTwIds: number[] = [];
  const failed: ZdEstimateBulkFailure[] = [];
  const pairs = await fetchZdProductPairs();

  for (const p of products) {
    try {
      const hit = retargetTwIdToPackIfPiece(p.subiektTwId, pairs);
      const pair = hit.pair
        ? pairs.find(
            (x) =>
              x.packTwId === hit.pair!.packTwId &&
              x.pieceTwId === hit.pair!.pieceTwId
          )
        : null;
      const targetTwId = hit.twId;
      await upsertZdEstimateOnRequest({
        subiektTwId: targetTwId,
        twSymbol: hit.retargeted
          ? pair?.packSymbol ?? p.twSymbol
          : p.twSymbol,
        twNazwa: hit.retargeted
          ? pair?.packNazwa?.trim() || p.twNazwa
          : p.twNazwa,
        grtId: p.grtId,
        grtNazwa: p.grtNazwa,
        note,
        createdBy: user.id,
      });
      try {
        await deleteZdEstimateExclusion(targetTwId);
        if (targetTwId !== p.subiektTwId) {
          await deleteZdEstimateExclusion(p.subiektTwId);
        }
      } catch {
        /* ignore */
      }
      succeededTwIds.push(targetTwId);
    } catch (e) {
      failed.push({
        subiektTwId: p.subiektTwId,
        twSymbol: p.twSymbol,
        error:
          e instanceof Error
            ? e.message
            : `Nie udało się oznaczyć ${bulkProductLabel(p)}.`,
      });
    }
  }

  if (!succeededTwIds.length) {
    return {
      ok: false,
      message:
        failed[0]?.error ?? "Nie udało się oznaczyć produktów „tylko na prośbę”.",
    };
  }

  try {
    const onRequests = await fetchZdEstimateOnRequests();
    return { ok: true, onRequests, succeededTwIds, failed, truncated };
  } catch (e) {
    return {
      ok: false,
      message:
        userFacingErrorText(e, "Zapisano część wpisów, ale nie udało się odświeżyć listy."),
    };
  }
}

export async function actionClearZdEstimateOnRequestProducts(
  subiektTwIds: number[]
): Promise<ZdEstimateBulkOnRequestActionResult> {
  await requireZdEstimateAdmin("mutate");
  const normalized = normalizeZdEstimateBulkTwIds(subiektTwIds);
  const ids = normalized.ids;
  if (!ids.length) {
    return { ok: false, message: "Zaznacz co najmniej jeden produkt." };
  }
  const truncated = normalized.truncated;

  try {
    await clearOnRequestRowsForTwIds(ids);
    const onRequests = await fetchZdEstimateOnRequests();
    return {
      ok: true,
      onRequests,
      succeededTwIds: ids,
      failed: [],
      truncated,
    };
  } catch (e) {
    return {
      ok: false,
      message:
        userFacingErrorText(e, "Nie udało się usunąć „tylko na prośbę”."),
    };
  }
}

export type ZdEstimatePackagingActionResult =
  | { ok: true; packaging: ZdEstimatePackagingRow[] }
  | { ok: false; message: string };

export async function actionListZdEstimatePackaging(): Promise<ZdEstimatePackagingActionResult> {
  await requireZdEstimateAdmin("read");
  try {
    const packaging = await fetchZdEstimatePackaging();
    return { ok: true, packaging };
  } catch (e) {
    return {
      ok: false,
      message:
        userFacingErrorText(e, "Nie udało się pobrać ustawień opakowań."),
    };
  }
}

export async function actionUpsertZdEstimatePackaging(input: {
  subiektTwId: number;
  twSymbol?: string | null;
  twNazwa: string;
  grtId?: number | null;
  grtNazwa?: string | null;
  unitsPerPackage: number;
  packageLabel?: string;
  note?: string;
}): Promise<ZdEstimatePackagingActionResult> {
  const user = await requireZdEstimateAdmin("mutate");
  try {
    await upsertZdEstimatePackaging({
      ...input,
      createdBy: user.id,
    });
    const packaging = await fetchZdEstimatePackaging();
    return { ok: true, packaging };
  } catch (e) {
    return {
      ok: false,
      message:
        userFacingErrorText(e, "Nie udało się zapisać opakowania."),
    };
  }
}

export async function actionDeleteZdEstimatePackaging(
  subiektTwId: number
): Promise<ZdEstimatePackagingActionResult> {
  await requireZdEstimateAdmin("mutate");
  try {
    await deleteZdEstimatePackaging(subiektTwId);
    const packaging = await fetchZdEstimatePackaging();
    return { ok: true, packaging };
  } catch (e) {
    return {
      ok: false,
      message:
        userFacingErrorText(e, "Nie udało się usunąć opakowania."),
    };
  }
}

export type ZdEstimateBulkFailure = {
  subiektTwId: number;
  twSymbol?: string | null;
  error: string;
};

export type ZdEstimateBulkExclusionActionResult =
  | {
      ok: true;
      exclusions: ZdEstimateExclusionRow[];
      succeededTwIds: number[];
      failed: ZdEstimateBulkFailure[];
      truncated: boolean;
    }
  | { ok: false; message: string };

export type ZdEstimateBulkPackagingActionResult =
  | {
      ok: true;
      packaging: ZdEstimatePackagingRow[];
      succeededTwIds: number[];
      failed: ZdEstimateBulkFailure[];
      truncated: boolean;
    }
  | { ok: false; message: string };

function bulkProductLabel(p: ZdEstimateBulkProductInput): string {
  return p.twSymbol?.trim() || `tw_Id ${p.subiektTwId}`;
}

/** Grupowe wykluczenie — wspólna notatka dla wszystkich zaznaczonych. */
export async function actionExcludeZdEstimateProducts(input: {
  products: ZdEstimateBulkProductInput[];
  note?: string;
}): Promise<ZdEstimateBulkExclusionActionResult> {
  const user = await requireZdEstimateAdmin("mutate");
  const normalized = normalizeZdEstimateBulkProducts(input.products);
  const products = normalized.products;
  if (!products.length) {
    return { ok: false, message: "Zaznacz co najmniej jeden produkt." };
  }
  const truncated = normalized.truncated;
  const note = input.note?.trim().slice(0, 500) || undefined;

  const succeededTwIds: number[] = [];
  const failed: ZdEstimateBulkFailure[] = [];

  for (const p of products) {
    try {
      await upsertZdEstimateExclusion({
        subiektTwId: p.subiektTwId,
        twSymbol: p.twSymbol,
        twNazwa: p.twNazwa,
        grtId: p.grtId,
        grtNazwa: p.grtNazwa,
        note,
        createdBy: user.id,
      });
      succeededTwIds.push(p.subiektTwId);
    } catch (e) {
      failed.push({
        subiektTwId: p.subiektTwId,
        twSymbol: p.twSymbol,
        error:
          e instanceof Error
            ? e.message
            : `Nie udało się wykluczyć ${bulkProductLabel(p)}.`,
      });
    }
  }

  if (succeededTwIds.length) {
    try {
      await clearOnRequestRowsForExcludedTwIds(succeededTwIds);
    } catch {
      /* ignore */
    }
  }

  if (!succeededTwIds.length) {
    return {
      ok: false,
      message: failed[0]?.error ?? "Nie udało się wykluczyć produktów.",
    };
  }

  try {
    const exclusions = await fetchZdEstimateExclusions();
    return { ok: true, exclusions, succeededTwIds, failed, truncated };
  } catch (e) {
    return {
      ok: false,
      message:
        userFacingErrorText(e, "Zapisano część wykluczeń, ale nie udało się odświeżyć listy."),
    };
  }
}

/** Grupowe przywrócenie z listy wykluczeń. */
export async function actionRestoreZdEstimateProducts(
  subiektTwIds: number[]
): Promise<ZdEstimateBulkExclusionActionResult> {
  await requireZdEstimateAdmin("mutate");
  const normalized = normalizeZdEstimateBulkTwIds(subiektTwIds);
  const ids = normalized.ids;
  if (!ids.length) {
    return { ok: false, message: "Zaznacz co najmniej jeden produkt." };
  }
  const truncated = normalized.truncated;

  try {
    await deleteZdEstimateExclusionsMany(ids);
    const exclusions = await fetchZdEstimateExclusions();
    return {
      ok: true,
      exclusions,
      succeededTwIds: ids,
      failed: [],
      truncated,
    };
  } catch (e) {
    return {
      ok: false,
      message:
        userFacingErrorText(e, "Nie udało się przywrócić produktów."),
    };
  }
}

/**
 * Grupowe opakowanie — te same jednostki ZD dla wszystkich zaznaczonych.
 * unitsPerPackage === 1 → jawne sztuki 1:1 w historii snapshotów.
 */
export async function actionUpsertZdEstimatePackagingBulk(input: {
  products: ZdEstimateBulkProductInput[];
  unitsPerPackage: number;
  packageLabel?: string;
  note?: string;
}): Promise<ZdEstimateBulkPackagingActionResult> {
  const user = await requireZdEstimateAdmin("mutate");
  const normalized = normalizeZdEstimateBulkProducts(input.products);
  const products = normalized.products;
  if (!products.length) {
    return { ok: false, message: "Zaznacz co najmniej jeden produkt." };
  }
  const truncated = normalized.truncated;
  const units = Math.trunc(Number(input.unitsPerPackage));
  if (!Number.isFinite(units) || units < 1 || units > 100_000) {
    return {
      ok: false,
      message: "Liczba sztuk w opakowaniu musi być od 1 do 100 000.",
    };
  }

  const succeededTwIds: number[] = [];
  const failed: ZdEstimateBulkFailure[] = [];

  for (const p of products) {
    try {
      await upsertZdEstimatePackaging({
        subiektTwId: p.subiektTwId,
        twSymbol: p.twSymbol,
        twNazwa: p.twNazwa,
        grtId: p.grtId,
        grtNazwa: p.grtNazwa,
        unitsPerPackage: units,
        packageLabel: input.packageLabel,
        note: input.note?.trim()
          ? input.note.trim().slice(0, 500)
          : undefined,
        createdBy: user.id,
      });
      succeededTwIds.push(p.subiektTwId);
    } catch (e) {
      failed.push({
        subiektTwId: p.subiektTwId,
        twSymbol: p.twSymbol,
        error:
          e instanceof Error
            ? e.message
            : `Nie udało się zapisać opakowania dla ${bulkProductLabel(p)}.`,
      });
    }
  }

  if (!succeededTwIds.length) {
    return {
      ok: false,
      message: failed[0]?.error ?? "Nie udało się zapisać opakowań.",
    };
  }

  try {
    const packaging = await fetchZdEstimatePackaging();
    return { ok: true, packaging, succeededTwIds, failed, truncated };
  } catch (e) {
    return {
      ok: false,
      message:
        userFacingErrorText(e, "Zapisano część opakowań, ale nie udało się odświeżyć listy."),
    };
  }
}

/** Grupowe usunięcie opakowań (powrót do 1:1 sztuk). */
export async function actionDeleteZdEstimatePackagingBulk(
  subiektTwIds: number[]
): Promise<ZdEstimateBulkPackagingActionResult> {
  await requireZdEstimateAdmin("mutate");
  const normalized = normalizeZdEstimateBulkTwIds(subiektTwIds);
  const ids = normalized.ids;
  if (!ids.length) {
    return { ok: false, message: "Zaznacz co najmniej jeden produkt." };
  }
  const truncated = normalized.truncated;

  try {
    await deleteZdEstimatePackagingMany(ids);
    const packaging = await fetchZdEstimatePackaging();
    return {
      ok: true,
      packaging,
      succeededTwIds: ids,
      failed: [],
      truncated,
    };
  } catch (e) {
    return {
      ok: false,
      message:
        userFacingErrorText(e, "Nie udało się usunąć opakowań."),
    };
  }
}

export type ZdEstimateLinkCandidate = {
  dokId: number;
  dokNrPelny: string;
  dataWyst: string | null;
  status: number | null;
};

export type ZdEstimateSearchZdResult =
  | { ok: true; documents: ZdEstimateLinkCandidate[] }
  | { ok: false; message: string };

/** Ostatnie ZD z hosta ORDERS — do dialogu „Powiąż ZD”. */
export async function actionSearchZdForEstimateLink(input?: {
  search?: string | null;
  days?: number;
}): Promise<ZdEstimateSearchZdResult> {
  await requireZdEstimateAdmin("read");
  const orders = resolveSubiektOrdersConfig();
  if (!orders.ok) {
    return { ok: false, message: orders.message };
  }

  try {
    const days = Math.min(90, Math.max(1, Math.round(input?.days ?? 21)));
    const dataDo = warsawNowParts().dateKey;
    const end = new Date(`${dataDo}T12:00:00Z`);
    end.setUTCDate(end.getUTCDate() - (days - 1));
    const dataOd = end.toISOString().slice(0, 10);
    const search = input?.search?.trim() || undefined;

    const list = await searchSubiektOrdersZd({
      dataOd,
      dataDo,
      search,
      page: 1,
      pageSize: 50,
    });

    const documents: ZdEstimateLinkCandidate[] = (list.data ?? [])
      .map((d) => ({
        dokId: Number(d.dok_Id),
        dokNrPelny: String(d.dok_NrPelny ?? "").trim() || `ZD/${d.dok_Id}`,
        dataWyst: d.dok_DataWyst ? String(d.dok_DataWyst).slice(0, 10) : null,
        status: d.dok_Status != null ? Number(d.dok_Status) : null,
      }))
      .filter((d) => d.dokId > 0);

    return { ok: true, documents };
  } catch (e) {
    return {
      ok: false,
      message:
        userFacingErrorText(e, "Nie udało się pobrać listy ZD."),
    };
  }
}

export type ZdEstimateLinkLineMeta = {
  twId: number;
  celAtLink?: number | null;
  deltaAtLink?: number | null;
};

export type ZdEstimateLinkSnapshotResult =
  | {
      ok: true;
      snapshot: ZdEstimateOrderSnapshotRow;
      lineCount: number;
      dokNrPelny: string;
    }
  | { ok: false; message: string };

/**
 * Pobiera ZD i zapisuje snapshot linii (idempotentnie po dok_id).
 * Persist na hoście ORDERS z host_kind=live (:5080) lub orders_test (:5082).
 */
export async function actionLinkZdEstimateSnapshot(input: {
  dokId?: number | null;
  dokNrPelny?: string | null;
  supplierId?: string | null;
  scopeMode?: ZdEstimateSnapshotScopeMode | null;
  grtId?: number | null;
  cechaId?: number | null;
  lineMeta?: ZdEstimateLinkLineMeta[] | null;
  /** tw_Id z orderable preview (Do ZD) — potwierdzone 1:1 przy braku opakowania. */
  orderableTwIds?: number[] | null;
}): Promise<ZdEstimateLinkSnapshotResult> {
  const user = await requireZdEstimateAdmin("mutate");
  const orders = resolveSubiektOrdersConfig();
  if (!orders.ok) {
    return { ok: false, message: orders.message };
  }
  if (!shouldPersistZdEstimateOrderSnapshots(orders.config.baseUrl)) {
    return {
      ok: false,
      message: "Brak konfiguracji hosta ORDERS — nie można zapisać historii.",
    };
  }

  const scopeRes = requireSnapshotScopeMode(input.scopeMode, {
    grtId: input.grtId,
    cechaId: input.cechaId,
  });
  if (!scopeRes.ok) {
    return { ok: false, message: scopeRes.message };
  }

  const khRes = await resolveSupplierKhIdsForHistory(input.supplierId);
  if (!khRes.ok) {
    return {
      ok: false,
      message: `Powiąż ZD wymaga dostawcy z workbencha: ${khRes.message}`,
    };
  }

  try {
    let dokId =
      input.dokId != null && Number.isFinite(Number(input.dokId))
        ? Math.trunc(Number(input.dokId))
        : 0;

    const nrQuery = input.dokNrPelny?.trim() ?? "";
    if (!(dokId > 0) && nrQuery) {
      const list = await searchSubiektOrdersZd({
        search: nrQuery,
        page: 1,
        pageSize: 30,
      });
      const hits = (list.data ?? []).filter((d) => {
        const nr = String(d.dok_NrPelny ?? "").trim().toLowerCase();
        return (
          nr === nrQuery.toLowerCase() || nr.includes(nrQuery.toLowerCase())
        );
      });
      if (hits.length === 1) {
        dokId = Number(hits[0].dok_Id);
      } else if (hits.length > 1) {
        const q = nrQuery.toLowerCase();
        const exact = hits.filter(
          (d) => String(d.dok_NrPelny ?? "").trim().toLowerCase() === q
        );
        if (exact.length === 1) {
          dokId = Number(exact[0].dok_Id);
        } else {
          return {
            ok: false,
            message: `Znaleziono ${hits.length} dokumentów pasujących do „${nrQuery}” — wybierz ZD z listy albo podaj pełny numer.`,
          };
        }
      } else if (/^\d+$/.test(nrQuery)) {
        dokId = Number(nrQuery);
      }
    }

    if (!(dokId > 0)) {
      return {
        ok: false,
        message: "Podaj numer ZD lub wybierz dokument z listy.",
      };
    }

    const doc = await getSubiektOrdersZd(dokId);
    const dokNrPelny =
      String(doc.dok_NrPelny ?? "").trim() || `ZD/${dokId}`;

    const supplierKhIds = khRes.khIds;
    const docKhId =
      doc.dok_OdbiorcaId != null
        ? Number(doc.dok_OdbiorcaId)
        : doc.dok_PlatnikId != null
          ? Number(doc.dok_PlatnikId)
          : null;
    if (
      docKhId == null ||
      !Number.isFinite(docKhId) ||
      !supplierKhIds.includes(Math.trunc(docKhId))
    ) {
      return {
        ok: false,
        message:
          "Kontrahent na ZD nie należy do wybranego dostawcy (kh / aliasy). Sprawdź dostawcę w workbenchu.",
      };
    }

    let packagingByTwId: Map<number, number>;
    try {
      packagingByTwId = new Map();
      const packaging = await fetchZdEstimatePackaging();
      for (const row of packaging) {
        packagingByTwId.set(row.subiektTwId, row.unitsPerPackage);
      }
    } catch (e) {
      return {
        ok: false,
        message:
          e instanceof Error
            ? `Nie udało się wczytać opakowań do historii: ${e.message}`
            : "Nie udało się wczytać opakowań do historii.",
      };
    }

    let pairRatioByTwId: Map<number, number>;
    try {
      const pairs = await fetchZdProductPairs();
      pairRatioByTwId = buildPairRatioByTwId(pairs);
    } catch (e) {
      return {
        ok: false,
        message:
          e instanceof Error
            ? `Nie udało się wczytać par kompletów do historii: ${e.message}`
            : "Nie udało się wczytać par kompletów do historii.",
      };
    }

    const orderableTwIds = resolveConfirmedEstimateTwIdsForLink({
      orderableTwIds: input.orderableTwIds,
      lineMeta: input.lineMeta,
    });

    const built = buildZdEstimateSnapshotLinesFromDocChecked(doc, {
      packagingByTwId,
      pairRatioByTwId,
      lineMeta: input.lineMeta ?? null,
      confirmedEstimateTwIds: orderableTwIds,
      requirePackaging: true,
    });
    if (!built.ok) {
      return {
        ok: false,
        message: enrichSnapshotPackagingErrorMessage(
          built.message,
          doc,
          orderableTwIds
        ),
      };
    }
    if (!built.lines.length) {
      return {
        ok: false,
        message: `Dokument ${dokNrPelny} nie ma pozycji z ilością > 0.`,
      };
    }

    const eligibleForHistory = !isFulfilledZdDocumentStatus(doc);
    const hostKind = requireZdEstimateSnapshotHostKind(orders.config.baseUrl);

    const { snapshot, lineCount } = await upsertZdEstimateOrderSnapshot({
      dokId,
      dokNrPelny,
      linkedBy: user.id,
      supplierKhId: Math.trunc(docKhId),
      scopeMode: scopeRes.scopeMode,
      grtId: scopeRes.grtId,
      cechaId: scopeRes.cechaId,
      hostKind,
      eligibleForHistory,
      lines: built.lines,
    });

    return { ok: true, snapshot, lineCount, dokNrPelny };
  } catch (e) {
    return {
      ok: false,
      message:
        userFacingErrorText(e, "Nie udało się powiązać ZD ze szacunkiem."),
    };
  }
}

async function resolveSupplierKhForCreateFromDb(
  supplierId: string
): Promise<
  | {
      ok: true;
      khId: number;
      usedAlias: boolean;
      supplierName: string;
    }
  | { ok: false; message: string }
> {
  const id = String(supplierId ?? "").trim();
  if (!id) {
    return { ok: false, message: "Brak identyfikatora dostawcy." };
  }
  const supabase = createAdminClient();
  const { data: supplier, error } = await supabase
    .from("suppliers")
    .select("id, name, subiekt_kh_id")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    return { ok: false, message: error.message };
  }
  if (!supplier) {
    return { ok: false, message: "Nie znaleziono dostawcy w OnTime." };
  }
  const { data: aliases } = await supabase
    .from("supplier_subiekt_kh_aliases")
    .select("subiekt_kh_id")
    .eq("supplier_id", id);
  const additional = (aliases ?? [])
    .map((r) => Math.trunc(Number((r as { subiekt_kh_id: number }).subiekt_kh_id)))
    .filter((n) => n > 0);
  return resolveZdCreateKhId({
    supplierName: String((supplier as { name: string }).name ?? ""),
    primaryKhId: (supplier as { subiekt_kh_id: number | null }).subiekt_kh_id,
    additionalKhIds: additional,
  });
}

function mapZdCreateSubiektError(e: unknown): {
  code: "timeout" | "validation" | "sfera" | "network" | "error";
  message: string;
} {
  if (e instanceof SubiektTimeoutError) {
    return {
      code: "timeout",
      message:
        "Timeout przy tworzeniu ZD (Sfera). Sprawdź w Subiekcie, czy dokument powstał — nie twórz ponownie w ciemno.",
    };
  }
  if (e instanceof SubiektRequestError) {
    let parsed: { error?: string; code?: string } | null = null;
    try {
      parsed = JSON.parse(e.bodySnippet) as {
        error?: string;
        code?: string;
      };
    } catch {
      const codeM = e.bodySnippet.match(/"code"\s*:\s*"([^"]+)"/);
      const errM = e.bodySnippet.match(/"error"\s*:\s*"((?:\\.|[^"\\])*)"/);
      if (codeM || errM) {
        parsed = {
          code: codeM?.[1],
          error: errM?.[1]?.replace(/\\"/g, '"'),
        };
      }
    }
    const apiCode = String(parsed?.code ?? "").trim();
    const apiError =
      String(parsed?.error ?? "").trim() || e.bodySnippet || e.message;
    if (apiCode === "validation_error" || e.status === 400) {
      return { code: "validation", message: apiError };
    }
    if (
      apiCode === "sfera_not_configured" ||
      apiCode === "sfera_error" ||
      e.status === 503 ||
      e.status === 409
    ) {
      return {
        code: "sfera",
        message:
          apiError ||
          "Sfera Subiekta niedostępna lub zajęta. Spróbuj za chwilę.",
      };
    }
    return { code: "error", message: apiError || e.message };
  }
  const feedback = feedbackFromException(e);
  return {
    code: "network",
    message: feedback.message || (userFacingErrorText(e, "Błąd Subiekta.")),
  };
}

export type ZdEstimateCreateZdResult =
  | {
      ok: true;
      dokId: number;
      dokNrPelny: string;
      lineCount: number;
      snapshotOk: boolean;
      snapshotMessage?: string;
      /** Prośby odznaczone jako Główne po create. */
      markedIndividualOrderIds?: string[];
      /** Gdy ZD OK, ale odznaczanie częściowo/całkowicie padło. */
      markIndividualsMessage?: string;
    }
  | {
      ok: false;
      code: "timeout" | "validation" | "sfera" | "network" | "error";
      message: string;
      /** Przy timeout — kh do wyszukania świeżego ZD. */
      supplierKhId?: number;
    };

/**
 * Tworzy ZD na hoście ORDERS (obecnie często live :5080 — aktualna baza).
 * Snapshot historii z host_kind zgodnym z URL (live | orders_test).
 * kontrahentId zawsze z DB po supplierId — nie z klienta.
 * Po sukcesie Subiekta: opcjonalnie odznacza prośby jako Główne.
 */
export async function actionCreateZdFromEstimate(input: {
  supplierId: string;
  uwagi?: string | null;
  scopeMode?: ZdEstimateSnapshotScopeMode | null;
  grtId?: number | null;
  cechaId?: number | null;
  lines: Array<{ twId: number; ilosc: number }>;
  lineMeta?: ZdEstimateLinkLineMeta[] | null;
  /**
   * Wymagane przy ORDERS live (:5080) — serwer odrzuci create bez tego.
   * Checkbox w UI musi być zaznaczony.
   */
  confirmLiveCreate?: boolean;
  /**
   * OrderIds próśb katalogowych (extras na tw z payloadu).
   * Serwer weryfikuje przynależność do dostawcy + Nowe.
   */
  individualCatalogOrderIds?: string[] | null;
  /**
   * OrderIds usług do uwag + Główne.
   * Serwer dokłada blok usług do uwag (nie zależy od edycji tekstu).
   */
  individualServiceOrderIds?: string[] | null;
  /** @deprecated użyj catalog + service; łączona lista nadal akceptowana. */
  individualOrderIds?: string[] | null;
}): Promise<ZdEstimateCreateZdResult> {
  const user = await requireZdEstimateAdmin("mutate");
  const orders = resolveSubiektOrdersConfig();
  if (!orders.ok) {
    return { ok: false, code: "error", message: orders.message };
  }

  const persistSnapshots = shouldPersistZdEstimateOrderSnapshots(
    orders.config.baseUrl
  );
  const hostKind = requireZdEstimateSnapshotHostKind(orders.config.baseUrl);
  const ordersIsLive = hostKind === "live";

  if (ordersIsLive && input.confirmLiveCreate !== true) {
    return {
      ok: false,
      code: "validation",
      message:
        "Create na LIVE (:5080, aktualna baza) wymaga jawnego potwierdzenia (confirmLiveCreate).",
    };
  }

  console.info("[zd-estimate:create]", {
    hostKind,
    ordersBaseUrl: orders.config.baseUrl,
    ordersIsLive,
    userId: user.id,
    supplierId: input.supplierId,
    scopeMode: input.scopeMode ?? null,
    grtId: input.grtId ?? null,
    cechaId: input.cechaId ?? null,
    lineCount: Array.isArray(input.lines) ? input.lines.length : 0,
  });

  const khRes = await resolveSupplierKhForCreateFromDb(input.supplierId);
  if (!khRes.ok) {
    return { ok: false, code: "validation", message: khRes.message };
  }

  const linesCheck = validateZdCreateClientLines(input.lines);
  if (!linesCheck.ok) {
    return { ok: false, code: "validation", message: linesCheck.message };
  }

  const scopeRes = requireSnapshotScopeMode(input.scopeMode, {
    grtId: input.grtId,
    cechaId: input.cechaId,
  });
  if (!scopeRes.ok) {
    return { ok: false, code: "validation", message: scopeRes.message };
  }

  const createdTwIds = new Set(linesCheck.lines.map((l) => l.twId));
  const catalogFromClient = [...(input.individualCatalogOrderIds ?? [])];
  const serviceFromClient = [...(input.individualServiceOrderIds ?? [])];
  const legacyFromClient = [...(input.individualOrderIds ?? [])];
  const hasSplitHints =
    catalogFromClient.length > 0 || serviceFromClient.length > 0;

  let pendingForSupplier: ZdEstimatePendingIndividualOrder[] = [];
  try {
    const pendingRes = await fetchZdEstimatePendingIndividualOrders(
      input.supplierId
    );
    pendingForSupplier = pendingRes.orders;
    if (pendingRes.truncated) {
      return {
        ok: false,
        code: "validation",
        message:
          "Zbyt wiele wiszących próśb u dostawcy (>500). Odznacz część w panelu Dziś, potem utwórz ZD.",
      };
    }
  } catch (e) {
    return {
      ok: false,
      code: "validation",
      message:
        e instanceof Error
          ? `Nie udało się zweryfikować próśb przed create: ${e.message}`
          : "Nie udało się zweryfikować próśb przed create.",
    };
  }
  const pendingById = new Map(pendingForSupplier.map((o) => [o.id, o]));

  let pairsForMark: Awaited<ReturnType<typeof fetchZdProductPairs>> = [];
  let bomsForMark: Awaited<ReturnType<typeof fetchZdProductBoms>> = [];
  let teethForMark: Set<number>;
  try {
    ;[pairsForMark, bomsForMark] = await Promise.all([
      fetchZdProductPairs(),
      fetchZdProductBoms(),
    ]);
    teethForMark = await fetchTeethProductTwIdSet();
  } catch (e) {
    return {
      ok: false,
      code: "validation",
      message:
        e instanceof Error
          ? `Nie udało się wczytać par/BOM/zębów przed create: ${e.message}`
          : "Nie udało się wczytać ustawień produktów przed create.",
    };
  }

  let packagingForCreate: Awaited<
    ReturnType<typeof fetchZdEstimatePackaging>
  > = [];
  try {
    packagingForCreate = await fetchZdEstimatePackaging();
  } catch (e) {
    return {
      ok: false,
      code: "validation",
      message:
        e instanceof Error
          ? `Nie udało się wczytać opakowań przed create: ${e.message}`
          : "Nie udało się wczytać opakowań przed create.",
    };
  }

  const stubLines = linesCheck.lines.map((l) => ({
    tw_Id: l.twId,
    tw_Symbol: String(l.symbol ?? "").trim(),
  }));
  const mikranByTw = new Map<number, string>();
  for (const l of linesCheck.lines) {
    const plu = String(l.plu ?? "").trim();
    if (l.twId > 0 && plu) mikranByTw.set(l.twId, plu);
  }
  const markBundle = buildIndividualEstimateExtras({
    orders: pendingForSupplier,
    lines: stubLines,
    pairs: pairsForMark,
    boms: bomRowsToRefs(bomsForMark),
    teethTwIds: teethForMark,
    mikranByTw,
  });
  const validCatalogIds = new Set(
    collectIndividualOrderIdsForZdCreate({
      byTwId: markBundle.byTwId,
      createdTwIds,
      serviceOrderIds: [],
    })
  );

  const unitsPerPackageByTwId = new Map<number, number>();
  for (const row of packagingForCreate) {
    unitsPerPackageByTwId.set(row.subiektTwId, row.unitsPerPackage);
  }
  for (const pair of pairsForMark) {
    unitsPerPackageByTwId.set(pair.packTwId, pair.unitsPerPack);
  }
  const extraPiecesByTwId = new Map<number, number>();
  for (const [tw, extra] of markBundle.byTwId) {
    if (extra.extraPieces > 0 && createdTwIds.has(tw)) {
      extraPiecesByTwId.set(tw, extra.extraPieces);
    }
  }
  const coveredLines = ensureZdCreateLinesCoverIndividualExtras({
    lines: linesCheck.lines,
    extraPiecesByTwId,
    unitsPerPackageByTwId,
  });
  const createLines = coveredLines.lines;

  const normalizeIds = (ids: string[]) =>
    [
      ...new Set(
        filterPendingOrdersByIds(
          pendingForSupplier,
          ids.map((id) => String(id ?? "").trim()).filter(Boolean)
        ).map((o) => o.id)
      ),
    ];

  let catalogIds: string[];
  let serviceIds: string[];
  if (hasSplitHints) {
    // Katalog z klienta: preferuj serwerowy rebuild; fallback gdy klient
    // zmapował po symbolu/PLU, a serwer i tak widzi pending (qty już na ZD).
    catalogIds = normalizeIds(catalogFromClient).filter((id) => {
      if (validCatalogIds.has(id)) return true;
      const o = pendingById.get(id);
      if (!o) return false;
      // Zęby / BOM parent weszłyby jako service — nie akceptuj jako katalog.
      if (
        markBundle.serviceLines.some((line) =>
          line.requests.some((r) => r.orderId === id)
        )
      ) {
        return false;
      }
      return true;
    });
    serviceIds = normalizeIds(serviceFromClient).filter(
      (id) => !catalogIds.includes(id)
    );
  } else {
    const legacy = normalizeIds(legacyFromClient);
    catalogIds = legacy.filter((id) => validCatalogIds.has(id));
    serviceIds = legacy.filter((id) => !catalogIds.includes(id));
  }

  // Uwagi zawsze z pełnej listy usług wskazanej przez klienta; mark może być węższy.
  const serviceIdsForUwagi = [...serviceIds];
  const markCandidateIds = [...new Set([...catalogIds, ...serviceIds])];

  // Preflight nie blokuje create ZD — przy fail pomijamy Główne.
  let preflightMarkSkipMessage: string | undefined;
  let catalogIdsToMark = catalogIds;
  let serviceIdsToMark = serviceIds;
  if (markCandidateIds.length) {
    const pre = await preflightProcessIndividualGlowne(markCandidateIds);
    if (!pre.ok) {
      preflightMarkSkipMessage = pre.message;
      catalogIdsToMark = [];
      serviceIdsToMark = [];
    } else {
      const processable = new Set(pre.processableIds);
      catalogIdsToMark = catalogIds.filter((id) => processable.has(id));
      serviceIdsToMark = serviceIds.filter((id) => processable.has(id));
    }
  }

  const serviceLinesForUwagi = markBundle.serviceLines
    .map((line) => ({
      ...line,
      requests: line.requests.filter((r) =>
        serviceIdsForUwagi.includes(r.orderId)
      ),
    }))
    .filter((line) => line.requests.length > 0);

  // Dołóż serviceIds spoza markBundle.serviceLines (np. prośba na wykluczonej
  // pozycji, którą klient świadomie wrzuca do uwag).
  const coveredService = new Set(
    serviceLinesForUwagi.flatMap((l) => l.requests.map((r) => r.orderId))
  );
  for (const id of serviceIdsForUwagi) {
    if (coveredService.has(id)) continue;
    const o = pendingById.get(id);
    if (!o) continue;
    serviceLinesForUwagi.push({
      key: `svc:${o.id}`,
      label: `Usługa jednorazowa: ${o.symbol ?? o.products}`,
      qty: o.qty,
      reason: "no_subiekt",
      requests: [
        {
          orderId: o.id,
          salesPersonId: o.salesPersonId,
          salesPersonName: o.salesPersonName,
          qty: o.qty,
          products: o.products,
          symbol: o.symbol,
          mikranCode: o.mikranCode,
          requestNote: o.requestNote,
        },
      ],
    });
  }

  const baseUwagi =
    (input.uwagi ?? "").trim() ||
    defaultZdCreateUwagi({
      supplierName: khRes.supplierName,
      scopeLabel:
        scopeRes.scopeMode === "grupa"
          ? scopeRes.grtId != null
            ? `grupa ${scopeRes.grtId}`
            : null
          : scopeRes.cechaId != null
            ? `cecha ${scopeRes.cechaId}`
            : null,
      dateKey: new Date().toISOString().slice(0, 10),
    });
  const composedUwagi = composeZdCreateUwagiWithServices({
    baseUwagi,
    serviceLines: serviceLinesForUwagi,
    prioritizeServices: true,
  });

  const body = buildZdCreateApiBody({
    kontrahentId: khRes.khId,
    uwagi: composedUwagi.uwagi,
    lines: createLines,
  });

  let dokId = 0;
  try {
    const created = await createSubiektOrdersZd(body);
    dokId = Math.trunc(Number(created.dok_Id));
    if (!(dokId > 0)) {
      return {
        ok: false,
        code: "error",
        message: "Subiekt nie zwrócił dok_Id po utworzeniu ZD.",
      };
    }
    console.info("[zd-estimate:create:ok]", {
      hostKind,
      ordersBaseUrl: orders.config.baseUrl,
      dokId,
      dokNrPelny: created.dok_NrPelny ?? null,
      userId: user.id,
      supplierId: input.supplierId,
      khId: khRes.khId,
      lineCount: createLines.length,
    });
  } catch (e) {
    const mapped = mapZdCreateSubiektError(e);
    console.warn("[zd-estimate:create:fail]", {
      hostKind,
      ordersBaseUrl: orders.config.baseUrl,
      userId: user.id,
      supplierId: input.supplierId,
      khId: khRes.khId,
      code: mapped.code,
      message: mapped.message,
    });
    return {
      ok: false,
      code: mapped.code,
      message: mapped.message,
      supplierKhId: mapped.code === "timeout" ? khRes.khId : undefined,
    };
  }

  // Produkty zębowe (SKU) w uwagach — bez Główne (panel /zeby).
  const teethServiceOrderIds = new Set(
    serviceLinesForUwagi
      .filter((l) => l.reason === "teeth")
      .flatMap((l) => l.requests.map((r) => r.orderId))
  );

  const markIds = [
    ...new Set([
      ...catalogIdsToMark,
      ...composedUwagi.includedServiceOrderIds.filter(
        (id) =>
          serviceIdsToMark.includes(id) && !teethServiceOrderIds.has(id)
      ),
    ]),
  ];

  let markedIndividualOrderIds: string[] = [];
  let markIndividualsMessage: string | undefined;
  const bumpedNote =
    coveredLines.bumped.length > 0
      ? ` Podbito qty na ${coveredLines.bumped.length} poz. do pokrycia próśb.`
      : "";
  const teethSkipNote =
    teethServiceOrderIds.size > 0
      ? ` ${teethServiceOrderIds.size} próśb zębowych w uwagach — bez Główne (panel /zeby).`
      : "";
  if (preflightMarkSkipMessage) {
    markIndividualsMessage = `ZD utworzone, ale prośby nie odznaczono (Główne): ${preflightMarkSkipMessage}.${bumpedNote}${teethSkipNote}`;
  } else if (markIds.length) {
    try {
      const markRes = await processIndividualFromSummary(
        markIds,
        "GLOWNE",
        user.email
      );
      markedIndividualOrderIds = markRes.processedIds;
      if (markRes.skippedIds.length) {
        markIndividualsMessage = `ZD utworzone. Odznaczono ${markRes.processedIds.length} próśb (Główne); pominięto ${markRes.skippedIds.length} (status/zęby).${bumpedNote}${teethSkipNote}`;
      } else if (composedUwagi.omittedServiceCount > 0) {
        markIndividualsMessage = `ZD utworzone. Odznaczono ${markRes.processedIds.length} próśb; ${composedUwagi.omittedServiceCount} usług nie zmieściło się w uwagach — nie odznaczono.${bumpedNote}${teethSkipNote}`;
      } else if (bumpedNote || teethSkipNote) {
        markIndividualsMessage = `ZD utworzone. Odznaczono ${markRes.processedIds.length} próśb (Główne).${bumpedNote}${teethSkipNote}`;
      }
      revalidatePath("/", "layout");
      revalidatePath("/podsumowanie");
      revalidatePath("/zakupy/szacunek");
    } catch (e) {
      markIndividualsMessage =
        e instanceof Error
          ? `ZD utworzone, ale nie odznaczono próśb (Główne): ${e.message}${bumpedNote}${teethSkipNote}`
          : `ZD utworzone, ale nie odznaczono próśb (Główne) — zrób to w panelu Dziś.${bumpedNote}${teethSkipNote}`;
    }
  } else if (composedUwagi.omittedServiceCount > 0) {
    markIndividualsMessage = `ZD utworzone. ${composedUwagi.omittedServiceCount} usług nie zmieściło się w uwagach — prośby nie odznaczono.${bumpedNote}${teethSkipNote}`;
  } else if (bumpedNote || teethSkipNote) {
    markIndividualsMessage = `ZD utworzone.${bumpedNote}${teethSkipNote}`;
  }

  const withMark = <T extends Record<string, unknown>>(base: T) => ({
    ...base,
    ...(markedIndividualOrderIds.length
      ? { markedIndividualOrderIds }
      : {}),
    ...(markIndividualsMessage ? { markIndividualsMessage } : {}),
  });

  let dokNrPelny = `ZD/${dokId}`;
  try {
    const doc = await getSubiektOrdersZd(dokId);
    dokNrPelny = String(doc.dok_NrPelny ?? "").trim() || dokNrPelny;

    if (!persistSnapshots) {
      return withMark({
        ok: true as const,
        dokId,
        dokNrPelny,
        lineCount: linesCheck.lines.length,
        snapshotOk: false,
        snapshotMessage: "Brak konfiguracji hosta — historia nie zapisana.",
      });
    }

    let packagingByTwId: Map<number, number>;
    try {
      packagingByTwId = new Map();
      const packaging = await fetchZdEstimatePackaging();
      for (const row of packaging) {
        packagingByTwId.set(row.subiektTwId, row.unitsPerPackage);
      }
    } catch (e) {
      return withMark({
        ok: true as const,
        dokId,
        dokNrPelny,
        lineCount: linesCheck.lines.length,
        snapshotOk: false,
        snapshotMessage:
          e instanceof Error
            ? `ZD utworzone, opakowania niedostępne — historia nie zapisana: ${e.message}`
            : "ZD utworzone, opakowania niedostępne — użyj „Powiąż ZD”.",
      });
    }

    let pairRatioByTwId: Map<number, number>;
    try {
      const pairs = await fetchZdProductPairs();
      pairRatioByTwId = buildPairRatioByTwId(pairs);
    } catch (e) {
      return withMark({
        ok: true as const,
        dokId,
        dokNrPelny,
        lineCount: linesCheck.lines.length,
        snapshotOk: false,
        snapshotMessage:
          e instanceof Error
            ? `ZD utworzone, pary niedostępne — historia nie zapisana: ${e.message}`
            : "ZD utworzone, pary niedostępne — użyj „Powiąż ZD”.",
      });
    }

    const orderableTwIds = new Set(createLines.map((l) => l.twId));

    const built = buildZdEstimateSnapshotLinesFromDocChecked(doc, {
      packagingByTwId,
      pairRatioByTwId,
      lineMeta: input.lineMeta ?? null,
      confirmedEstimateTwIds: orderableTwIds,
      requirePackaging: true,
    });

    if (!built.ok) {
      return withMark({
        ok: true as const,
        dokId,
        dokNrPelny,
        lineCount: linesCheck.lines.length,
        snapshotOk: false,
        snapshotMessage: `ZD utworzone (${dokNrPelny}), ${enrichSnapshotPackagingErrorMessage(
          built.message,
          doc,
          orderableTwIds
        )}`,
      });
    }

    if (!built.lines.length) {
      return withMark({
        ok: true as const,
        dokId,
        dokNrPelny,
        lineCount: linesCheck.lines.length,
        snapshotOk: false,
        snapshotMessage:
          "ZD utworzone, ale nie udało się odczytać pozycji do historii — użyj „Powiąż ZD”.",
      });
    }

    const eligibleForHistory = !isFulfilledZdDocumentStatus(doc);

    try {
      const { lineCount } = await upsertZdEstimateOrderSnapshot({
        dokId,
        dokNrPelny,
        linkedBy: user.id,
        supplierKhId: khRes.khId,
        scopeMode: scopeRes.scopeMode,
        grtId: scopeRes.grtId,
        cechaId: scopeRes.cechaId,
        hostKind,
        eligibleForHistory,
        lines: built.lines,
      });
      return withMark({
        ok: true as const,
        dokId,
        dokNrPelny,
        lineCount,
        snapshotOk: true,
      });
    } catch (snapErr) {
      return withMark({
        ok: true as const,
        dokId,
        dokNrPelny,
        lineCount: built.lines.length,
        snapshotOk: false,
        snapshotMessage:
          snapErr instanceof Error
            ? `ZD utworzone (${dokNrPelny}), snapshot nie zapisany: ${snapErr.message}`
            : `ZD utworzone (${dokNrPelny}), snapshot nie zapisany — użyj „Powiąż ZD”.`,
      });
    }
  } catch (e) {
    return withMark({
      ok: true as const,
      dokId,
      dokNrPelny,
      lineCount: linesCheck.lines.length,
      snapshotOk: false,
      snapshotMessage:
        e instanceof Error
          ? `ZD utworzone (dok_Id ${dokId}), odczyt/snapshot: ${e.message}`
          : `ZD utworzone (dok_Id ${dokId}) — użyj „Powiąż ZD”.`,
    });
  }
}

export type ZdEstimateFindRecentAfterCreateResult =
  | {
      ok: true;
      documents: ZdEstimateLinkCandidate[];
    }
  | { ok: false; message: string };

/** Świeże ZD dostawcy (np. po timeout create) — do ręcznego powiązania. */
export async function actionFindRecentZdAfterCreateAttempt(input: {
  supplierKhId: number;
  /** ISO — domyślnie ~15 min wstecz względem dziś (filtr dataOd). */
  minutesBack?: number;
}): Promise<ZdEstimateFindRecentAfterCreateResult> {
  await requireZdEstimateAdmin("read");
  const orders = resolveSubiektOrdersConfig();
  if (!orders.ok) {
    return { ok: false, message: orders.message };
  }
  const khId = Math.trunc(Number(input.supplierKhId));
  if (!(khId > 0)) {
    return { ok: false, message: "Nieprawidłowy kh_Id." };
  }
  try {
    const minutes = Math.min(
      120,
      Math.max(5, Math.round(input.minutesBack ?? 15))
    );
    const dataDo = warsawNowParts().dateKey;
    const end = new Date(`${dataDo}T12:00:00Z`);
    end.setUTCDate(end.getUTCDate() - 1);
    const dataOd = end.toISOString().slice(0, 10);
    const list = await searchSubiektOrdersZd({
      dataOd,
      dataDo,
      page: 1,
      pageSize: 50,
    });
    const cutoff = Date.now() - minutes * 60_000;
    const documents: ZdEstimateLinkCandidate[] = (list.data ?? [])
      .filter((d) => zdListItemMatchesSupplierKhIds(d, [khId]))
      .map((d) => ({
        dokId: Number(d.dok_Id),
        dokNrPelny: String(d.dok_NrPelny ?? "").trim() || `ZD/${d.dok_Id}`,
        dataWyst: d.dok_DataWyst ? String(d.dok_DataWyst).slice(0, 10) : null,
        status: d.dok_Status != null ? Number(d.dok_Status) : null,
      }))
      .filter((d) => {
        if (!(d.dokId > 0)) return false;
        if (!d.dataWyst) return true;
        const t = Date.parse(`${d.dataWyst}T12:00:00Z`);
        // dataWyst jest datą dnia — filtr minutowy słaby; pokazujemy ZD z dziś/wczoraj dla kh
        return Number.isFinite(t) ? t >= cutoff - 48 * 3600_000 : true;
      })
      .slice(0, 20);
    return { ok: true, documents };
  } catch (e) {
    return {
      ok: false,
      message:
        userFacingErrorText(e, "Nie udało się wyszukać świeżych ZD."),
    };
  }
}

export type ZdEstimateListSnapshotsResult =
  | { ok: true; snapshots: ZdEstimateOrderSnapshotRow[] }
  | { ok: false; message: string };

export async function actionListZdEstimateSnapshots(): Promise<ZdEstimateListSnapshotsResult> {
  await requireZdEstimateAdmin("read");
  try {
    const snapshots = await fetchRecentZdEstimateOrderSnapshots(30);
    return { ok: true, snapshots };
  } catch (e) {
    return {
      ok: false,
      message:
        userFacingErrorText(e, "Nie udało się wczytać snapshotów ZD."),
    };
  }
}

export type ZdProductPairsActionResult =
  | { ok: true; pairs: ZdProductPairRow[] }
  | { ok: false; message: string; pairs?: ZdProductPairRow[] };

export async function actionListZdProductPairs(): Promise<ZdProductPairsActionResult> {
  await requireZdEstimateAdmin("read");
  try {
    const pairs = await fetchZdProductPairs();
    return { ok: true, pairs };
  } catch (e) {
    return {
      ok: false,
      message: userFacingErrorText(e, "Nie udało się wczytać par."),
    };
  }
}

export async function actionUpsertZdProductPair(input: {
  packTwId: number;
  pieceTwId: number;
  unitsPerPack: number;
  packSymbol?: string | null;
  packNazwa?: string | null;
  pieceSymbol?: string | null;
  pieceNazwa?: string | null;
  note?: string | null;
}): Promise<ZdProductPairsActionResult> {
  const user = await requireZdEstimateAdmin("mutate");
  try {
    await upsertZdProductPair({
      ...input,
      source: "manual",
      forceManual: true,
      createdBy: user.id,
    });
    // „Tylko na prośbę” kanonicznie na pack — przepnij istniejący wpis z piece.
    try {
      const pieceRow = await fetchZdEstimateOnRequest(input.pieceTwId);
      if (pieceRow && input.pieceTwId !== input.packTwId) {
        await upsertZdEstimateOnRequest({
          subiektTwId: input.packTwId,
          twSymbol: input.packSymbol ?? pieceRow.twSymbol,
          twNazwa: (input.packNazwa ?? pieceRow.twNazwa).trim() || pieceRow.twNazwa,
          grtId: pieceRow.grtId,
          grtNazwa: pieceRow.grtNazwa,
          note: pieceRow.note,
          createdBy: user.id,
        });
        await deleteZdEstimateOnRequest(input.pieceTwId);
      }
    } catch {
      /* ignore — lista on-request opcjonalna względem par */
    }
    const pairs = await fetchZdProductPairs();
    return { ok: true, pairs };
  } catch (e) {
    return {
      ok: false,
      message: userFacingErrorText(e, "Nie udało się zapisać pary."),
    };
  }
}

export async function actionDeleteZdProductPair(input: {
  id: string;
}): Promise<ZdProductPairsActionResult> {
  await requireZdEstimateAdmin("mutate");
  try {
    await deleteZdProductPair(input.id);
    const pairs = await fetchZdProductPairs();
    return { ok: true, pairs };
  } catch (e) {
    return {
      ok: false,
      message: userFacingErrorText(e, "Nie udało się usunąć pary."),
    };
  }
}

export type ZdProductBomsActionResult =
  | { ok: true; boms: ZdProductBomRow[] }
  | { ok: false; message: string };

export async function actionListZdProductBoms(): Promise<ZdProductBomsActionResult> {
  await requireZdEstimateAdmin("read");
  try {
    const boms = await fetchZdProductBoms();
    return { ok: true, boms };
  } catch (e) {
    return {
      ok: false,
      message:
        e instanceof Error ? e.message : ZD_BOM_UI.loadErrorShort,
    };
  }
}

export async function actionUpsertZdProductBom(input: {
  parentTwId: number;
  label?: string | null;
  stockAsCover?: boolean;
  preset?: "assemble" | "buy_separate" | "kit_only" | string | null;
  demandAllocation?: "explode" | "separate" | string | null;
  purchaseTarget?: "components" | "as_sold" | "kit_only" | string | null;
  note?: string | null;
  parentSymbol?: string | null;
  parentNazwa?: string | null;
  components: {
    componentTwId: number;
    qtyPerParent: number;
    componentSymbol?: string | null;
    componentNazwa?: string | null;
  }[];
}): Promise<ZdProductBomsActionResult> {
  const user = await requireZdEstimateAdmin("mutate");
  try {
    await upsertZdProductBom({
      ...input,
      createdBy: user.id,
    });
    const boms = await fetchZdProductBoms();
    return { ok: true, boms };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : ZD_BOM_UI.saveError,
    };
  }
}

export async function actionDeleteZdProductBom(input: {
  id: string;
}): Promise<ZdProductBomsActionResult> {
  await requireZdEstimateAdmin("mutate");
  try {
    await deleteZdProductBom(input.id);
    const boms = await fetchZdProductBoms();
    return { ok: true, boms };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : ZD_BOM_UI.deleteError,
    };
  }
}

export async function actionLookupZdProductPairForTwId(
  twId: number
): Promise<
  | {
      ok: true;
      pair: ZdProductPairRow | null;
      role: "pack" | "piece" | null;
    }
  | { ok: false; message: string }
> {
  try {
    const { requireSubiektLookup } = await import("@/lib/auth");
    await requireSubiektLookup();
    const id = Math.trunc(Number(twId));
    if (!(id > 0)) return { ok: true, pair: null, role: null };
    const { fetchZdProductPairByTwId } = await import(
      "@/lib/data/zd-product-pairs"
    );
    const pair = await fetchZdProductPairByTwId(id);
    if (!pair) return { ok: true, pair: null, role: null };
    const role =
      pair.packTwId === id ? "pack" : pair.pieceTwId === id ? "piece" : null;
    return { ok: true, pair, role };
  } catch (e) {
    return {
      ok: false,
      message: userFacingErrorText(e, "Nie udało się sprawdzić pary."),
    };
  }
}

/**
 * Sync z GET /products/komplety gdy endpoint będzie dostępny.
 */
export async function actionSyncZdProductPairsFromSubiekt(): Promise<
  ZdProductPairsActionResult & { synced?: number; skipped?: number }
> {
  const user = await requireZdEstimateAdmin("mutate");
  try {
    const { searchSubiektProductKomplety } = await import("@/lib/subiekt/api");
    const { filterKompletyForZdProductPairSync } = await import(
      "@/lib/orders/zd-product-pair-sync"
    );
    const list = await searchSubiektProductKomplety({ pageSize: 200 });
    const { accepted, skipped: skippedFilter } =
      filterKompletyForZdProductPairSync(list.data ?? []);
    let synced = 0;
    let skipped = skippedFilter;
    for (const row of accepted) {
      try {
        await upsertZdProductPair({
          packTwId: row.kompletTwId,
          pieceTwId: row.skladnikTwId,
          unitsPerPack: Math.trunc(row.liczba),
          source: "subiekt_komplet",
          subiektKplId: row.kpl_Id,
          packSymbol: row.kompletSymbol,
          pieceSymbol: row.skladnikSymbol,
          createdBy: user.id,
        });
        synced += 1;
      } catch {
        skipped += 1;
      }
    }
    const pairs = await fetchZdProductPairs();
    return { ok: true, pairs, synced, skipped };
  } catch (e) {
    try {
      const pairs = await fetchZdProductPairs();
      return {
        ok: false,
        pairs,
        message:
          userFacingErrorText(e, "Sync kompletów niedostępny — dodaj pary ręcznie lub wdróż GET /products/komplety na hoście ORDERS."),
      };
    } catch {
      return {
        ok: false,
        message:
          userFacingErrorText(e, "Sync kompletów niedostępny — dodaj pary ręcznie lub wdróż GET /products/komplety na hoście ORDERS."),
      };
    }
  }
}

export type ZdEstimateSupplierContactResult =
  | {
      ok: true;
      id: string;
      name: string;
      notes: string;
      mails: string;
      extra_info: string;
    }
  | { ok: false; message: string };

/** Kontakt karty dostawcy — mailto / kopiuj w panelu po create ZD. */
export async function actionGetSupplierContact(
  supplierId: string
): Promise<ZdEstimateSupplierContactResult> {
  await requireZdEstimateAdmin("read");
  const id = String(supplierId ?? "").trim();
  if (!id) {
    return { ok: false, message: "Brak identyfikatora dostawcy." };
  }
  try {
    const rows = await fetchSuppliersWithSchedules(undefined, {
      supplierIds: [id],
      // Kontakt po create — także dla kart nieaktywnych (szacunek mógł iść z aliasu).
      activeOnly: false,
    });
    const row = rows[0];
    if (!row) {
      return { ok: false, message: "Nie znaleziono dostawcy." };
    }
    return {
      ok: true,
      id: String(row.id),
      name: String(row.name ?? "").trim() || "Dostawca",
      notes: String(row.notes ?? ""),
      mails: String(row.mails ?? ""),
      extra_info: String(row.extra_info ?? ""),
    };
  } catch (e) {
    return {
      ok: false,
      message: userFacingErrorText(e, "Nie udało się wczytać kontaktu dostawcy."),
    };
  }
}

export type ZdEstimateSupplierScopeResolveResult =
  | {
      ok: true;
      supplierId: string;
      supplierName: string;
      mode: "grupa" | "cecha";
      grupaId: number | null;
      cechaId: number | null;
      label: string;
      source: "db" | "heuristic";
    }
  | {
      ok: false;
      supplierId: string;
      supplierName: string | null;
      reason: "missing" | "ambiguous" | "unavailable" | "not_found";
      message: string;
    };

async function loadSupplierName(supplierId: string): Promise<string | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("suppliers")
    .select("id, name")
    .eq("id", supplierId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return String((data as { name?: string }).name ?? "").trim() || null;
}

/**
 * Mapuje dostawcę OnTime → zakres estimate (DB lub heurystyka + search Subiekta).
 * Udane trafienie heurystyczne zapisuje mapowanie (kolejne wejścia z DB).
 */
export async function actionResolveZdEstimateScopeForSupplier(
  supplierId: string
): Promise<ZdEstimateSupplierScopeResolveResult> {
  await requireZdEstimateAdmin("read");
  const id = String(supplierId ?? "").trim();
  if (!id) {
    return {
      ok: false,
      supplierId: "",
      supplierName: null,
      reason: "not_found",
      message: "Brak identyfikatora dostawcy.",
    };
  }

  let supplierName: string | null = null;
  try {
    supplierName = await loadSupplierName(id);
  } catch (e) {
    return {
      ok: false,
      supplierId: id,
      supplierName: null,
      reason: "unavailable",
      message:
        userFacingErrorText(e, "Nie udało się wczytać dostawcy."),
    };
  }
  if (!supplierName) {
    return {
      ok: false,
      supplierId: id,
      supplierName: null,
      reason: "not_found",
      message: "Nie znaleziono dostawcy.",
    };
  }

  let dbRow = null;
  try {
    dbRow = await fetchZdEstimateSupplierScope(id);
  } catch (e) {
    return {
      ok: false,
      supplierId: id,
      supplierName,
      reason: "unavailable",
      message:
        userFacingErrorText(e, "Nie udało się odczytać mapowania zakresu."),
    };
  }

  if (dbRow) {
    const resolved = resolveZdEstimateSupplierScopeFromSources({
      supplierName,
      db: {
        mode: dbRow.mode,
        grupaId: dbRow.grupaId,
        cechaId: dbRow.cechaId,
        label: dbRow.label,
      },
      groups: [],
      cechy: [],
    });
    if (resolved.ok) {
      return {
        ok: true,
        supplierId: id,
        supplierName,
        mode: resolved.mode,
        grupaId: resolved.grupaId,
        cechaId: resolved.cechaId,
        label: resolved.label,
        source: "db",
      };
    }
  }

  const orders = resolveSubiektOrdersConfig();
  if (!orders.ok) {
    return {
      ok: false,
      supplierId: id,
      supplierName,
      reason: "unavailable",
      message: orders.message,
    };
  }

  let groups: ZdEstimateScopeCandidate[] = [];
  let cechy: ZdEstimateScopeCandidate[] = [];
  try {
    const token =
      supplierName.split(/\s+/).find((t) => t.trim().length >= 3)?.trim() ??
      supplierName.slice(0, 24);
    const searchQ =
      /ivoclar/i.test(supplierName)
        ? "Ivoclar"
        : /falcon/i.test(supplierName)
          ? "Falcon"
          : token;

    const [gRes, cRes] = await Promise.all([
      searchSubiektProductGroups({ search: searchQ, page: 1, pageSize: 40 }),
      searchSubiektProductCechy({ search: searchQ, page: 1, pageSize: 40 }),
    ]);
    groups = (gRes.data ?? [])
      .map((g) => ({
        mode: "grupa" as const,
        id: Math.trunc(Number(g.grt_Id)),
        label: String(g.grt_Nazwa ?? "").trim() || `Grupa ${g.grt_Id}`,
      }))
      .filter((g) => g.id > 0);
    cechy = (cRes.data ?? [])
      .map((c) => ({
        mode: "cecha" as const,
        id: Math.trunc(Number(c.ctw_Id)),
        label: String(c.ctw_Nazwa ?? "").trim() || `Cecha ${c.ctw_Id}`,
      }))
      .filter((c) => c.id > 0);
  } catch (e) {
    return {
      ok: false,
      supplierId: id,
      supplierName,
      reason: "unavailable",
      message:
        userFacingErrorText(e, "Nie udało się wyszukać grup/cech w Subiekcie."),
    };
  }

  const resolved = resolveZdEstimateSupplierScopeFromSources({
    supplierName,
    db: null,
    groups,
    cechy,
  });

  if (!resolved.ok) {
    const message =
      resolved.reason === "ambiguous"
        ? "Wiele możliwych zakresów Subiekta — wybierz grupę lub cechę ręcznie."
        : "Nie udało się dobrać grupy ani cechy po nazwie dostawcy — przypisz zakres.";
    return {
      ok: false,
      supplierId: id,
      supplierName,
      reason: resolved.reason,
      message,
    };
  }

  try {
    await upsertZdEstimateSupplierScope({
      supplierId: id,
      mode: resolved.mode,
      grupaId: resolved.grupaId,
      cechaId: resolved.cechaId,
      label: resolved.label,
    });
  } catch {
    // Mapowanie opcjonalne przy pierwszym trafieniu — szacunek i tak działa.
  }

  return {
    ok: true,
    supplierId: id,
    supplierName,
    mode: resolved.mode,
    grupaId: resolved.grupaId,
    cechaId: resolved.cechaId,
    label: resolved.label,
    source: "heuristic",
  };
}

export async function actionUpsertZdEstimateSupplierScope(input: {
  supplierId: string;
  mode: "grupa" | "cecha";
  grupaId?: number | null;
  cechaId?: number | null;
  label?: string | null;
}): Promise<
  | { ok: true; scope: Awaited<ReturnType<typeof upsertZdEstimateSupplierScope>> }
  | { ok: false; message: string }
> {
  const user = await requireZdEstimateAdmin("mutate");
  try {
    const scope = await upsertZdEstimateSupplierScope({
      ...input,
      updatedBy: user.id,
    });
    return { ok: true, scope };
  } catch (e) {
    return {
      ok: false,
      message:
        userFacingErrorText(e, "Nie udało się zapisać mapowania zakresu."),
    };
  }
}
