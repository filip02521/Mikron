"use server";

import type { SupplierLocation } from "@/types/database";
import { userFacingErrorText } from "@/lib/ui/user-facing-error";
// @service-role-ok — autoryzacja requireZdEstimateAdmin() (operacje dostaw); service role z pełnym scope po warstwie aplikacji.
import { getSessionUser, requireZdEstimateAdmin } from "@/lib/auth";
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
  onRequestIdsToClearForExcludedTw,
  onRequestIdsToClearForTw,
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
  deleteZdEstimateMinStock,
  fetchZdEstimateMinStock,
  upsertZdEstimateMinStock,
  type ZdEstimateMinStockRow,
} from "@/lib/data/zd-estimate-min-stock";
import { fetchZdBoostPowerPreset, upsertZdBoostPowerPreset } from "@/lib/data/zd-estimate-boost-preset";
import {
  fetchZdEstimateExtrasPolicy,
  upsertZdEstimateExtrasPolicy,
} from "@/lib/data/zd-estimate-extras-policy";
import { fetchOwnZdEstimateUiPrefs, upsertOwnZdEstimateUiPrefs } from "@/lib/data/zd-estimate-ui-prefs";
import { ZD_ESTIMATE_UI_PREFS_DEFAULTS } from "@/lib/orders/zd-estimate-prefs";
import {
  parseZdEstimateExtrasPolicy,
  ZD_ESTIMATE_EXTRAS_POLICY_DEFAULT,
} from "@/lib/orders/zd-estimate-extras-policy";
import {
  collectTodayScheduleSuppliers,
  zdEstimateScopeCoverage,
} from "@/lib/orders/zd-estimate-scope-coverage";
import {
  normalizeZdBoostPowerPreset,
  type ZdBoostPowerPreset,
} from "@/lib/orders/zd-estimate-boost-presets";
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
import { fetchSuppliersWithSchedules } from "@/lib/data/queries";
import { processIndividualFromSummary, markStandardOrdered } from "@/lib/services/orders";
import {
  defaultZdCreateUwagi,
  buildZdCreateApiBody,
  ensureZdCreateLinesCoverIndividualExtras,
  resolveZdCreateKhId,
  validateZdCreateClientLines,
} from "@/lib/orders/zd-estimate-create-zd";
import { resolveDocAfterZdCreate } from "@/lib/orders/zd-estimate-create-doc";
import {
  buildIndividualEstimateExtras,
  collectIndividualOrderIdsForZdCreate,
  composeZdCreateUwagiWithServices,
  filterPendingOrdersByIds,
  type ZdEstimatePendingIndividualOrder,
} from "@/lib/orders/zd-estimate-individual";
import {
  normalizeZdEstimateBulkProducts,
  normalizeZdEstimateBulkTwIds,
  type ZdEstimateBulkProductInput,
} from "@/lib/orders/zd-estimate-bulk";
import { revalidatePath } from "next/cache";
import { isProcurementDraftReady } from "@/lib/orders/procurement-readiness";
import { assessRequestCompleteness } from "@/lib/orders/request-completeness";
import { excludeConsumedPendingOrders } from "@/lib/orders/zd-estimate-post-create";
import { isSupplierOrderOnDemand } from "@/lib/orders/supplier-on-demand";
import { dateToIso, resolveSupplierInterval } from "@/lib/orders/dates";
import { todayInWarsaw } from "@/lib/time/warsaw";
import {
  buildDailyPanelUndoPayload,
  type DailyPanelUndoPayload,
} from "@/lib/orders/daily-panel-undo";
import {
  captureIndividualOrdersSnapshot,
  captureScheduleSnapshot,
  buildMarkOrderedFeedback,
} from "@/lib/services/daily-panel-undo";
import { resolveSupplierForScopeSelection } from "@/lib/orders/zd-estimate-group-stock";
import {
  resolveZdScopeSupplierMapping,
  type ZdEstimateScopeMappingRef,
} from "@/lib/orders/zd-estimate-supplier-scope";
import {
  DEFAULT_DNI_ZAPASU,
  salesWindowFromDniZapasu,
  stockPeriodToDniZapasu,
  type ManualZdEstimateResult,
} from "@/lib/orders/zd-estimate-manual";
import {
  fetchReservedOverlapSlicesByTwIds,
  fetchZdEstimatePendingIndividualOrders,
  reservedOverlapMapToDto,
  resolveIndividualExtrasWithReservationOverlap,
  resolveSupplierKhIdsForHistory,
  runZdOrderEngine,
} from "@/lib/orders/zd-order-engine";
import { loadZdOrderHorizons } from "@/lib/orders/zd-order-horizon-load";
import {
  assertOrderMultiple,
  assertPackagingUnits,
  normalizePackagingDocumentUnitMode,
  type ZdPackagingDocumentUnitMode,
} from "@/lib/orders/zd-estimate-packaging";
import { fetchTeethProductTwIdSet } from "@/lib/data/teeth-products";
import {
  buildPairRatioByTwId,
  buildZdEstimateSnapshotLinesFromDocChecked,
  enrichSnapshotPackagingErrorMessage,
  resolveConfirmedEstimateTwIdsForLink,
} from "@/lib/orders/zd-estimate-snapshot-lines";
import {
  fetchRecentZdEstimateOrderSnapshots,
  fetchZdEstimateOrderSnapshotLines,
  updateZdEstimateSnapshotEligibleForHistory,
  upsertZdEstimateOrderSnapshot,
  type ZdEstimateOrderSnapshotRow,
  type ZdEstimateSnapshotScopeMode,
} from "@/lib/data/zd-estimate-order-snapshots";
import {
  deleteZdEstimateSupplierScope,
  fetchZdEstimateSupplierScope,
  listZdEstimateSupplierScopes,
  setPrimaryZdEstimateSupplierScope,
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
  fetchSubiektZdEstimateZkPage,
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
import {
  formatZdCreateSferaUserMessage,
  humanizeSferaCreateError,
} from "@/lib/subiekt/sfera-create-error";
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
  resolveZdEstimateRunScope,
  type ZdEstimateRunMode,
} from "@/lib/orders/zd-estimate-scope";
import type { ZdEstimateUiSessionSnapshot } from "@/lib/orders/zd-estimate-ui-session-snapshot";
import {
  buildZdEstimateUiSessionSnapshotFromPolicz,
  type ZdEstimateUiSessionPoliczSeed,
} from "@/lib/orders/zd-estimate-ui-session-from-policz";
import {
  completeZdEstimateRunProgress,
  failZdEstimateRunProgress,
  getZdEstimateRunProgressForOwner,
  isValidZdEstimateRunProgressId,
  registerZdEstimateRunProgress,
  updateZdEstimateRunProgress,
  type ZdEstimateRunProgressPollResult,
} from "@/lib/orders/zd-estimate-run-progress";
import { ZD_ESTIMATE_UI_SESSION_SNAPSHOT_SCHEMA_VERSION } from "@/lib/orders/zd-estimate-external-session";
import {
  fetchAllReservedZkRowsForTwId,
  sumZdEstimateReservedZkQuantity,
  type ZdEstimateReservationsSummary,
  type ZdEstimateReservedZkRow,
} from "@/lib/orders/zd-estimate-reservations";
import {
  type ZdEstimateReservedOverlapSlice,
} from "@/lib/orders/zd-estimate-prosba-reservation-overlap";

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
  /** Plan OnTime — do coverage Dziś bez mapowania. */
  computedNextDate: string | null;
  /** Jak panel Dziś — nie wchodzi do kolejki planowej. */
  orderOnDemand: boolean;
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
  /** Skąd wzięto dostawcę: mapowanie zakresów albo heurystyka nazwy. */
  supplierMatchSource?: "mapping" | "name" | null;
  /** Mapowanie DB wskazuje ID, którego nie ma na aktywnej liście dostawców. */
  supplierMappingUnresolved?: boolean;
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
  supplierMatchSource?: "mapping" | "name" | null;
  supplierMappingUnresolved?: boolean;
};

export type ZdEstimateRunInput = {
  mode: ZdEstimateRunMode;
  /** Wymagane gdy mode === "grupa". */
  grupaId?: number | null;
  /** Wymagane gdy mode === "cecha". */
  cechaId?: number | null;
  /** Etykieta zakresu (nazwa cechy/grupy) — do seeda sesji UI po Policz. */
  scopeLabel?: string | null;
  /** Dostawca OnTime — filtr historii snapshotów (kh + aliasy). Bez → brak historii. */
  supplierId?: string | null;
  dniZapasu: number;
  /** yyyy-mm-dd — gdy brak, liczone z dniZapasu względem dziś (Warsaw). */
  dataOd?: string | null;
  dataDo?: string | null;
  zapasMin?: number;
  /**
   * Lekki seed UI (bez linii) — sesja zapisuje się po stronie serwera w tym samym
   * Policz, żeby duże cechy (np. Ivoclar) nie musiały ponownie uploadować snapshotu.
   */
  uiSessionSeed?: ZdEstimateUiSessionPoliczSeed | null;
  /**
   * Client-minted UUID for live progress polling (in-memory, owner-bound).
   * Optional — without it Policz works as before.
   */
  progressId?: string | null;
  /**
   * Opcja „Uwzględnij czas dostawy i harmonogram” (domyślnie wyłączona):
   * cel liczony na max(dni zapasu, dni do kolejnego zamówienia + czas dostawy).
   * Okno sprzedaży (rotacja) bez zmian.
   */
  leadTimeHorizon?: boolean;
};

