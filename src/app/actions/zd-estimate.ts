"use server";

import { requireOperations } from "@/lib/auth";
import {
  deleteZdEstimateExclusion,
  deleteZdEstimateExclusionsMany,
  fetchZdEstimateExclusions,
  updateZdEstimateExclusionNote,
  upsertZdEstimateExclusion,
  type ZdEstimateExclusionRow,
} from "@/lib/data/zd-estimate-exclusions";
import {
  deleteZdEstimatePackaging,
  deleteZdEstimatePackagingMany,
  fetchZdEstimatePackaging,
  upsertZdEstimatePackaging,
  type ZdEstimatePackagingRow,
} from "@/lib/data/zd-estimate-packaging";
import { fetchSuppliersWithSchedules } from "@/lib/data/queries";
import {
  normalizeZdEstimateBulkProducts,
  normalizeZdEstimateBulkTwIds,
  type ZdEstimateBulkProductInput,
} from "@/lib/orders/zd-estimate-bulk";
import { matchSupplierForGroupName } from "@/lib/orders/zd-estimate-group-stock";
import {
  buildManualZdEstimateResult,
  DEFAULT_DNI_ZAPASU,
  salesWindowFromDniZapasu,
  stockPeriodToDniZapasu,
  summarizeManualOrderQty,
  type ManualZdEstimateResult,
} from "@/lib/orders/zd-estimate-manual";
import {
  fetchSubiektOrdersLatestFsDateKey,
  fetchSubiektZdEstimateAll,
  searchSubiektProductGroups,
} from "@/lib/subiekt/api";
import {
  getSubiektConfigSummary,
  resolveSubiektOrdersConfig,
  SUBIEKT_ORDERS_TEST_PORT,
} from "@/lib/subiekt/config";
import {
  feedbackFromException,
  getSubiektFeedback,
  type SubiektFeedback,
} from "@/lib/subiekt/feedback";
import { warsawNowParts } from "@/lib/time/warsaw";
import type { SubiektProductGroup } from "@/lib/subiekt/types";

export type ZdEstimateSupplierOption = {
  id: string;
  name: string;
  stockRaw: string | null;
  stock: number | null;
  dniZapasu: number | null;
  stockLabel: string;
};

export type ZdEstimateGroupOption = {
  grt_Id: number;
  grt_Nazwa: string;
  /** Dopasowana karta OnTime (zapas) — null gdy brak. */
  supplierId: string | null;
  supplierName: string | null;
  dniZapasu: number | null;
  stockLabel: string | null;
};

export type ZdEstimateRunInput = {
  grupaId: number;
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
      };
      exclusions: ZdEstimateExclusionRow[];
      packaging: ZdEstimatePackagingRow[];
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
  };
}