export type ZdEstimateRunResult =
  | {
      ok: true;
      result: ManualZdEstimateResult;
      /** Historia snapshotów użyta w Policz (do live refresh). */
      historyByTwId: ZdEstimateHistoryEntryDto[];
      /**
       * Fetch historii rzucił (nie: pusta mapa). Cięcia historyczne mogły nie wejść —
       * UI blokuje Create do ponownego Policz.
       */
      historyFetchFailed?: boolean;
      /** Wiszące prośby dostawcy (zamówienie Nowe). null = fetch nieudany (UI czyści listę i blokuje Create). */
      pendingIndividuals: ZdEstimatePendingIndividualOrder[] | null;
      /** true gdy fetch próśb ucięty limitem (możliwe brakujące). */
      pendingIndividualsTruncated?: boolean;
      /** Komunikat gdy fetch próśb przy Policz się nie udał. */
      pendingIndividualsError?: string | null;
      /**
       * Zarezerwowane ZK per tw (overlap prośba↔klient) z Policz —
       * Workbench nie musi dociągać drugi raz.
       */
      prosbaReservedByTwId?: Record<string, ZdEstimateReservedOverlapSlice[]>;
      /** Tw, dla których Policz próbował dociągnąć overlap (także gdy pusto). */
      prosbaOverlapCandidateTwIds?: number[];
      /**
       * true = overlap dociągnięty / niepotrzebny (można skipnąć refetch w UI).
       * false/undefined = nie udało się — Workbench powinien dociągnąć sam.
       */
      prosbaOverlapResolved?: boolean;
      /** Zakresy w tym Policz: główny + pozostałe zakresy dostawcy. */
      scopesIncluded?: import("@/lib/orders/zd-order-engine").ZdOrderScopeIncluded[];
      /** Towary ze wspólnego zakresu przypisane innemu dostawcy (ukryte). */
      assignedElsewhere?: import("@/lib/orders/zd-order-engine").ZdOrderAssignedElsewhere[];
      /** tw → dostawca ostatniego ZD, gdy inny niż liczony (podpowiedź). */
      otherSupplierHintByTwId?: Record<number, string>;
      /** Rozbicie horyzontu, gdy opcja czasu dostawy była zaznaczona. */
      horizon?: import("@/lib/orders/zd-order-horizon").ZdOrderHorizon | null;
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
      minStock: ZdEstimateMinStockRow[];
      productPairs: ZdProductPairRow[];
      productBoms: ZdProductBomRow[];
      /** Odświeżony katalog zębów — auto-wykluczenia. */
      teethTwIds: number[];
      /** Wspólna moc boosta użyta w tym Policz. */
      boostPreset: ZdBoostPowerPreset;
      /**
       * Sesja UI utworzona na serwerze razem z Policz (bez drugiego ciężkiego POST).
       * null = zapis nieudany — klient może spróbować fallbacku.
       */
      uiSessionId?: string | null;
      uiSessionCreatedAt?: string | null;
      /**
       * true = serwer skasował poprzednią active sesję (nawet gdy insert padł).
       * Klient musi unieważnić lokalny token przy porzuconym Policz.
       */
      uiSessionRotated?: boolean;
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

function enrichGroup(
  group: { grt_Id: number; grt_Nazwa: string },
  suppliers: ZdEstimateSupplierOption[],
  scopes: readonly ZdEstimateScopeMappingRef[] = []
): ZdEstimateGroupOption {
  const mapping = resolveZdScopeSupplierMapping(scopes, "grupa", group.grt_Id);
  const { supplier: matched, source, mappingUnresolved } =
    resolveSupplierForScopeSelection({
      scopeName: group.grt_Nazwa,
      suppliers,
      mappedSupplierId: mapping.mappedSupplierId,
      nameMatchSupplierIds: mapping.candidateSupplierIds,
    });
  return {
    grt_Id: group.grt_Id,
    grt_Nazwa: group.grt_Nazwa,
    supplierId: matched?.id ?? null,
    supplierName: matched?.name ?? null,
    dniZapasu: matched?.dniZapasu ?? null,
    stockLabel: matched?.stockLabel ?? null,
    subiektKhId: matched?.subiektKhId ?? null,
    additionalSubiektKhIds: matched?.additionalSubiektKhIds ?? [],
    supplierMatchSource: source,
    supplierMappingUnresolved: mappingUnresolved === true,
  };
}

function enrichCecha(
  cecha: { ctw_Id: number; ctw_Nazwa: string },
  suppliers: ZdEstimateSupplierOption[],
  scopes: readonly ZdEstimateScopeMappingRef[] = []
): ZdEstimateCechaOption {
  const mapping = resolveZdScopeSupplierMapping(scopes, "cecha", cecha.ctw_Id);
  const { supplier: matched, source, mappingUnresolved } =
    resolveSupplierForScopeSelection({
      scopeName: cecha.ctw_Nazwa,
      suppliers,
      mappedSupplierId: mapping.mappedSupplierId,
      nameMatchSupplierIds: mapping.candidateSupplierIds,
    });
  return {
    ctw_Id: cecha.ctw_Id,
    ctw_Nazwa: cecha.ctw_Nazwa,
    supplierId: matched?.id ?? null,
    supplierName: matched?.name ?? null,
    dniZapasu: matched?.dniZapasu ?? null,
    stockLabel: matched?.stockLabel ?? null,
    subiektKhId: matched?.subiektKhId ?? null,
    additionalSubiektKhIds: matched?.additionalSubiektKhIds ?? [],
    supplierMatchSource: source,
    supplierMappingUnresolved: mappingUnresolved === true,
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
      computedNextDate: s.schedule?.computed_next_date?.trim() || null,
      orderOnDemand: isSupplierOrderOnDemand(s),
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
  /** Ulubione cechy z prefs — chipy w trybie Cecha. */
  quickCechy: ZdEstimateCechaOption[];
  exclusions: ZdEstimateExclusionRow[];
  /** Gdy ustawione — nie ufaj pustej liście wykluczeń (błąd odczytu). */
  exclusionsError: string | null;
  onRequests: ZdEstimateOnRequestRow[];
  onRequestsError: string | null;
  packaging: ZdEstimatePackagingRow[];
  packagingError: string | null;
  minStock: ZdEstimateMinStockRow[];
  minStockError: string | null;
  productPairs: ZdProductPairRow[];
  productPairsError: string | null;
  productBoms: ZdProductBomRow[];
  productBomsError: string | null;
  /** tw_Id z `prosba_teeth_products` — auto-wykluczenie ze szacunku. */
  teethTwIds: number[];
  /** Gdy ustawione — nie ufaj pustej liście zębów (błąd odczytu). */
  teethProductsError: string | null;
  uiPrefs: import("@/lib/orders/zd-estimate-prefs").ZdEstimateUiPrefs;
  extrasPolicy: import("@/lib/orders/zd-estimate-extras-policy").ZdEstimateExtrasPolicy;
  todayScopeCoverage: import("@/lib/orders/zd-estimate-scope-coverage").ZdEstimateScopeCoverage;
  /** Mapowania dostawca → grupa/cecha — do auto-przypisania przy wyborze zakresu. */
  supplierScopes: import("@/lib/data/zd-estimate-supplier-scopes").ZdEstimateSupplierScopeRow[];
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
    // zostaw []
  }

  let exclusions: ZdEstimateExclusionRow[] = [];
  let exclusionsError: string | null = null;
  let onRequests: ZdEstimateOnRequestRow[] = [];
  let onRequestsError: string | null = null;
  let packaging: ZdEstimatePackagingRow[] = [];
  let packagingError: string | null = null;
  let minStock: ZdEstimateMinStockRow[] = [];
  let minStockError: string | null = null;
  let productPairs: ZdProductPairRow[] = [];
  let productPairsError: string | null = null;
  let productBoms: ZdProductBomRow[] = [];
  let productBomsError: string | null = null;
  let teethTwIds: number[] = [];
  let teethProductsError: string | null = null;

  const [
    exclusionsSettled,
    onRequestsSettled,
    packagingSettled,
    minStockSettled,
    productPairsSettled,
    productBomsSettled,
    teethSettled,
  ] = await Promise.all([
    fetchZdEstimateExclusions()
      .then((value) => ({ ok: true as const, value }))
      .catch((e: unknown) => ({ ok: false as const, error: e })),
    fetchZdEstimateOnRequests()
      .then((value) => ({ ok: true as const, value }))
      .catch((e: unknown) => ({ ok: false as const, error: e })),
    fetchZdEstimatePackaging()
      .then((value) => ({ ok: true as const, value }))
      .catch((e: unknown) => ({ ok: false as const, error: e })),
    fetchZdEstimateMinStock()
      .then((value) => ({ ok: true as const, value }))
      .catch((e: unknown) => ({ ok: false as const, error: e })),
    fetchZdProductPairs()
      .then((value) => ({ ok: true as const, value }))
      .catch((e: unknown) => ({ ok: false as const, error: e })),
    fetchZdProductBoms()
      .then((value) => ({ ok: true as const, value }))
      .catch((e: unknown) => ({ ok: false as const, error: e })),
    fetchTeethProductTwIdSet()
      .then((value) => ({ ok: true as const, value }))
      .catch((e: unknown) => ({ ok: false as const, error: e })),
  ]);

  if (exclusionsSettled.ok) exclusions = exclusionsSettled.value;
  else {
    exclusionsError = userFacingErrorText(
      exclusionsSettled.error,
      "Nie udało się wczytać listy wykluczeń."
    );
  }
  if (onRequestsSettled.ok) onRequests = onRequestsSettled.value;
  else {
    onRequestsError = userFacingErrorText(
      onRequestsSettled.error,
      "Nie udało się wczytać listy „tylko na prośbę”."
    );
  }
  if (packagingSettled.ok) packaging = packagingSettled.value;
  else {
    packagingError = userFacingErrorText(
      packagingSettled.error,
      "Nie udało się wczytać ustawień opakowań."
    );
  }
  if (minStockSettled.ok) minStock = minStockSettled.value;
  else {
    minStockError = userFacingErrorText(
      minStockSettled.error,
      "Nie udało się wczytać minimum stanów."
    );
  }
  if (productPairsSettled.ok) productPairs = productPairsSettled.value;
  else {
    productPairsError = userFacingErrorText(
      productPairsSettled.error,
      "Nie udało się wczytać par kompletów."
    );
  }
  if (productBomsSettled.ok) productBoms = productBomsSettled.value;
  else {
    productBomsError =
      productBomsSettled.error instanceof Error
        ? productBomsSettled.error.message
        : ZD_BOM_UI.loadError;
  }
  if (teethSettled.ok) {
    teethTwIds = [...teethSettled.value].sort((a, b) => a - b);
  } else {
    teethProductsError = userFacingErrorText(
      teethSettled.error,
      "Nie udało się wczytać katalogu produktów zębowych."
    );
  }

  let uiPrefs = ZD_ESTIMATE_UI_PREFS_DEFAULTS;
  try {
    uiPrefs = await fetchOwnZdEstimateUiPrefs();
  } catch {
    // zostaw domyślne
  }

  let extrasPolicy = ZD_ESTIMATE_EXTRAS_POLICY_DEFAULT;
  try {
    extrasPolicy = await fetchZdEstimateExtrasPolicy();
  } catch {
    // zostaw domyślne
  }

  let todayScopeCoverage = zdEstimateScopeCoverage([], []);
  let supplierScopes: Awaited<ReturnType<typeof listZdEstimateSupplierScopes>> =
    [];
  try {
    supplierScopes = await listZdEstimateSupplierScopes();
    const todaySuppliers = collectTodayScheduleSuppliers({
      todayKey,
      suppliers: suppliers.map((s) => ({
        id: s.id,
        name: s.name,
        computedNextDate: s.computedNextDate,
        orderOnDemand: s.orderOnDemand,
      })),
    });
    todayScopeCoverage = zdEstimateScopeCoverage(
      todaySuppliers,
      supplierScopes.map((s) => s.supplierId)
    );
  } catch {
    // zostaw puste pokrycie / scopes
  }

  const quickGroups = uiPrefs.favoriteGroups.map((f) =>
    enrichGroup(
      { grt_Id: f.id, grt_Nazwa: f.label },
      suppliers,
      supplierScopes
    )
  );
  const quickCechy = uiPrefs.favoriteCechy.map((f) =>
    enrichCecha(
      { ctw_Id: f.id, ctw_Nazwa: f.label },
      suppliers,
      supplierScopes
    )
  );

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
    quickCechy,
    exclusions,
    exclusionsError,
    onRequests,
    onRequestsError,
    packaging,
    packagingError,
    minStock,
    minStockError,
    productPairs,
    productPairsError,
    productBoms,
    productBomsError,
    teethTwIds,
    teethProductsError,
    uiPrefs,
    extrasPolicy,
    todayScopeCoverage,
    supplierScopes,
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
    let scopes: ZdEstimateScopeMappingRef[] = [];
    try {
      scopes = await listZdEstimateSupplierScopes();
    } catch {
      scopes = [];
    }
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
          suppliers,
          scopes
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
    let scopes: ZdEstimateScopeMappingRef[] = [];
    try {
      scopes = await listZdEstimateSupplierScopes();
    } catch {
      scopes = [];
    }
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
          suppliers,
          scopes
        )
      )
      .filter((c) => Number.isFinite(c.ctw_Id) && c.ctw_Id > 0);
    return { ok: true, cechy };
  } catch (e) {
    const feedback = feedbackFromException(e);
    return { ok: false, message: feedback.message, feedback };
  }
}

const ZD_ESTIMATE_SCOPE_CATALOG_PAGE_SIZE = 40;

export type ZdEstimateScopeCatalogPageMeta = {
  page: number;
  pageSize: number;
  totalCount: number | null;
  totalPages: number | null;
  hasMore: boolean;
};

function resolveCatalogPageMeta(
  page: number,
  pageSize: number,
  rowCount: number,
  pagination: { totalCount?: number; totalPages?: number } | null | undefined
): ZdEstimateScopeCatalogPageMeta {
  const totalCount =
    pagination?.totalCount != null && Number.isFinite(pagination.totalCount)
      ? Math.max(0, Math.trunc(pagination.totalCount))
      : null;
  const totalPages =
    pagination?.totalPages != null && Number.isFinite(pagination.totalPages)
      ? Math.max(0, Math.trunc(pagination.totalPages))
      : totalCount != null
        ? Math.max(1, Math.ceil(totalCount / pageSize))
        : null;
  const hasMore =
    totalPages != null
      ? page < totalPages
      : rowCount >= pageSize;
  return { page, pageSize, totalCount, totalPages, hasMore };
}

/** Katalog grup — `search` opcjonalne (puste = pierwsza strona słownika, jeśli API pozwala). */
export async function actionListZdEstimateGroups(input?: {
  page?: number;
  pageSize?: number;
  search?: string | null;
}): Promise<
  | {
      ok: true;
      groups: ZdEstimateGroupOption[];
      meta: ZdEstimateScopeCatalogPageMeta;
    }
  | { ok: false; message: string; feedback?: SubiektFeedback }
> {
  await requireZdEstimateAdmin("read");
  const page = Math.max(1, Math.trunc(Number(input?.page) || 1));
  const pageSize = Math.min(
    100,
    Math.max(
      1,
      Math.trunc(Number(input?.pageSize) || ZD_ESTIMATE_SCOPE_CATALOG_PAGE_SIZE)
    )
  );
  const search = String(input?.search ?? "").trim();

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
    let scopes: ZdEstimateScopeMappingRef[] = [];
    try {
      scopes = await listZdEstimateSupplierScopes();
    } catch {
      scopes = [];
    }
    const res = await searchSubiektProductGroups({
      ...(search ? { search } : {}),
      page,
      pageSize,
    });
    const groups = (res.data ?? [])
      .map((g: SubiektProductGroup) =>
        enrichGroup(
          {
            grt_Id: Number(g.grt_Id),
            grt_Nazwa: String(g.grt_Nazwa ?? "").trim() || `Grupa ${g.grt_Id}`,
          },
          suppliers,
          scopes
        )
      )
      .filter((g) => Number.isFinite(g.grt_Id) && g.grt_Id > 0);
    return {
      ok: true,
      groups,
      meta: resolveCatalogPageMeta(page, pageSize, groups.length, res.pagination),
    };
  } catch (e) {
    const feedback = feedbackFromException(e);
    return { ok: false, message: feedback.message, feedback };
  }
}

/** Katalog cech — `search` opcjonalne. */
export async function actionListZdEstimateCechy(input?: {
  page?: number;
  pageSize?: number;
  search?: string | null;
}): Promise<
  | {
      ok: true;
      cechy: ZdEstimateCechaOption[];
      meta: ZdEstimateScopeCatalogPageMeta;
    }
  | { ok: false; message: string; feedback?: SubiektFeedback }
> {
  await requireZdEstimateAdmin("read");
  const page = Math.max(1, Math.trunc(Number(input?.page) || 1));
  const pageSize = Math.min(
    100,
    Math.max(
      1,
      Math.trunc(Number(input?.pageSize) || ZD_ESTIMATE_SCOPE_CATALOG_PAGE_SIZE)
    )
  );
  const search = String(input?.search ?? "").trim();

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
    let scopes: ZdEstimateScopeMappingRef[] = [];
    try {
      scopes = await listZdEstimateSupplierScopes();
    } catch {
      scopes = [];
    }
    const res = await searchSubiektProductCechy({
      ...(search ? { search } : {}),
      page,
      pageSize,
    });
    const cechy = (res.data ?? [])
      .map((c: SubiektProductCecha) =>
        enrichCecha(
          {
            ctw_Id: Number(c.ctw_Id),
            ctw_Nazwa:
              String(c.ctw_Nazwa ?? "").trim() || `Cecha ${c.ctw_Id}`,
          },
          suppliers,
          scopes
        )
      )
      .filter((c) => Number.isFinite(c.ctw_Id) && c.ctw_Id > 0);
    return {
      ok: true,
      cechy,
      meta: resolveCatalogPageMeta(page, pageSize, cechy.length, res.pagination),
    };
  } catch (e) {
    const feedback = feedbackFromException(e);
    return { ok: false, message: feedback.message, feedback };
  }
}

export type ZdEstimateProductReservationsResult =
  | {
      ok: true;
      summary: ZdEstimateReservationsSummary;
      rows: ZdEstimateReservedZkRow[];
      reservedQtySum: number;
      truncated: boolean;
      scannedApiRows: number;
    }
  | { ok: false; message: string; feedback?: SubiektFeedback };

/**
 * Rozbicie rezerwacji magazynowej towaru na konkretne ZK (status 7).
 * GET /orders/zd/estimate/zk?towarId=&tylkoBezRez=false
 */
export async function actionFetchZdEstimateProductReservations(input: {
  twId: number;
}): Promise<ZdEstimateProductReservationsResult> {
  await requireZdEstimateAdmin("read");

  const twId = Math.trunc(Number(input.twId));
  if (!Number.isFinite(twId) || twId <= 0) {
    return { ok: false, message: "Nieprawidłowy identyfikator towaru." };
  }

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
    const fetched = await fetchAllReservedZkRowsForTwId({
      twId,
      fetchPage: fetchSubiektZdEstimateZkPage,
    });
    const rows = fetched.rows;
    return {
      ok: true,
      summary: fetched.summary ?? {
        twId,
        symbol: "",
        name: "",
        stanRez: 0,
        otwarteZkZarezerwowane: 0,
        otwarteZkBezRez: 0,
      },
      rows,
      reservedQtySum: sumZdEstimateReservedZkQuantity(rows),
      truncated: fetched.truncated,
      scannedApiRows: fetched.scannedApiRows,
    };
  } catch (e) {
    const feedback = feedbackFromException(e);
    return { ok: false, message: feedback.message, feedback };
  }
}

/**
 * Zarezerwowane ZK dla kandydatów overlap (prośba + tw_StanRez).
 * Fail-open: brak / błąd dla jednego tw = bez korekty tego tw.
 */
export async function actionFetchZdEstimateProsbaReservationOverlap(input: {
  twIds: number[];
}): Promise<
  | {
      ok: true;
      reservedByTwId: Record<string, ZdEstimateReservedOverlapSlice[]>;
    }
  | { ok: false; message: string; feedback?: SubiektFeedback }
> {
  await requireZdEstimateAdmin("read");

  const orders = resolveSubiektOrdersConfig();
  if (!orders.ok) {
    const feedback = getSubiektFeedback("not_configured", {
      title: "Brak hosta ORDERS",
      message: orders.message,
      hint: `Ustaw SUBIEKT_API_ORDERS_BASE_URL na :${SUBIEKT_ORDERS_LIVE_PORT} (live) lub :${SUBIEKT_ORDERS_TEST_PORT} (test).`,
    });
    return { ok: false, message: orders.message, feedback };
  }

  const twIds = Array.isArray(input.twIds) ? input.twIds : [];
  try {
    const fetched = await fetchReservedOverlapSlicesByTwIds(twIds);
    // Przy błędach per-tw zwracamy ok:false żeby Workbench nie trzymał
    // „pustego resolve” i mógł spróbować ponownie.
    if (fetched.hadFetchErrors) {
      return {
        ok: false,
        message:
          "Nie udało się wczytać części rezerwacji ZK do korekty próśb. Spróbuj ponownie.",
      };
    }
    return {
      ok: true,
      reservedByTwId: reservedOverlapMapToDto(fetched.reservedByTwId),
    };
  } catch (e) {
    const feedback = feedbackFromException(e);
    return { ok: false, message: feedback.message, feedback };
  }
}