export async function actionZdEstimateBootstrap(): Promise<{
  configured: boolean;
  liveBaseUrl: string | null;
  ordersBaseUrl: string | null;
  ordersBlockedReason: string | null;
  ordersMessage: string | null;
  testPort: number;
  todayKey: string;
  /** Koniec okna FS: ostatnia FS na :5082 albo dziś. */
  salesEndKey: string;
  salesEndFromFs: boolean;
  defaultWindow: { dataOd: string; dataDo: string };
  suppliers: ZdEstimateSupplierOption[];
  quickGroups: ZdEstimateGroupOption[];
  exclusions: ZdEstimateExclusionRow[];
  /** Gdy ustawione — nie ufaj pustej liście wykluczeń (błąd odczytu). */
  exclusionsError: string | null;
  packaging: ZdEstimatePackagingRow[];
  packagingError: string | null;
}> {
  await requireOperations("read");

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

  const { formatStockPeriodCompact } = await import("@/lib/display-labels");

  let suppliers: ZdEstimateSupplierOption[] = [];
  try {
    const rows = await fetchSuppliersWithSchedules(undefined, { activeOnly: true });
    suppliers = rows
      .map((s) => {
        const dniZapasu = stockPeriodToDniZapasu(
          s.stock_raw,
          s.stock != null ? Number(s.stock) : null
        );
        const stockLabel = formatStockPeriodCompact(
          s.stock_raw,
          s.stock != null ? Number(s.stock) : null
        );
        return {
          id: s.id,
          name: s.name,
          stockRaw: s.stock_raw ?? null,
          stock: s.stock != null ? Number(s.stock) : null,
          dniZapasu,
          stockLabel,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, "pl"));
  } catch {
    suppliers = [];
  }

  let exclusions: ZdEstimateExclusionRow[] = [];
  let exclusionsError: string | null = null;
  try {
    exclusions = await fetchZdEstimateExclusions();
  } catch (e) {
    exclusionsError =
      e instanceof Error
        ? e.message
        : "Nie udało się wczytać listy wykluczeń.";
  }

  let packaging: ZdEstimatePackagingRow[] = [];
  let packagingError: string | null = null;
  try {
    packaging = await fetchZdEstimatePackaging();
  } catch (e) {
    packagingError =
      e instanceof Error
        ? e.message
        : "Nie udało się wczytać ustawień opakowań.";
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
    testPort: SUBIEKT_ORDERS_TEST_PORT,
    todayKey,
    salesEndKey,
    salesEndFromFs,
    defaultWindow,
    suppliers,
    quickGroups,
    exclusions,
    exclusionsError,
    packaging,
    packagingError,
  };
}

export async function actionSearchZdEstimateGroups(query: string): Promise<
  | { ok: true; groups: ZdEstimateGroupOption[] }
  | { ok: false; message: string; feedback?: SubiektFeedback }
> {
  await requireOperations("read");
  const q = query.trim();
  if (q.length < 1) return { ok: true, groups: [] };

  const orders = resolveSubiektOrdersConfig();
  if (!orders.ok) {
    const feedback = getSubiektFeedback("not_configured", {
      title: "Tylko testowy Subiekt",
      message: orders.message,
      hint: `Ustaw SUBIEKT_API_ORDERS_BASE_URL=http://192.168.0.140:${SUBIEKT_ORDERS_TEST_PORT}/api/v1`,
    });
    return { ok: false, message: orders.message, feedback };
  }

  try {
    const { formatStockPeriodCompact } = await import("@/lib/display-labels");
    const rows = await fetchSuppliersWithSchedules(undefined, { activeOnly: true });
    const suppliers: ZdEstimateSupplierOption[] = rows.map((s) => {
      const dniZapasu = stockPeriodToDniZapasu(
        s.stock_raw,
        s.stock != null ? Number(s.stock) : null
      );
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
      };
    });

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

export async function actionRunZdEstimateManual(
  input: ZdEstimateRunInput
): Promise<ZdEstimateRunResult> {
  await requireOperations("read");

  const orders = resolveSubiektOrdersConfig();
  if (!orders.ok) {
    const feedback = getSubiektFeedback("not_configured", {
      title: "Tylko testowy Subiekt",
      message: orders.message,
      hint: `Szacunek NIGDY nie używa live :5080. Wymagane: SUBIEKT_API_ORDERS_BASE_URL na :${SUBIEKT_ORDERS_TEST_PORT}.`,
    });
    return { ok: false, message: orders.message, feedback };
  }

  const grupaId = Math.trunc(Number(input.grupaId));
  if (!Number.isFinite(grupaId) || grupaId <= 0) {
    const feedback = getSubiektFeedback("empty_query", {
      title: "Brak grupy",
      message: "Wybierz grupę towarową (np. Falcon, Ivoclar Technical).",
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
    // Pełna lista towarów grupy z Subiekta (nie tylko braki API / nie nasza baza).
    const fetched = await fetchSubiektZdEstimateAll({
      grupaId,
      dniZapasu,
      dataOd,
      dataDo,
      zapasMin: zapasMin > 0 ? zapasMin : undefined,
      tylkoBraki: false,
    });

    const result = buildManualZdEstimateResult(
      fetched.parametry,
      fetched.pozycje,
      { onlyManualBraki: false }
    );

    let exclusions: ZdEstimateExclusionRow[];
    try {
      exclusions = await fetchZdEstimateExclusions();
    } catch (e) {
      const message =
        e instanceof Error
          ? e.message
          : "Nie udało się wczytać listy wykluczeń.";
      const feedback = getSubiektFeedback("empty_query", {
        title: "Wykluczenia niedostępne",
        message: `Lista nie została pokazana — bez wykluczeń mogłaby zawierać produkty celowo pomijane. ${message}`,
        hint: "Odśwież stronę lub spróbuj ponownie za chwilę.",
      });
      return { ok: false, message: feedback.message, feedback };
    }

    let packaging: ZdEstimatePackagingRow[];
    try {
      packaging = await fetchZdEstimatePackaging();
    } catch (e) {
      const message =
        e instanceof Error
          ? e.message
          : "Nie udało się wczytać ustawień opakowań.";
      const feedback = getSubiektFeedback("empty_query", {
        title: "Opakowania niedostępne",
        message: `Lista nie została pokazana — bez opakowań qty ZD mogłoby być w sztukach zamiast paczek. ${message}`,
        hint: "Odśwież stronę lub spróbuj ponownie za chwilę.",
      });
      return { ok: false, message: feedback.message, feedback };
    }

    const excludedIds = new Set(exclusions.map((e) => e.subiektTwId));
    const orderAfterExclusions = summarizeManualOrderQty(
      result.pozycje,
      excludedIds
    );
    const excludedInGroupCount = result.pozycje.filter((p) =>
      excludedIds.has(p.tw_Id)
    ).length;

    return {
      ok: true,
      result,
      exclusions,
      packaging,
      meta: {
        pagesFetched: fetched.pagesFetched,
        totalCountApi: fetched.totalCountApi,
        truncated: fetched.truncated,
        ordersBaseUrl: orders.config.baseUrl,
        durationMs: Date.now() - started,
        totalFromSubiekt: result.totalFromSubiekt,
        doZamowieniaCount: orderAfterExclusions.doZamowieniaCount,
        doZamowieniaSuma: orderAfterExclusions.doZamowieniaSuma,
        doZamowieniaCountRaw: result.doZamowieniaCount,
        doZamowieniaSumaRaw: result.doZamowieniaSuma,
        excludedInGroupCount,
      },
    };
  } catch (e) {
    const feedback = feedbackFromException(e);
    return {
      ok: false,
      message: feedback.message,
      feedback,
    };
  }
}

export type ZdEstimateExclusionActionResult =
  | { ok: true; exclusions: ZdEstimateExclusionRow[] }
  | { ok: false; message: string };

export async function actionListZdEstimateExclusions(): Promise<ZdEstimateExclusionActionResult> {
  await requireOperations("read");
  try {
    const exclusions = await fetchZdEstimateExclusions();
    return { ok: true, exclusions };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Nie udało się pobrać wykluczeń.",
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
  const user = await requireOperations("mutate");
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
    const exclusions = await fetchZdEstimateExclusions();
    return { ok: true, exclusions };
  } catch (e) {
    return {
      ok: false,
      message:
        e instanceof Error ? e.message : "Nie udało się wykluczyć produktu.",
    };
  }
}

export async function actionRestoreZdEstimateProduct(
  subiektTwId: number
): Promise<ZdEstimateExclusionActionResult> {
  await requireOperations("mutate");
  try {
    await deleteZdEstimateExclusion(subiektTwId);
    const exclusions = await fetchZdEstimateExclusions();
    return { ok: true, exclusions };
  } catch (e) {
    return {
      ok: false,
      message:
        e instanceof Error ? e.message : "Nie udało się przywrócić produktu.",
    };
  }
}

export async function actionUpdateZdEstimateExclusionNote(input: {
  subiektTwId: number;
  note: string;
}): Promise<ZdEstimateExclusionActionResult> {
  await requireOperations("mutate");
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
        e instanceof Error ? e.message : "Nie udało się zapisać notatki.",
    };
  }
}

export type ZdEstimatePackagingActionResult =
  | { ok: true; packaging: ZdEstimatePackagingRow[] }
  | { ok: false; message: string };

export async function actionListZdEstimatePackaging(): Promise<ZdEstimatePackagingActionResult> {
  await requireOperations("read");
  try {
    const packaging = await fetchZdEstimatePackaging();
    return { ok: true, packaging };
  } catch (e) {
    return {
      ok: false,
      message:
        e instanceof Error
          ? e.message
          : "Nie udało się pobrać ustawień opakowań.",
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
  const user = await requireOperations("mutate");
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
        e instanceof Error
          ? e.message
          : "Nie udało się zapisać opakowania.",
    };
  }
}

export async function actionDeleteZdEstimatePackaging(
  subiektTwId: number
): Promise<ZdEstimatePackagingActionResult> {
  await requireOperations("mutate");
  try {
    await deleteZdEstimatePackaging(subiektTwId);
    const packaging = await fetchZdEstimatePackaging();
    return { ok: true, packaging };
  } catch (e) {
    return {
      ok: false,
      message:
        e instanceof Error
          ? e.message
          : "Nie udało się usunąć opakowania.",
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
  const user = await requireOperations("mutate");
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
        e instanceof Error
          ? e.message
          : "Zapisano część wykluczeń, ale nie udało się odświeżyć listy.",
    };
  }
}

/** Grupowe przywrócenie z listy wykluczeń. */
export async function actionRestoreZdEstimateProducts(
  subiektTwIds: number[]
): Promise<ZdEstimateBulkExclusionActionResult> {
  await requireOperations("mutate");
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
        e instanceof Error
          ? e.message
          : "Nie udało się przywrócić produktów.",
    };
  }
}

/**
 * Grupowe opakowanie — te same jednostki ZD dla wszystkich zaznaczonych.
 * unitsPerPackage === 1 usuwa ustawienie (jak przy pojedynczym zapisie).
 */
export async function actionUpsertZdEstimatePackagingBulk(input: {
  products: ZdEstimateBulkProductInput[];
  unitsPerPackage: number;
  packageLabel?: string;
  note?: string;
}): Promise<ZdEstimateBulkPackagingActionResult> {
  const user = await requireOperations("mutate");
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
        e instanceof Error
          ? e.message
          : "Zapisano część opakowań, ale nie udało się odświeżyć listy.",
    };
  }
}

/** Grupowe usunięcie opakowań (powrót do 1:1 sztuk). */
export async function actionDeleteZdEstimatePackagingBulk(
  subiektTwIds: number[]
): Promise<ZdEstimateBulkPackagingActionResult> {
  await requireOperations("mutate");
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
        e instanceof Error
          ? e.message
          : "Nie udało się usunąć opakowań.",
    };
  }
}