export async function actionRunZdEstimateManual(
  input: ZdEstimateRunInput
): Promise<ZdEstimateRunResult> {
  const user = await requireZdEstimateAdmin("read");
  let progressId: string | null = isValidZdEstimateRunProgressId(input.progressId)
    ? input.progressId.trim()
    : null;
  // Sync register before any network await — poll must see the row immediately.
  if (progressId) {
    const reg = registerZdEstimateRunProgress({
      progressId,
      ownerUserId: user.id,
    });
    if (!reg.ok) {
      // Never steal another admin's slot — continue Policz without live progress.
      progressId = null;
    }
  }
  const touchProgress = (
    patch: Parameters<typeof updateZdEstimateRunProgress>[2]
  ) => {
    if (!progressId) return;
    updateZdEstimateRunProgress(progressId, user.id, patch);
  };
  const failProgress = (message?: string | null) => {
    if (!progressId) return;
    failZdEstimateRunProgress(progressId, user.id, message);
  };

  const orders = resolveSubiektOrdersConfig();
  if (!orders.ok) {
    failProgress(orders.message);
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
    failProgress(scope.message);
    const feedback = getSubiektFeedback("empty_query", {
      title: scope.title,
      message: scope.message,
    });
    return { ok: false, message: feedback.message, feedback };
  }

  const dniZapasu = Math.round(Number(input.dniZapasu));
  if (!Number.isFinite(dniZapasu) || dniZapasu < 1 || dniZapasu > 730) {
    failProgress("Niepoprawny zapas");
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
    // Opcja czasu dostawy: dłuższy horyzont celu, to samo okno sprzedaży.
    let horizon: import("@/lib/orders/zd-order-horizon").ZdOrderHorizon | null = null;
    const horizonSupplierId = String(input.supplierId ?? "").trim();
    if (input.leadTimeHorizon === true && horizonSupplierId) {
      const [supplier] = await fetchSuppliersWithSchedules(undefined, {
        activeOnly: false,
        supplierIds: [horizonSupplierId],
      });
      if (supplier) {
        horizon =
          (
            await loadZdOrderHorizons({
              suppliers: [supplier],
              stockDaysBySupplierId: new Map([[supplier.id, dniZapasu]]),
              todayKey,
            })
          ).get(supplier.id) ?? null;
      }
    }

    const engine = await runZdOrderEngine({
      scope,
      supplierId: String(input.supplierId ?? "").trim() || null,
      dniZapasu: horizon ? horizon.horizonDays : dniZapasu,
      dataOd,
      dataDo,
      zapasMin,
      ordersBaseUrl: orders.config.baseUrl,
      onProgress: touchProgress,
    });
    if (!engine.ok) {
      failProgress(engine.feedback.message);
      return {
        ok: false,
        message: engine.feedback.message,
        feedback: engine.feedback,
      };
    }
    const {
      result,
      historyByTwId,
      historyFetchFailed,
      pendingIndividuals,
      pendingIndividualsTruncated,
      pendingIndividualsError,
      prosbaOverlapCandidateTwIds,
      prosbaOverlapResolved,
      exclusions,
      onRequests,
      packaging,
      minStock,
      productPairs,
      productBoms,
      teethTwIds,
      boostPreset,
      missingPartnerTwIds,
      missingBomTwIds,
      kpi,
    } = engine;
    const prosbaReservedByTwIdDto = engine.prosbaReservedByTwId
      ? reservedOverlapMapToDto(engine.prosbaReservedByTwId)
      : undefined;

    const meta = {
      pagesFetched: engine.fetch.pagesFetched,
      totalCountApi: engine.fetch.totalCountApi,
      truncated: engine.fetch.truncated,
      ordersBaseUrl: orders.config.baseUrl,
      durationMs: Date.now() - started,
      totalFromSubiekt: result.totalFromSubiekt,
      doZamowieniaCount: kpi.doZamowieniaCount,
      doZamowieniaSuma: kpi.zdUnitsSuma,
      doZamowieniaCountRaw: kpi.doZamowieniaCountRaw,
      doZamowieniaSumaRaw: kpi.zdUnitsSumaRaw,
      doZamowieniaZdUnitsSuma: kpi.zdUnitsSuma,
      doZamowieniaZdUnitsSumaRaw: kpi.zdUnitsSumaRaw,
      excludedInGroupCount: kpi.excludedInGroupCount,
      pairPartnerMissingCount: missingPartnerTwIds.size,
      pairMissingTwIds: [...missingPartnerTwIds],
      bomMissingCount: missingBomTwIds.size,
      bomMissingTwIds: [...missingBomTwIds],
    };

    const historyDto = historyMapToDto(historyByTwId);

    // Sesja UI na serwerze — bez drugiego uploadu snapshotu z przeglądarki
    // (duże cechy, np. Ivoclar ~1590 SKU, potrafiły wyłożyć osobny create).
    let uiSessionId: string | null = null;
    let uiSessionCreatedAt: string | null = null;
    let uiSessionRotated = false;
    try {
      const snapshot = buildZdEstimateUiSessionSnapshotFromPolicz({
        mode: scope.mode,
        grupaId: scope.mode === "grupa" ? scope.grupaId : null,
        cechaId: scope.mode === "cecha" ? scope.cechaId : null,
        scopeLabel: input.scopeLabel ?? null,
        supplierId: String(input.supplierId ?? "").trim() || null,
        dniZapasu,
        dataOd,
        dataDo,
        zapasMin,
        result,
        historyByTwId: historyDto,
        historyFetchFailed,
        pendingIndividuals,
        pendingIndividualsTruncated,
        pendingIndividualsError,
        meta,
        exclusions,
        onRequests,
        packaging,
        minStock,
        productPairs,
        productBoms,
        teethTwIds,
        boostPreset,
        horizon,
        seed: input.uiSessionSeed ?? null,
      });
      const persisted = await persistZdEstimateUiSessionSnapshot({
        payload: snapshot,
        schemaVersion: ZD_ESTIMATE_UI_SESSION_SNAPSHOT_SCHEMA_VERSION,
      });
      uiSessionRotated = persisted.rotated;
      if (persisted.ok) {
        uiSessionId = persisted.sessionId;
        uiSessionCreatedAt = snapshot.createdAt;
      } else {
        console.warn(
          "[zd-ui-session] persist after Policz failed",
          persisted.message
        );
      }
    } catch (persistErr) {
      console.warn("[zd-ui-session] persist after Policz threw", persistErr);
    }

    if (progressId) completeZdEstimateRunProgress(progressId, user.id);
    return {
      ok: true,
      result,
      historyByTwId: historyDto,
      historyFetchFailed,
      pendingIndividuals,
      pendingIndividualsTruncated,
      pendingIndividualsError,
      prosbaReservedByTwId: prosbaReservedByTwIdDto,
      prosbaOverlapCandidateTwIds,
      prosbaOverlapResolved,
      scopesIncluded: engine.scopesIncluded,
      assignedElsewhere: engine.assignedElsewhere,
      otherSupplierHintByTwId: engine.otherSupplierHintByTwId,
      horizon,
      exclusions,
      onRequests,
      packaging,
      minStock,
      productPairs,
      productBoms,
      teethTwIds,
      boostPreset,
      meta,
      uiSessionId,
      uiSessionCreatedAt,
      uiSessionRotated,
    };
  } catch (e) {
    const pagesHint = progressPagesHint(progressId, user.id);
    if (e instanceof SubiektZdEstimateFirstPageRejectedError) {
      failProgress(e.message);
      const feedback = getSubiektFeedback("empty_query", {
        title: e.title,
        message: e.message,
        hint: "Odśwież API ORDERS (live :5080 / test :5082) albo wybierz inny zakres.",
      });
      return { ok: false, message: feedback.message, feedback };
    }
    const feedback = feedbackFromException(e);
    if (feedback.code === "timeout") {
      failProgress(feedback.message);
      return {
        ok: false,
        message: feedback.message,
        feedback: {
          ...feedback,
          title: "Przekroczono czas oczekiwania szacunku",
          message:
            "Budowanie listy do zamówienia trwało zbyt długo (limit czasu API lub serwera).",
          hint: [
            "Spróbuj ponownie albo zawęź zakres. Limit serwera / nginx to ok. 5 min.",
            pagesHint,
          ]
            .filter(Boolean)
            .join(" "),
        },
      };
    }
    if (e instanceof SubiektRequestError && e.status >= 500) {
      failProgress(feedback.message);
      const raw = (e.bodySnippet || "").replace(/\s+/g, " ").trim();
      const snippet =
        raw.length > 220 ? `${raw.slice(0, 220).trim()}…` : raw || null;
      return {
        ok: false,
        message:
          "Subiekt ORDERS nie policzył tego zakresu (błąd SQL/REST po stronie API).",
        feedback: {
          ...feedback,
          code: "server_error",
          title: "Subiekt nie policzył zakresu",
          message:
            "Usługa ORDERS zwróciła błąd wewnętrzny przy szacunku. " +
            "Duże cechy (np. Ivoclar) często przeciążają zapytanie SQL — to nie jest baza Postgres OnTime.",
          hint: [
            snippet
              ? `Odpowiedź API (HTTP ${e.status}): ${snippet}`
              : `HTTP ${e.status} bez treści. Spróbuj grupy „Ivoclar Technical/Clinical” zamiast całej cechy, albo sprawdź logi serwisu Subiekta :5080.`,
            pagesHint,
          ]
            .filter(Boolean)
            .join(" "),
        },
      };
    }
    failProgress(feedback.message);
    return {
      ok: false,
      message: feedback.message,
      feedback: pagesHint
        ? {
            ...feedback,
            hint: [feedback.hint, pagesHint].filter(Boolean).join(" "),
          }
        : feedback,
    };
  }
}

function progressPagesHint(
  progressId: string | null,
  ownerUserId: string
): string | null {
  if (!progressId) return null;
  const poll = getZdEstimateRunProgressForOwner(progressId, ownerUserId);
  if (!poll.found) return null;
  const { pagesCommitted, totalPages } = poll.snapshot;
  if (!(pagesCommitted > 0) || !(totalPages > 0)) return null;
  return `(Ostatni postęp: strona ${pagesCommitted}/${totalPages}.)`;
}

export async function actionPollZdEstimateRunProgress(
  progressId: string
): Promise<ZdEstimateRunProgressPollResult> {
  const user = await requireZdEstimateAdmin("read");
  if (!isValidZdEstimateRunProgressId(progressId)) {
    return { found: false };
  }
  return getZdEstimateRunProgressForOwner(progressId.trim(), user.id);
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

export async function actionListZdEstimateMinStock(): Promise<ZdEstimateMinStockActionResult> {
  await requireZdEstimateAdmin("read");
  try {
    const minStock = await fetchZdEstimateMinStock();
    return { ok: true, minStock };
  } catch (e) {
    return {
      ok: false,
      message:
        userFacingErrorText(e, "Nie udało się pobrać minimum stanów."),
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
  documentUnitMode?: ZdPackagingDocumentUnitMode | null;
  orderMultiple?: number | null;
  note?: string;
}): Promise<ZdEstimatePackagingActionResult> {
  const user = await requireZdEstimateAdmin("mutate");
  const unitsCheck = assertPackagingUnits(input.unitsPerPackage);
  if (!unitsCheck.ok) {
    return { ok: false, message: unitsCheck.message };
  }
  const documentUnitMode = normalizePackagingDocumentUnitMode(
    input.documentUnitMode
  );
  const orderCheck = assertOrderMultiple(
    documentUnitMode === "pieces_multiple" ? null : input.orderMultiple
  );
  if (!orderCheck.ok) {
    return { ok: false, message: orderCheck.message };
  }
  if (documentUnitMode === "pieces_multiple") {
    try {
      const pairs = await fetchZdProductPairs();
      const isPackSku = pairs.some(
        (p) => p.packTwId === Math.trunc(input.subiektTwId)
      );
      if (isPackSku) {
        return {
          ok: false,
          message:
            "Tryb „dobicie w sztukach” nie działa na paczce z pary montaż/demontaż — użyj trybu opakowań (1 na ZD = N szt) albo usuń parę.",
        };
      }
    } catch (e) {
      return {
        ok: false,
        message: userFacingErrorText(
          e,
          "Nie udało się sprawdzić par przed zapisem opakowania."
        ),
      };
    }
  }
  try {
    await upsertZdEstimatePackaging({
      ...input,
      unitsPerPackage: unitsCheck.units,
      documentUnitMode,
      orderMultiple:
        documentUnitMode === "pieces_multiple"
          ? null
          : orderCheck.orderMultiple,
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

export type ZdEstimateMinStockActionResult =
  | { ok: true; minStock: ZdEstimateMinStockRow[] }
  | { ok: false; message: string };

export async function actionUpsertZdEstimateMinStock(input: {
  subiektTwId: number;
  twSymbol?: string | null;
  twNazwa: string;
  grtId?: number | null;
  grtNazwa?: string | null;
  minStockSzt: number;
  note?: string;
}): Promise<ZdEstimateMinStockActionResult> {
  const user = await requireZdEstimateAdmin("mutate");
  const minStockSzt = Math.max(0, Math.trunc(Number(input.minStockSzt)));
  if (!Number.isFinite(minStockSzt) || minStockSzt > 1_000_000) {
    return {
      ok: false,
      message: "Minimum stanów musi być liczbą całkowitą 0–1 000 000.",
    };
  }
  try {
    await upsertZdEstimateMinStock({
      ...input,
      minStockSzt,
      createdBy: user.id,
    });
    const minStock = await fetchZdEstimateMinStock();
    return { ok: true, minStock };
  } catch (e) {
    return {
      ok: false,
      message:
        userFacingErrorText(e, "Nie udało się zapisać minimum stanów."),
    };
  }
}

export async function actionDeleteZdEstimateMinStock(
  subiektTwId: number
): Promise<ZdEstimateMinStockActionResult> {
  await requireZdEstimateAdmin("mutate");
  try {
    await deleteZdEstimateMinStock(subiektTwId);
    const minStock = await fetchZdEstimateMinStock();
    return { ok: true, minStock };
  } catch (e) {
    return {
      ok: false,
      message:
        userFacingErrorText(e, "Nie udało się usunąć minimum stanów."),
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
 * unitsPerPackage ≥ 2 (sztuki 1:1 = delete / clear, nie upsert 1).
 */
export async function actionUpsertZdEstimatePackagingBulk(input: {
  products: ZdEstimateBulkProductInput[];
  unitsPerPackage: number;
  packageLabel?: string;
  documentUnitMode?: ZdPackagingDocumentUnitMode | null;
  orderMultiple?: number | null;
  note?: string;
}): Promise<ZdEstimateBulkPackagingActionResult> {
  const user = await requireZdEstimateAdmin("mutate");
  const normalized = normalizeZdEstimateBulkProducts(input.products);
  const products = normalized.products;
  if (!products.length) {
    return { ok: false, message: "Zaznacz co najmniej jeden produkt." };
  }
  const truncated = normalized.truncated;
  const unitsCheck = assertPackagingUnits(input.unitsPerPackage);
  if (!unitsCheck.ok) {
    return { ok: false, message: unitsCheck.message };
  }
  const units = unitsCheck.units;
  const documentUnitMode = normalizePackagingDocumentUnitMode(
    input.documentUnitMode
  );
  const orderCheck = assertOrderMultiple(
    documentUnitMode === "pieces_multiple" ? null : input.orderMultiple
  );
  if (!orderCheck.ok) {
    return { ok: false, message: orderCheck.message };
  }
  const orderMultiple =
    documentUnitMode === "pieces_multiple" ? null : orderCheck.orderMultiple;

  let packTwIds = new Set<number>();
  if (documentUnitMode === "pieces_multiple") {
    try {
      const pairs = await fetchZdProductPairs();
      packTwIds = new Set(pairs.map((p) => p.packTwId));
    } catch (e) {
    return {
      ok: false,
        message: userFacingErrorText(
          e,
          "Nie udało się sprawdzić par przed zapisem opakowań."
        ),
    };
    }
  }

  const succeededTwIds: number[] = [];
  const failed: ZdEstimateBulkFailure[] = [];

  for (const p of products) {
    try {
      if (
        documentUnitMode === "pieces_multiple" &&
        packTwIds.has(p.subiektTwId)
      ) {
        failed.push({
          subiektTwId: p.subiektTwId,
          twSymbol: p.twSymbol,
          error:
            "Tryb „dobicie w sztukach” koliduje z parą (paczka) — pominięto.",
        });
        continue;
      }
      await upsertZdEstimatePackaging({
        subiektTwId: p.subiektTwId,
        twSymbol: p.twSymbol,
        twNazwa: p.twNazwa,
        grtId: p.grtId,
        grtNazwa: p.grtNazwa,
        unitsPerPackage: units,
        packageLabel: input.packageLabel,
        documentUnitMode,
        orderMultiple,
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
      /** Jednostki dokumentu Subiekta (ob_Ilosc) — do bump otwarteZd / snap qty. */
      createdLines: Array<{ twId: number; ilosc: number }>;
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
    let packagingModeByTwId: Map<
      number,
      ZdPackagingDocumentUnitMode
    >;
    try {
      packagingByTwId = new Map();
      packagingModeByTwId = new Map();
      const packaging = await fetchZdEstimatePackaging();
      for (const row of packaging) {
        packagingByTwId.set(row.subiektTwId, row.unitsPerPackage);
        packagingModeByTwId.set(row.subiektTwId, row.documentUnitMode);
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
      packagingModeByTwId,
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

    const createdByTw = new Map<number, number>();
    for (const l of doc.dok_Pozycja ?? []) {
      const twId = Math.trunc(Number(l.ob_TowId ?? 0));
      const ilosc = Math.max(0, Math.round(Number(l.ob_Ilosc) || 0));
      if (!(twId > 0) || !(ilosc > 0)) continue;
      createdByTw.set(twId, (createdByTw.get(twId) ?? 0) + ilosc);
    }
    const createdLines = [...createdByTw.entries()].map(([twId, ilosc]) => ({
      twId,
      ilosc,
    }));

    return { ok: true, snapshot, lineCount, dokNrPelny, createdLines };
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
  title?: string;
  message: string;
} {
  if (e instanceof SubiektTimeoutError) {
    return {
      code: "timeout",
      title: "Timeout Sfery",
      message:
        "Timeout przy tworzeniu ZD (Sfera). Sprawdź w Subiekcie, czy dokument powstał — nie twórz ponownie w ciemno.",
    };
  }
  if (e instanceof SubiektRequestError) {
    let parsed: {
      error?: string;
      message?: string;
      detail?: string;
      description?: string;
      code?: string;
    } | null = null;
    try {
      parsed = JSON.parse(e.bodySnippet) as {
        error?: string;
        message?: string;
        detail?: string;
        description?: string;
        code?: string;
      };
    } catch {
      const codeM = e.bodySnippet.match(/"code"\s*:\s*"([^"]+)"/);
      const errM = e.bodySnippet.match(
        /"(?:error|message|detail)"\s*:\s*"((?:\\.|[^"\\])*)"/
      );
      if (codeM || errM) {
        parsed = {
          code: codeM?.[1],
          error: errM?.[1]?.replace(/\\"/g, '"'),
        };
      }
    }
    const apiCode = String(parsed?.code ?? "").trim();
    const apiError = String(
      parsed?.error ??
        parsed?.message ??
        parsed?.detail ??
        parsed?.description ??
        ""
    ).trim();
    // Pełny blob (JSON + pola) — HRESULT bywa w body, a nie w `error`.
    const errorBlob = [apiError, e.bodySnippet, e.message]
      .filter(Boolean)
      .join("\n");
    if (apiCode === "validation_error" || e.status === 400) {
      const formatted = formatZdCreateSferaUserMessage(errorBlob);
      // Walidacja zwykle bez HRESULT — zostaw apiError, chyba że to jednak Sfera.
      if (/HRESULT|0x[0-9a-fA-F]{8}/i.test(errorBlob)) {
        return {
          code: "sfera",
          title: formatted.title,
          message: formatted.message,
        };
      }
      return {
        code: "validation",
        title: "Błąd walidacji",
        message: apiError || errorBlob || e.message,
      };
    }

    // Timeout po stronie ORDERS (504 / SQL „limit czasu”) — ZD mógł powstać,
    // więc code "timeout" (UI szuka świeżego ZD zamiast zachęcać do ponowienia).
    if (
      e.status === 504 ||
      humanizeSferaCreateError(errorBlob)?.kind === "timeout"
    ) {
      return {
        code: "timeout",
        title: "Timeout Sfery",
        message:
          "Timeout przy tworzeniu ZD (Sfera). Sprawdź w Subiekcie, czy dokument powstał — nie twórz ponownie w ciemno.",
      };
    }

    // Zawsze humanizuj odpowiedzi create ZD (licencja / COM / myląca wskazówka SQL).
    const formatted = formatZdCreateSferaUserMessage(errorBlob);
    const isSferaStatus =
      apiCode === "sfera_not_configured" ||
      apiCode === "sfera_error" ||
      e.status === 503 ||
      e.status === 409 ||
      /HRESULT|0x[0-9a-fA-F]{8}|InsERT|Sfera/i.test(errorBlob);
    return {
      code: isSferaStatus ? "sfera" : "error",
      title: formatted.title,
      message: formatted.message,
    };
  }
  const feedback = feedbackFromException(e);
  const blob =
    e instanceof Error ? `${e.message}\n${String(e)}` : String(e ?? "");
  if (/HRESULT|0x[0-9a-fA-F]{8}|InsERT/i.test(blob)) {
    const formatted = formatZdCreateSferaUserMessage(blob);
    return {
      code: "sfera",
      title: formatted.title,
      message: formatted.message,
    };
  }
  return {
    code: "network",
    title: feedback.title,
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
      createdLines: Array<{ twId: number; ilosc: number }>;
      bumped: Array<{
        twId: number;
        from: number;
        to: number;
        extraPieces: number;
      }>;
      composedUwagi?: string | null;
      omittedServiceCount?: number;
      teethServiceCount?: number;
      includedServiceOrderIds?: string[];
      /** Catalog IDs zaakceptowane przez serwer (Nowe + extras). */
      acceptedCatalogOrderIds?: string[];
    }
  | {
      ok: false;
      code: "timeout" | "validation" | "sfera" | "network" | "error";
      message: string;
      /** Krótki nagłówek Alert (np. zajęta licencja Sfery). */
      title?: string;
      /** Przy timeout — kh do wyszukania świeżego ZD. */
      supplierKhId?: number;
    };

/**
 * Tworzy ZD na hoście ORDERS (obecnie często live :5080 — aktualna baza).
 * Snapshot historii z host_kind zgodnym z URL (live | orders_test).
 * kontrahentId zawsze z DB po supplierId — nie z klienta.
 * Nie oznacza próśb ani planu — to decyzja w panelu po create.
 */
export async function actionCreateZdFromEstimate(input: {
  supplierId: string;
  uwagi?: string | null;
  scopeMode?: ZdEstimateSnapshotScopeMode | null;
  grtId?: number | null;
  cechaId?: number | null;
  lines: Array<{
    twId: number;
    ilosc: number;
    symbol?: string | null;
    plu?: string | null;
  }>;
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
   * OrderIds usług do uwag (Główne jest decyzją w panelu po create).
   * Serwer dokłada blok usług do uwag (nie zależy od edycji tekstu).
   */
  individualServiceOrderIds?: string[] | null;
  /**
   * Prośby już pokryte wcześniejszym Create w tej sesji (status Nowe).
   * Serwer pomija je przy extras / bump qty — bez tego drugi Create doliczy je drugi raz.
   */
  consumedOrderIds?: string[] | null;
  /** @deprecated użyj catalog + service; łączona lista nadal akceptowana. */
  individualOrderIds?: string[] | null;
}): Promise<ZdEstimateCreateZdResult> {
  const user = await requireZdEstimateAdmin("mutate");
  const orders = resolveSubiektOrdersConfig();
  if (!orders.ok) {
    return { ok: false, code: "error", message: orders.message };
  }

  const t0 = performance.now();
  let msPendingOrders = 0;
  let msProductSettings = 0;
  let msOverlap = 0;
  let msSferaCreate = 0;
  let msDocResolve = 0;
  let msSnapshot = 0;
  let overlapCandidateCount = 0;
  let overlapTwFetched: number[] = [];
  let overlapTwSkipped: number[] = [];

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
    persistSnapshots,
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
    const tPending = performance.now();
    const pendingRes = await fetchZdEstimatePendingIndividualOrders(
      input.supplierId
    );
    msPendingOrders = Math.round(performance.now() - tPending);
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
  const pendingForExtras = excludeConsumedPendingOrders(
    pendingForSupplier,
    input.consumedOrderIds
  );
  const pendingById = new Map(pendingForExtras.map((o) => [o.id, o]));

  let pairsForExtras: Awaited<ReturnType<typeof fetchZdProductPairs>> = [];
  let bomsForExtras: Awaited<ReturnType<typeof fetchZdProductBoms>> = [];
  let teethForExtras: Set<number>;
  let packagingForCreate: Awaited<
    ReturnType<typeof fetchZdEstimatePackaging>
  > = [];
  try {
    const tSettings = performance.now();
    ;[pairsForExtras, bomsForExtras, teethForExtras, packagingForCreate] =
      await Promise.all([
        fetchZdProductPairs(),
        fetchZdProductBoms(),
        fetchTeethProductTwIdSet(),
        fetchZdEstimatePackaging(),
      ]);
    msProductSettings = Math.round(performance.now() - tSettings);
  } catch (e) {
    return {
      ok: false,
      code: "validation",
      message:
        e instanceof Error
          ? `Nie udało się wczytać ustawień produktów przed create: ${e.message}`
          : "Nie udało się wczytać ustawień produktów przed create.",
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
  const extrasBundle = buildIndividualEstimateExtras({
    orders: pendingForExtras,
    lines: stubLines,
    pairs: pairsForExtras,
    boms: bomRowsToRefs(bomsForExtras),
    teethTwIds: teethForExtras,
    mikranByTw,
  });
  const validCatalogIds = new Set(
    collectIndividualOrderIdsForZdCreate({
      byTwId: extrasBundle.byTwId,
      createdTwIds,
      serviceOrderIds: [],
    })
  );

  const unitsPerPackageByTwId = new Map<number, number>();
  const packagingModeByTwId = new Map<number, ZdPackagingDocumentUnitMode>();
  const orderMultipleByTwId = new Map<number, number>();
  for (const row of packagingForCreate) {
    unitsPerPackageByTwId.set(row.subiektTwId, row.unitsPerPackage);
    packagingModeByTwId.set(row.subiektTwId, row.documentUnitMode);
    if (row.orderMultiple != null && row.orderMultiple >= 2) {
      orderMultipleByTwId.set(row.subiektTwId, row.orderMultiple);
    }
  }
  for (const pair of pairsForExtras) {
    unitsPerPackageByTwId.set(pair.packTwId, pair.unitsPerPack);
    packagingModeByTwId.set(pair.packTwId, "packages");
    // orderMultiple z wiersza packaging (jeśli był) zostaje z pętli powyżej
  }

  // Dedupe prośba↔rez. ZK przed ensureCover — inaczej serwer podbija qty z powrotem.
  // coverLines: fetch ZK tylko gdy ilosc < minZd(raw); scoped extras bez zmian.
  const tOverlap = performance.now();
  const overlapForCreate = await resolveIndividualExtrasWithReservationOverlap({
    byTwId: extrasBundle.byTwId,
    twIdsFilter: createdTwIds,
    coverLines: linesCheck.lines,
    unitsPerPackageByTwId,
    packagingModeByTwId,
  });
  msOverlap = Math.round(performance.now() - tOverlap);
  overlapCandidateCount = overlapForCreate.candidateTwIds.length;
  overlapTwFetched = overlapForCreate.overlapTwFetched;
  overlapTwSkipped = overlapForCreate.overlapTwSkipped;

  // Fail-open raw extras przy błędzie ZK → ensureCover mógłby over-bumpnąć vs UI.
  if (!overlapForCreate.resolved) {
    console.warn("[zd-estimate:create:fail]", {
      hostKind,
      ordersBaseUrl: orders.config.baseUrl,
      userId: user.id,
      supplierId: input.supplierId,
      khId: khRes.khId,
      code: "validation",
      message: "overlap_unresolved",
      msPendingOrders,
      msProductSettings,
      msOverlap,
      msTotal: Math.round(performance.now() - t0),
      overlapCandidateCount,
      overlapTwFetched: overlapTwFetched.length,
      overlapTwSkipped: overlapTwSkipped.length,
    });
    return {
      ok: false,
      code: "validation",
      message:
        "Nie udało się zweryfikować rezerwacji ZK względem próśb. Odśwież Policz i spróbuj ponownie utworzyć ZD.",
    };
  }

  const extraPiecesByTwId = new Map<number, number>();
  for (const [tw, qty] of overlapForCreate.adjustedExtraByTwId) {
    if (qty > 0 && createdTwIds.has(tw)) {
      extraPiecesByTwId.set(tw, qty);
    }
  }
  const coveredLines = ensureZdCreateLinesCoverIndividualExtras({
    lines: linesCheck.lines,
    extraPiecesByTwId,
    unitsPerPackageByTwId,
    packagingModeByTwId,
    orderMultipleByTwId,
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
    catalogIds = normalizeIds(catalogFromClient).filter((id) =>
      validCatalogIds.has(id)
    );
    serviceIds = normalizeIds(serviceFromClient).filter(
      (id) => !catalogIds.includes(id)
    );
  } else {
    const legacy = normalizeIds(legacyFromClient);
    catalogIds = legacy.filter((id) => validCatalogIds.has(id));
    serviceIds = legacy.filter((id) => !catalogIds.includes(id));
  }

  // Uwagi z pełnej listy usług wskazanej przez klienta (Główne jest decyzją po create).
  const serviceIdsForUwagi = [...serviceIds];

  const serviceLinesForUwagi = extrasBundle.serviceLines
    .map((line) => ({
      ...line,
      requests: line.requests.filter((r) =>
        serviceIdsForUwagi.includes(r.orderId)
      ),
    }))
    .filter((line) => line.requests.length > 0);

  // Dołóż serviceIds spoza extrasBundle.serviceLines (np. prośba na wykluczonej
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
      scopeMode: scopeRes.scopeMode,
      scopeLabel:
        scopeRes.scopeMode === "grupa"
          ? scopeRes.grtId != null
            ? String(scopeRes.grtId)
            : null
          : scopeRes.cechaId != null
            ? String(scopeRes.cechaId)
            : null,
      dateKey: warsawNowParts().dateKey,
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
  let createdDoc: Awaited<ReturnType<typeof createSubiektOrdersZd>>;
  const tCreate = performance.now();
  try {
    createdDoc = await createSubiektOrdersZd(body);
    msSferaCreate = Math.round(performance.now() - tCreate);
    dokId = Math.trunc(Number(createdDoc.dok_Id));
    if (!(dokId > 0)) {
      console.warn("[zd-estimate:create:fail]", {
        hostKind,
        ordersBaseUrl: orders.config.baseUrl,
        userId: user.id,
        supplierId: input.supplierId,
        khId: khRes.khId,
        code: "error",
        message: "Subiekt nie zwrócił dok_Id po utworzeniu ZD.",
        msPendingOrders,
        msProductSettings,
        msOverlap,
        msSferaCreate,
        msTotal: Math.round(performance.now() - t0),
        overlapCandidateCount,
        overlapTwFetched: overlapTwFetched.length,
        overlapTwSkipped: overlapTwSkipped.length,
      });
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
      dokNrPelny: createdDoc.dok_NrPelny ?? null,
      userId: user.id,
      supplierId: input.supplierId,
      khId: khRes.khId,
      lineCount: createLines.length,
      msSferaCreate,
      msOverlap,
      overlapTwFetched: overlapTwFetched.length,
      overlapTwSkipped: overlapTwSkipped.length,
    });
  } catch (e) {
    msSferaCreate = Math.round(performance.now() - tCreate);
    const mapped = mapZdCreateSubiektError(e);
    console.warn("[zd-estimate:create:fail]", {
      hostKind,
      ordersBaseUrl: orders.config.baseUrl,
      userId: user.id,
      supplierId: input.supplierId,
      khId: khRes.khId,
      code: mapped.code,
      message: mapped.message,
      msPendingOrders,
      msProductSettings,
      msOverlap,
      msSferaCreate,
      msTotal: Math.round(performance.now() - t0),
      overlapCandidateCount,
      overlapTwFetched: overlapTwFetched.length,
      overlapTwSkipped: overlapTwSkipped.length,
    });
    return {
      ok: false,
      code: mapped.code,
      message: mapped.message,
      title: mapped.title,
      supplierKhId: mapped.code === "timeout" ? khRes.khId : undefined,
    };
  }

  const teethServiceOrderIds = new Set(
    serviceLinesForUwagi
      .filter((l) => l.reason === "teeth")
      .flatMap((l) => l.requests.map((r) => r.orderId))
  );

  const logCreateDone = (extra: Record<string, unknown>) => {
    console.info("[zd-estimate:create:done]", {
      hostKind,
      ordersBaseUrl: orders.config.baseUrl,
      dokId,
      userId: user.id,
      supplierId: input.supplierId,
      khId: khRes.khId,
      lineCount: createLines.length,
      persistSnapshots,
      overlapCandidateCount,
      overlapTwFetched: overlapTwFetched.length,
      overlapTwSkipped: overlapTwSkipped.length,
      msPendingOrders,
      msProductSettings,
      msOverlap,
      msSferaCreate,
      msDocResolve,
      msSnapshot,
      msTotal: Math.round(performance.now() - t0),
      ...extra,
    });
  };

  const withCreate = <T extends Record<string, unknown>>(base: T) => ({
    ...base,
    createdLines: createLines.map((l) => ({ twId: l.twId, ilosc: l.ilosc })),
    bumped: coveredLines.bumped,
    composedUwagi: composedUwagi.uwagi,
    omittedServiceCount: composedUwagi.omittedServiceCount,
    teethServiceCount: teethServiceOrderIds.size,
    includedServiceOrderIds: composedUwagi.includedServiceOrderIds,
    acceptedCatalogOrderIds: catalogIds,
  });

  let dokNrPelny = `ZD/${dokId}`;
  let docSource: "create" | "reget" | null = null;
  let didReget = false;
  try {
    const tDoc = performance.now();
    const resolved = await resolveDocAfterZdCreate({
      created: createdDoc,
      dokId,
      createLines: createLines.map((l) => ({ twId: l.twId, ilosc: l.ilosc })),
      persistSnapshots,
      getById: getSubiektOrdersZd,
    });
    msDocResolve = Math.round(performance.now() - tDoc);
    const doc = resolved.doc;
    dokNrPelny = resolved.dokNrPelny;
    docSource = resolved.source;
    didReget = resolved.didReget;

    if (!persistSnapshots) {
      logCreateDone({
        dokNrPelny,
        snapshotOk: false,
        docSource,
        didReget,
      });
      return withCreate({
        ok: true as const,
        dokId,
        dokNrPelny,
        lineCount: createLines.length,
        snapshotOk: false,
        snapshotMessage: "Brak konfiguracji hosta — historia nie zapisana.",
      });
    }

    // Reuse packaging/pairs already loaded earlier in this Create — no second round-trip.
    const packagingByTwId = new Map<number, number>();
    const packagingModeByTwIdSnap = new Map<
      number,
      ZdPackagingDocumentUnitMode
    >();
    for (const row of packagingForCreate) {
      packagingByTwId.set(row.subiektTwId, row.unitsPerPackage);
      packagingModeByTwIdSnap.set(row.subiektTwId, row.documentUnitMode);
    }
    const pairRatioByTwId = buildPairRatioByTwId(pairsForExtras);

    const orderableTwIds = new Set(createLines.map((l) => l.twId));

    const tSnap = performance.now();
    const built = buildZdEstimateSnapshotLinesFromDocChecked(doc, {
      packagingByTwId,
      packagingModeByTwId: packagingModeByTwIdSnap,
      pairRatioByTwId,
      lineMeta: input.lineMeta ?? null,
      confirmedEstimateTwIds: orderableTwIds,
      requirePackaging: true,
    });

    if (!built.ok) {
      msSnapshot = Math.round(performance.now() - tSnap);
      logCreateDone({
        dokNrPelny,
        snapshotOk: false,
        docSource,
        didReget,
      });
      return withCreate({
        ok: true as const,
        dokId,
        dokNrPelny,
        lineCount: createLines.length,
        snapshotOk: false,
        snapshotMessage: `ZD utworzone (${dokNrPelny}), ${enrichSnapshotPackagingErrorMessage(
          built.message,
          doc,
          orderableTwIds
        )}`,
      });
    }

    if (!built.lines.length) {
      msSnapshot = Math.round(performance.now() - tSnap);
      logCreateDone({
        dokNrPelny,
        snapshotOk: false,
        docSource,
        didReget,
      });
      return withCreate({
        ok: true as const,
        dokId,
        dokNrPelny,
        lineCount: createLines.length,
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
      msSnapshot = Math.round(performance.now() - tSnap);
      logCreateDone({
        dokNrPelny,
        snapshotOk: true,
        docSource,
        didReget,
        snapshotLineCount: lineCount,
      });
      return withCreate({
        ok: true as const,
        dokId,
        dokNrPelny,
        lineCount,
        snapshotOk: true,
      });
    } catch (snapErr) {
      msSnapshot = Math.round(performance.now() - tSnap);
      logCreateDone({
        dokNrPelny,
        snapshotOk: false,
        docSource,
        didReget,
      });
      return withCreate({
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
    logCreateDone({
      dokNrPelny,
      snapshotOk: false,
      docSource,
      didReget,
      error: e instanceof Error ? e.message : "unknown",
    });
    return withCreate({
      ok: true as const,
      dokId,
      dokNrPelny,
      lineCount: createLines.length,
      snapshotOk: false,
      snapshotMessage:
        e instanceof Error
          ? `ZD utworzone (dok_Id ${dokId}), odczyt/snapshot: ${e.message}`
          : `ZD utworzone (dok_Id ${dokId}) — użyj „Powiąż ZD”.`,
    });
  }
}

function revalidateAfterZdEstimateMark() {
  revalidatePath("/", "layout");
  revalidatePath("/");
  revalidatePath("/podsumowanie");
  revalidatePath("/zakupy/szacunek");
  revalidatePath("/moje");
  revalidatePath("/plan");
  revalidatePath("/historia");
  revalidatePath("/kolejka");
}

export type ZdEstimateScheduleMarkContext =
  | {
      ok: true;
      canMark: boolean;
      reason?: "on_demand" | "no_interval" | "already_today";
      orderDate: string | null;
      message: string;
    }
  | { ok: false; message: string };

export async function actionGetZdEstimateScheduleMarkContext(
  supplierId: string
): Promise<ZdEstimateScheduleMarkContext> {
  await requireZdEstimateAdmin("read");
  const id = String(supplierId ?? "").trim();
  if (!id) return { ok: false, message: "Brak dostawcy." };
  const supabase = createAdminClient();
  const { data: supplier, error } = await supabase
    .from("suppliers")
    .select(
      "id, name, order_on_demand, stock_raw, interval_raw, interval_weeks, extra_info"
    )
    .eq("id", id)
    .maybeSingle();
  if (error) return { ok: false, message: error.message };
  if (!supplier) return { ok: false, message: "Nie znaleziono dostawcy." };
  if (
    isSupplierOrderOnDemand({
      order_on_demand: supplier.order_on_demand,
      stock_raw: supplier.stock_raw,
      interval_raw: supplier.interval_raw,
      extra_info: supplier.extra_info,
    })
  ) {
    return {
      ok: true,
      canMark: false,
      reason: "on_demand",
      orderDate: null,
      message: "Dostawca na żądanie — bez cyklicznego planu do oznaczenia.",
    };
  }
  const interval = resolveSupplierInterval(
    supplier.interval_raw as string | null,
    supplier.interval_weeks != null ? Number(supplier.interval_weeks) : null
  );
  if (!interval) {
    return {
      ok: true,
      canMark: false,
      reason: "no_interval",
      orderDate: null,
      message: "Brak interwału u dostawcy — nie da się oznaczyć planu.",
    };
  }
  const { data: schedule } = await supabase
    .from("supplier_schedules")
    .select("order_date")
    .eq("supplier_id", id)
    .maybeSingle();
  const orderDate = schedule?.order_date ?? null;
  const today = dateToIso(todayInWarsaw());
  if (orderDate && today && orderDate === today) {
    return {
      ok: true,
      canMark: false,
      reason: "already_today",
      orderDate,
      message: "Plan na dziś jest już oznaczony jako złożony.",
    };
  }
  return {
    ok: true,
    canMark: true,
    orderDate,
    message: "Można oznaczyć planowane zamówienie jako złożone.",
  };
}

export type ZdEstimateMarkGlowneResult =
  | {
      ok: true;
      processedIds: string[];
      /** Durable skips (status / zęby / dostawca) — wyjdź z pending. */
      skippedIds: string[];
      /** Niekompletne — zostają w pending do retry. */
      incompleteIds: string[];
      skippedIncompleteCount: number;
      message: string;
      undo?: DailyPanelUndoPayload;
    }
  | { ok: false; message: string; skippedIds?: string[]; incompleteIds?: string[] };

export async function actionMarkZdEstimateIndividualsGlowne(input: {
  supplierId: string;
  orderIds: string[];
}): Promise<ZdEstimateMarkGlowneResult> {
  const user = await requireZdEstimateAdmin("mutate");
  const supplierId = String(input.supplierId ?? "").trim();
  const requested = [
    ...new Set(
      (input.orderIds ?? []).map((id) => String(id ?? "").trim()).filter(Boolean)
    ),
  ];
  if (!supplierId) return { ok: false, message: "Brak dostawcy." };
  if (!requested.length) {
    return { ok: false, message: "Brak próśb do odznaczenia." };
  }

  const supabase = createAdminClient();
  const { data: rows, error } = await supabase
    .from("individual_orders")
    .select(
      "id, status, supplier_id, is_teeth, request_kind, symbol, products, quantity, subiekt_tw_id, informacja_queue_via_daily_panel, informacja_stock_out_reorder"
    )
    .in("id", requested);
  if (error) return { ok: false, message: error.message };

  let teethTwIds: Set<number>;
  try {
    teethTwIds = await fetchTeethProductTwIdSet();
  } catch (e) {
    return {
      ok: false,
      message:
        e instanceof Error
          ? `Nie udało się wczytać katalogu zębów przed Główne: ${e.message}`
          : "Nie udało się wczytać katalogu zębów przed Główne.",
    };
  }

  const skippedIds: string[] = [];
  const incompleteIds: string[] = [];
  const processable: string[] = [];
  for (const id of requested) {
    const row = (rows ?? []).find((r) => r.id === id);
    if (!row || row.supplier_id !== supplierId) {
      skippedIds.push(id);
      continue;
    }
    if (row.status !== "Nowe" || row.is_teeth === true) {
      skippedIds.push(id);
      continue;
    }
    const twId = Math.trunc(Number(row.subiekt_tw_id) || 0);
    if (twId > 0 && teethTwIds.has(twId)) {
      skippedIds.push(id);
      continue;
    }
    const kind = (row.request_kind ?? "zamowienie") as
      | "zamowienie"
      | "informacja";
    const draft = {
      supplierId: row.supplier_id ?? undefined,
      symbol: row.symbol ?? undefined,
      product: row.products ?? undefined,
      quantity: row.quantity ?? undefined,
      requestKind: kind,
    };
    if (kind === "informacja") {
      const queued =
        row.informacja_queue_via_daily_panel === true ||
        row.informacja_stock_out_reorder === true;
      if (!queued) {
        skippedIds.push(id);
        continue;
      }
      if (assessRequestCompleteness(draft) !== "complete") {
        incompleteIds.push(id);
        continue;
      }
    } else if (!isProcurementDraftReady(draft)) {
      incompleteIds.push(id);
      continue;
    }
    processable.push(id);
  }

  if (!processable.length) {
    if (incompleteIds.length && !skippedIds.length) {
      return {
        ok: false,
        message:
          incompleteIds.length === 1
            ? "Prośba nie ma kompletnych danych — uzupełnij przed Główne."
            : `${incompleteIds.length} próśb nie ma kompletnych danych — uzupełnij przed Główne.`,
        incompleteIds,
        skippedIds: [],
      };
    }
    if (skippedIds.length) {
      const parts = [
        "Żadna z wybranych próśb nie kwalifikuje się już do Główne (status / dostawca / zęby).",
      ];
      if (incompleteIds.length) {
        parts.push(
          `${incompleteIds.length} niekompletnych nadal czeka na uzupełnienie.`
        );
      }
      return {
        ok: true,
        processedIds: [],
        skippedIds,
        incompleteIds,
        skippedIncompleteCount: incompleteIds.length,
        message: parts.join(" "),
      };
    }
    return {
      ok: false,
      message:
        "Żadna z wybranych próśb nie kwalifikuje się już do Główne (status / dostawca / zęby).",
    };
  }

  try {
    const individualsBefore = await captureIndividualOrdersSnapshot(processable);
    const markRes = await processIndividualFromSummary(
      processable,
      "GLOWNE",
      user.email,
      null,
      { skipSupplierSchedule: true }
    );
    revalidateAfterZdEstimateMark();
    const durableSkip = [
      ...new Set([...skippedIds, ...markRes.skippedIds]),
    ];
    const parts = [
      `Odznaczono ${markRes.processedIds.length} ${
        markRes.processedIds.length === 1 ? "prośbę" : "próśb"
      } jako Główne (bez przesunięcia planu).`,
    ];
    if (durableSkip.length || incompleteIds.length) {
      const skipN = durableSkip.length + incompleteIds.length;
      parts.push(
        `Pominięto ${skipN} (status / zęby / niekompletne).`
      );
    }
    return {
      ok: true,
      processedIds: markRes.processedIds,
      skippedIds: durableSkip,
      incompleteIds,
      skippedIncompleteCount: incompleteIds.length,
      message: parts.join(" "),
      undo: buildDailyPanelUndoPayload({
        kind: "individual",
        snapshots: individualsBefore,
      }),
    };
  } catch (e) {
    return {
      ok: false,
      message:
        e instanceof Error
          ? e.message
          : "Nie udało się odznaczyć próśb jako Główne.",
    };
  }
}

export type ZdEstimateMarkScheduleResult =
  | {
      ok: true;
      message: string;
      undo?: DailyPanelUndoPayload;
    }
  | { ok: false; message: string };

export async function actionMarkZdEstimateSupplierOrdered(input: {
  supplierId: string;
}): Promise<ZdEstimateMarkScheduleResult> {
  const user = await requireZdEstimateAdmin("mutate");
  const ctx = await actionGetZdEstimateScheduleMarkContext(input.supplierId);
  if (!ctx.ok) return { ok: false, message: ctx.message };
  if (!ctx.canMark) return { ok: false, message: ctx.message };
  const supplierId = String(input.supplierId ?? "").trim();
  try {
    const scheduleBefore = await captureScheduleSnapshot(supplierId);
    await markStandardOrdered(supplierId, user.email);
    const feedbackLines = await buildMarkOrderedFeedback([supplierId]);
    revalidateAfterZdEstimateMark();
    return {
      ok: true,
      message:
        feedbackLines[0] ?? "Planowane zamówienie oznaczone jako złożone.",
      undo: buildDailyPanelUndoPayload({
        kind: "schedules",
        snapshots: [scheduleBefore],
      }),
    };
  } catch (e) {
    return {
      ok: false,
      message:
        e instanceof Error
          ? e.message
          : "Nie udało się oznaczyć planu jako złożonego.",
    };
  }
}

export async function actionUndoZdEstimateDailyPanelChange(
  payload: DailyPanelUndoPayload
): Promise<{ ok: true } | { ok: false; message: string }> {
  await requireZdEstimateAdmin("mutate");
  try {
    const { actionUndoDailyPanelChange } = await import("@/app/actions/admin");
    await actionUndoDailyPanelChange(payload);
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      message:
        e instanceof Error ? e.message : "Nie udało się cofnąć oznaczenia.",
    };
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
  preset?:
    | "assemble"
    | "buy_separate"
    | "kit_only"
    | "kit_from_components"
    | string
    | null;
  demandAllocation?: "explode" | "separate" | string | null;
  purchaseTarget?:
    | "components"
    | "as_sold"
    | "kit_only"
    | "kit_from_components"
    | string
    | null;
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
      /** Polska → treść maila po polsku, zagranica/import → po angielsku. */
      location: SupplierLocation;
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
      location: (row.location as SupplierLocation | null) ?? "POLSKA",
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
  /** Zmiana istniejącego zakresu; bez — dodanie kolejnego zakresu dostawcy. */
  scopeId?: string | null;
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

export async function actionGetZdBoostPowerPreset(): Promise<
  | { ok: true; preset: ZdBoostPowerPreset }
  | { ok: false; message: string }
> {
  await requireZdEstimateAdmin("read");
  try {
    const preset = await fetchZdBoostPowerPreset();
    return { ok: true, preset };
  } catch (e) {
    return {
      ok: false,
      message: userFacingErrorText(e, "Nie udało się wczytać mocy boosta."),
    };
  }
}

export async function actionSetZdBoostPowerPreset(input: {
  preset: ZdBoostPowerPreset | string;
}): Promise<
  | { ok: true; preset: ZdBoostPowerPreset }
  | { ok: false; message: string }
> {
  await requireZdEstimateAdmin("mutate");
  try {
    const preset = await upsertZdBoostPowerPreset(
      normalizeZdBoostPowerPreset(input.preset)
    );
    return { ok: true, preset };
  } catch (e) {
    return {
      ok: false,
      message: userFacingErrorText(e, "Nie udało się zapisać mocy boosta."),
    };
  }
}

export async function actionListZdEstimateSupplierScopes(): Promise<
  | {
      ok: true;
      scopes: Awaited<ReturnType<typeof listZdEstimateSupplierScopes>>;
    }
  | { ok: false; message: string }
> {
  await requireZdEstimateAdmin("read");
  try {
    const scopes = await listZdEstimateSupplierScopes();
    return { ok: true, scopes };
  } catch (e) {
    return {
      ok: false,
      message: userFacingErrorText(
        e,
        "Nie udało się wczytać mapowań zakresów dostawców."
      ),
    };
  }
}

export async function actionSetPrimaryZdEstimateSupplierScope(input: {
  scopeId: string;
}): Promise<
  | { ok: true; scopes: Awaited<ReturnType<typeof setPrimaryZdEstimateSupplierScope>> }
  | { ok: false; message: string }
> {
  await requireZdEstimateAdmin("mutate");
  try {
    return { ok: true, scopes: await setPrimaryZdEstimateSupplierScope(input.scopeId) };
  } catch (e) {
    return {
      ok: false,
      message: userFacingErrorText(e, "Nie udało się ustawić zakresu głównego."),
    };
  }
}

export async function actionDeleteZdEstimateSupplierScope(input: {
  scopeId: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  await requireZdEstimateAdmin("mutate");
  try {
    await deleteZdEstimateSupplierScope(input.scopeId);
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      message: userFacingErrorText(
        e,
        "Nie udało się usunąć mapowania zakresu."
      ),
    };
  }
}

export async function actionSaveZdEstimateUiPrefs(input: {
  patch: Partial<import("@/lib/orders/zd-estimate-prefs").ZdEstimateUiPrefs>;
}): Promise<
  | { ok: true; prefs: import("@/lib/orders/zd-estimate-prefs").ZdEstimateUiPrefs }
  | { ok: false; message: string }
> {
  await requireZdEstimateAdmin("mutate");
  try {
    const prefs = await upsertOwnZdEstimateUiPrefs(input.patch);
    return { ok: true, prefs };
  } catch (e) {
    return {
      ok: false,
      message: userFacingErrorText(e, "Nie udało się zapisać preferencji."),
    };
  }
}

export async function actionGetZdEstimateExtrasPolicy(): Promise<
  | {
      ok: true;
      policy: import("@/lib/orders/zd-estimate-extras-policy").ZdEstimateExtrasPolicy;
    }
  | { ok: false; message: string }
> {
  await requireZdEstimateAdmin("read");
  try {
    return { ok: true, policy: await fetchZdEstimateExtrasPolicy() };
  } catch (e) {
    return {
      ok: false,
      message: userFacingErrorText(e, "Nie udało się wczytać polityki próśb."),
    };
  }
}

export async function actionSetZdEstimateExtrasPolicy(input: {
  policy: string;
}): Promise<
  | {
      ok: true;
      policy: import("@/lib/orders/zd-estimate-extras-policy").ZdEstimateExtrasPolicy;
    }
  | { ok: false; message: string }
> {
  await requireZdEstimateAdmin("mutate");
  try {
    const policy = await upsertZdEstimateExtrasPolicy(
      parseZdEstimateExtrasPolicy(input.policy)
    );
    return { ok: true, policy };
  } catch (e) {
    return {
      ok: false,
      message: userFacingErrorText(e, "Nie udało się zapisać polityki próśb."),
    };
  }
}

export async function actionGetZdEstimateSnapshotLines(input: {
  snapshotId: string;
}): Promise<
  | {
      ok: true;
      lines: import("@/lib/data/zd-estimate-order-snapshots").ZdEstimateOrderSnapshotLineRow[];
    }
  | { ok: false; message: string }
> {
  await requireZdEstimateAdmin("read");
  try {
    const lines = await fetchZdEstimateOrderSnapshotLines(input.snapshotId);
    return { ok: true, lines };
  } catch (e) {
    return {
      ok: false,
      message: userFacingErrorText(e, "Nie udało się wczytać linii snapshotu."),
    };
  }
}

export async function actionSetZdEstimateSnapshotHistoryEligible(input: {
  snapshotId: string;
  eligible: boolean;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  await requireZdEstimateAdmin("mutate");
  try {
    await updateZdEstimateSnapshotEligibleForHistory(
      input.snapshotId,
      input.eligible
    );
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      message: userFacingErrorText(
        e,
        "Nie udało się zmienić kwalifikacji historii."
      ),
    };
  }
}

// ============================================================================
// Sesje UI kreatora ZD (/zakupy/szacunek) — snapshot + odtwarzanie po nawigacji
// ============================================================================

/** TTL w DB (housekeeping). Timer 3 min „away” liczy klient — DB musi żyć dłużej niż praca przy liście. */
const ZD_ESTIMATE_UI_SESSION_TTL_MS = 24 * 60 * 60 * 1000;

const ZD_ESTIMATE_UI_SESSION_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ZdEstimateUiSessionPayload = ZdEstimateUiSessionSnapshot;

function parseZdEstimateUiSessionId(
  raw: string | null | undefined
): string | null {
  const id = String(raw ?? "").trim();
  if (!id || !ZD_ESTIMATE_UI_SESSION_ID_RE.test(id)) return null;
  return id.toLowerCase();
}

function isUniqueViolationMessage(message: string | undefined): boolean {
  const m = (message ?? "").toLowerCase();
  return m.includes("duplicate key") || m.includes("unique constraint");
}

/**
 * Ephemeral snapshot workbencha „Policz ZD” (zd_estimate_ui_sessions).
 *
 * Świadomie bez revalidatePath/revalidateTag — snapshot nie jest źródłem RSC,
 * a pełny refresh po Server Action resetuje workbench / wyściguje z tokenem
 * sessionStorage. Wyjątek zarejestrowany w MissingRevalidateAfterMutation.ql.
 */
async function persistZdEstimateUiSessionSnapshot(input: {
  payload: ZdEstimateUiSessionPayload;
  schemaVersion: number;
}): Promise<
  | { ok: true; sessionId: string; rotated: true }
  | { ok: false; message: string; rotated: boolean }
> {
  const user = await getSessionUser();
  if (!user) {
    return { ok: false, message: "Brak sesji.", rotated: false };
  }

  const supabase = createAdminClient();

  const clearActive = async (): Promise<
    { ok: true } | { ok: false; message: string }
  > => {
    const { error } = await supabase
      .from("zd_estimate_ui_sessions")
      .delete()
      .eq("owner_user_id", user.id)
      .eq("status", "active");
    if (error) {
      console.error("[zd-ui-session] delete active failed", error.message);
      return { ok: false, message: error.message };
    }
    return { ok: true };
  };

  const insertActive = async (): Promise<
    | { ok: true; sessionId: string }
    | { ok: false; message: string }
  > => {
    const now = new Date();
    const { data, error } = await supabase
      .from("zd_estimate_ui_sessions")
      .insert({
        owner_user_id: user.id,
        status: "active",
        expires_at: new Date(
          now.getTime() + ZD_ESTIMATE_UI_SESSION_TTL_MS
        ).toISOString(),
        payload: input.payload as unknown,
        schema_version: input.schemaVersion,
      })
      .select("id")
      .single();

    if (error || !data) {
      return {
        ok: false,
        message: error?.message ?? "Nie udało się utworzyć sesji.",
      };
    }
    return { ok: true, sessionId: data.id };
  };

  // Nowe „Policz” zastępuje poprzednią aktywną sesję.
  const cleared = await clearActive();
  if (!cleared.ok) return { ...cleared, rotated: false };

  let created = await insertActive();
  if (!created.ok && isUniqueViolationMessage(created.message)) {
    // Wyścig dwóch Policz — spróbuj jeszcze raz po ponownym clear.
    const clearedAgain = await clearActive();
    if (!clearedAgain.ok) return { ...clearedAgain, rotated: true };
    created = await insertActive();
  }

  if (!created.ok) {
    console.error("[zd-ui-session] create failed", created.message);
    return { ...created, rotated: true };
  }

  return { ok: true, sessionId: created.sessionId, rotated: true };
}

export async function actionCreateZdEstimateUiSession(input: {
  payload: ZdEstimateUiSessionPayload;
  schemaVersion: number;
}): Promise<
  | { ok: true; sessionId: string }
  | { ok: false; message: string }
> {
  const user = await getSessionUser();
  if (!user) {
    return { ok: false, message: "Brak sesji." };
  }
  return persistZdEstimateUiSessionSnapshot(input);
}

export async function actionUpsertZdEstimateUiSessionSnapshot(input: {
  sessionId: string;
  payload: ZdEstimateUiSessionPayload;
  schemaVersion: number;
}): Promise<
  | { ok: true; sessionId: string }
  | { ok: false; message: string; reason: "not_found" | "error" }
> {
  const user = await getSessionUser();
  if (!user) {
    return { ok: false, message: "Brak sesji.", reason: "error" };
  }

  const sessionId = parseZdEstimateUiSessionId(input.sessionId);
  if (!sessionId) {
    return { ok: false, message: "Nieprawidłowy identyfikator sesji.", reason: "error" };
  }

  const supabase = createAdminClient();
  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + ZD_ESTIMATE_UI_SESSION_TTL_MS
  ).toISOString();

  const { data, error } = await supabase
    .from("zd_estimate_ui_sessions")
    .update({
      status: "active",
      expires_at: expiresAt,
      payload: input.payload as unknown,
      schema_version: input.schemaVersion,
      updated_at: now.toISOString(),
    })
    .eq("id", sessionId)
    .eq("owner_user_id", user.id)
    .eq("status", "active")
    .select("id")
    .maybeSingle();

  if (error) {
    return { ok: false, message: error.message, reason: "error" };
  }

  if (!data) {
    // Nie odtwarzaj tu — recreate po stronie klienta tylko gdy sessionId nadal bieżący
    // (inaczej stary in-flight upsert kasowałby nowszą sesję po „Policz”).
    return {
      ok: false,
      message: "Nie udało się zaktualizować sesji — wygasła lub nie istnieje.",
      reason: "not_found",
    };
  }

  return { ok: true, sessionId: data.id };
}

export async function actionGetZdEstimateUiSession(input: {
  sessionId: string;
}): Promise<
  | {
      ok: true;
      payload: ZdEstimateUiSessionPayload;
      schemaVersion: number;
      status: string;
      expiresAt: string;
      updatedAt: string;
    }
  | { ok: false; message: string; reason: "not_found" | "expired" }
> {
  const user = await getSessionUser();
  if (!user) {
    return { ok: false, message: "Brak sesji.", reason: "not_found" };
  }

  const sessionId = parseZdEstimateUiSessionId(input.sessionId);
  if (!sessionId) {
    return { ok: false, message: "Nieprawidłowy identyfikator sesji.", reason: "not_found" };
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("zd_estimate_ui_sessions")
    .select("payload, schema_version, status, expires_at, updated_at")
    .eq("id", sessionId)
    .eq("owner_user_id", user.id)
    .maybeSingle();

  if (error) {
    return { ok: false, message: error.message, reason: "not_found" };
  }

  if (!data) {
    return { ok: false, message: "Nie znaleziono sesji.", reason: "not_found" };
  }

  const expiresAt =
    data.expires_at instanceof Date ? data.expires_at : new Date(data.expires_at);
  const expired =
    data.status !== "active" || expiresAt.getTime() <= Date.now();

  if (expired) {
    await supabase
      .from("zd_estimate_ui_sessions")
      .delete()
      .eq("id", sessionId)
      .eq("owner_user_id", user.id);
    return { ok: false, message: "Sesja wygasła.", reason: "expired" };
  }

  return {
    ok: true,
    payload: data.payload as ZdEstimateUiSessionSnapshot,
    schemaVersion: Number(data.schema_version),
    status: data.status as string,
    expiresAt: expiresAt.toISOString(),
    updatedAt: (data.updated_at instanceof Date ? data.updated_at : new Date(data.updated_at)).toISOString(),
  };
}

export async function actionDeleteZdEstimateUiSession(input: {
  sessionId: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const user = await getSessionUser();
  if (!user) {
    return { ok: false, message: "Brak sesji." };
  }

  const sessionId = parseZdEstimateUiSessionId(input.sessionId);
  if (!sessionId) {
    return { ok: false, message: "Nieprawidłowy identyfikator sesji." };
  }

  const supabase = createAdminClient();

  const { error } = await supabase
    .from("zd_estimate_ui_sessions")
    .delete()
    .eq("id", sessionId)
    .eq("owner_user_id", user.id);

  if (error) {
    return { ok: false, message: error.message };
  }

  return { ok: true };
}

