"use server";

// @service-role-ok — autoryzacja require*(); service role z pełnym scope po warstwie aplikacji.

import { revalidatePath } from "next/cache";
import { requireWarehouse } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAppSupplierRefsCached } from "@/lib/data/supplier-refs";
import {
  SubiektNetworkError,
  SubiektNotConfiguredError,
  SubiektRequestError,
  SubiektTimeoutError,
} from "@/lib/subiekt/errors";
import {
  defaultZdSearchDataOd,
  getSubiektZdDocumentCached,
  searchSubiektZdCached,
} from "@/lib/subiekt/subiekt-runtime-cache";
import {
  buildZdReceiveFilterState,
  resolveSupplierForZdDocument,
  type ZdReceiveFilterState,
} from "@/lib/warehouse/zd-receive-filter";
import {
  normalizeZdNumberKey,
  pickZdCandidateFromSearch,
  sortZdReceiveCandidatesByIssuedAtDesc,
  validateZdQueryForSubmit,
  zdNumbersEquivalent,
  zdReceiveSearchChooseHint,
  isPartialZdNumberQuery,
  zdReceiveSearchMonthsBack,
  type ZdReceiveSearchCandidate,
  type ZdSearchCandidate,
} from "@/lib/subiekt/zd-document";
import { parseSubiektDocDate } from "@/lib/subiekt/zk-document";
import {
  assertJournalDateReadable,
  createDeliveryReceipt,
  deleteDeliveryReceipt,
  fetchCarrierHintForSupplier,
  fetchDeliveryDatesWithEntries,
  fetchDeliveryReceiptsForDate,
  summarizeDeliveryReceiptsForDate,
  updateDeliveryReceipt,
  warsawTodayDateKey,
  type WarehouseDeliveryReceipt,
} from "@/lib/warehouse/delivery-receipts";
import { assertWarehouseCarrierSlug } from "@/app/actions/warehouse-carriers";
import {
  parseWarehouseShipmentForm,
} from "@/lib/warehouse/delivery-carriers";
import {
  searchDeliveryReceipts,
  summarizeDeliveryReceiptsRange,
  type DeliveryJournalRangeSummary,
  type DeliveryJournalSearchFilters,
} from "@/lib/warehouse/delivery-journal-insights";

export async function actionListWarehouseAssignSuppliers() {
  await requireWarehouse();
  const refs = await getAppSupplierRefsCached();
  return refs.map((s) => ({
    id: s.id,
    name: s.name,
    subiektKhId: s.subiektKhId ?? null,
  }));
}

export type DeliveryJournalPayload = {
  date: string;
  receipts: WarehouseDeliveryReceipt[];
  summary: { receiptCount: number; packageCount: number; palletCount: number };
};

async function buildDeliveryJournalForDate(date: string): Promise<DeliveryJournalPayload> {
  assertJournalDateReadable(date);
  const [receipts, summary] = await Promise.all([
    fetchDeliveryReceiptsForDate(date),
    summarizeDeliveryReceiptsForDate(date),
  ]);
  return { date, receipts, summary };
}

export async function actionFetchTodayDeliveryJournal(): Promise<DeliveryJournalPayload> {
  await requireWarehouse();
  return buildDeliveryJournalForDate(warsawTodayDateKey());
}

export async function actionFetchDeliveryJournalForDate(
  date: string
): Promise<DeliveryJournalPayload> {
  await requireWarehouse();
  return buildDeliveryJournalForDate(date);
}

export async function actionListDeliveryJournalDates(): Promise<string[]> {
  await requireWarehouse();
  return fetchDeliveryDatesWithEntries(31);
}

export async function actionSearchDeliveryJournal(
  filters: DeliveryJournalSearchFilters
) {
  await requireWarehouse();
  const receipts = await searchDeliveryReceipts(filters);
  return { receipts };
}

export async function actionSummarizeDeliveryJournal(
  filters: DeliveryJournalSearchFilters
): Promise<DeliveryJournalRangeSummary> {
  await requireWarehouse();
  return summarizeDeliveryReceiptsRange(filters);
}

export async function actionFetchCarrierHintForSupplier(supplierId: string) {
  await requireWarehouse();
  return fetchCarrierHintForSupplier(supplierId);
}

export async function actionCreateDeliveryReceipt(input: {
  supplierId: string | null;
  supplierLabel?: string;
  carrier: string;
  shipmentForm: string;
  packageCount: number;
  palletCount: number;
  note?: string;
}) {
  const user = await requireWarehouse("mutate");
  const carrier = await assertWarehouseCarrierSlug(input.carrier);
  const shipmentForm = parseWarehouseShipmentForm(input.shipmentForm);
  const receipt = await createDeliveryReceipt({
    receivedDate: warsawTodayDateKey(),
    supplierId: input.supplierId,
    supplierLabel: input.supplierLabel,
    carrier,
    shipmentForm,
    packageCount: input.packageCount,
    palletCount: input.palletCount,
    note: input.note,
    createdBy: user.id,
  });
  revalidatePath("/kolejka");
  return receipt;
}

export async function actionUpdateDeliveryReceipt(input: {
  id: string;
  supplierId: string | null;
  supplierLabel?: string;
  carrier: string;
  shipmentForm: string;
  packageCount: number;
  palletCount: number;
  note?: string;
}) {
  const user = await requireWarehouse("mutate");
  const carrier = await assertWarehouseCarrierSlug(input.carrier);
  const shipmentForm = parseWarehouseShipmentForm(input.shipmentForm);
  const receipt = await updateDeliveryReceipt({
    id: input.id,
    receivedDate: warsawTodayDateKey(),
    supplierId: input.supplierId,
    supplierLabel: input.supplierLabel,
    carrier,
    shipmentForm,
    packageCount: input.packageCount,
    palletCount: input.palletCount,
    note: input.note,
    updatedBy: user.id,
  });
  revalidatePath("/kolejka");
  return receipt;
}

export async function actionDeleteDeliveryReceipt(id: string) {
  await requireWarehouse("mutate");
  await deleteDeliveryReceipt(id);
  revalidatePath("/kolejka");
  return { success: true as const };
}

function isSubiektOfflineError(error: unknown): boolean {
  return (
    error instanceof SubiektNotConfiguredError ||
    error instanceof SubiektNetworkError ||
    error instanceof SubiektTimeoutError ||
    (error instanceof SubiektRequestError && error.status >= 500)
  );
}

export type ZdResolveReceiveFilterResult = {
  filter: ZdReceiveFilterState;
  subiektOffline: boolean;
};

export type ZdReceiveSearchResult =
  | ({ kind: "single" } & ZdResolveReceiveFilterResult)
  | {
      kind: "choose";
      candidates: ZdReceiveSearchCandidate[];
      hint: string;
      subiektOffline: boolean;
    };

async function enrichZdReceiveCandidates(
  candidates: ZdSearchCandidate[]
): Promise<ZdReceiveSearchCandidate[]> {
  if (!candidates.length) return [];

  const supabase = createAdminClient();
  const dokIds = candidates.map((item) => item.dokId);
  const { data: rows, error } = await supabase
    .from("subiekt_zd_index")
    .select("dok_id, dok_data_wyst, subiekt_kh_label, supplier_id")
    .in("dok_id", dokIds);

  if (error) throw new Error(error.message);

  const suppliers = await getAppSupplierRefsCached();
  const supplierNameById = new Map(suppliers.map((supplier) => [supplier.id, supplier.name]));
  const rowByDokId = new Map(
    (rows ?? []).map((row) => [Math.trunc(row.dok_id), row] as const)
  );

  return sortZdReceiveCandidatesByIssuedAtDesc(
    candidates.map((candidate) => {
      const row = rowByDokId.get(candidate.dokId);
      const supplierLabel =
        (row?.supplier_id ? supplierNameById.get(row.supplier_id) : null) ??
        row?.subiekt_kh_label?.trim() ??
        null;
      return {
        ...candidate,
        supplierLabel,
        issuedAt: row?.dok_data_wyst ?? candidate.issuedAt ?? null,
      };
    })
  );
}

async function loadZdReceiveFilterByDokId(dokId: number): Promise<ZdReceiveFilterState> {
  const id = Math.trunc(dokId);
  if (!Number.isFinite(id) || id <= 0) {
    throw new Error("Nieprawidłowy identyfikator ZD.");
  }

  let doc;
  try {
    doc = await getSubiektZdDocumentCached(id);
  } catch (e) {
    if (isSubiektOfflineError(e)) {
      throw new Error("Subiekt jest niedostępny — spróbuj ponownie za chwilę.");
    }
    if (e instanceof SubiektRequestError && e.status === 404) {
      throw new Error("Nie znaleziono dokumentu ZD w Subiekcie.");
    }
    throw e;
  }

  const supabase = createAdminClient();
  const { data: indexRow } = await supabase
    .from("subiekt_zd_index")
    .select("supplier_id")
    .eq("dok_id", id)
    .maybeSingle();

  const suppliers = await getAppSupplierRefsCached();
  const supplier = resolveSupplierForZdDocument(
    doc,
    suppliers,
    indexRow?.supplier_id ?? null
  );

  if (!supplier) {
    throw new Error(
      "Nie udało się ustalić dostawcy dla tego ZD. Sprawdź powiązanie dostawcy w systemie."
    );
  }

  return buildZdReceiveFilterState({
    dokId: id,
    doc,
    supplier,
  });
}

async function findZdCandidatesByNumber(
  query: string
): Promise<{ candidates: ZdSearchCandidate[]; subiektOffline: boolean }> {
  const supabase = createAdminClient();
  const safeQuery = query.replace(/[%_,]/g, " ").trim();
  const compactKey = normalizeZdNumberKey(safeQuery);
  const dataOd = defaultZdSearchDataOd(zdReceiveSearchMonthsBack(safeQuery));

  const { data: indexRows, error } = await supabase
    .from("subiekt_zd_index")
    .select("dok_id, dok_nr_pelny, dok_data_wyst")
    .eq("verified", true)
    .gte("dok_data_wyst", dataOd)
    .or(`dok_nr_pelny.ilike.%${safeQuery}%,dok_nr_pelny.ilike.%${compactKey}%`)
    .order("dok_data_wyst", { ascending: false })
    .limit(24);

  if (error) throw new Error(error.message);

  const candidates: ZdSearchCandidate[] = (indexRows ?? []).map((row) => ({
    dokId: Math.trunc(row.dok_id),
    docNumber: row.dok_nr_pelny?.trim() || `ZD #${row.dok_id}`,
    issuedAt: row.dok_data_wyst ?? null,
  }));
  const seen = new Set(candidates.map((item) => item.dokId));
  let subiektOffline = false;

  const needsLiveLookup =
    candidates.length === 0 ||
    !candidates.some((item) => zdNumbersEquivalent(item.docNumber, safeQuery));

  if (needsLiveLookup) {
    try {
      const live = await searchSubiektZdCached({
        search: safeQuery,
        dataOd,
        page: 1,
        pageSize: 24,
      });
      for (const doc of live.data) {
        const dokId = Math.trunc(doc.dok_Id);
        if (seen.has(dokId)) continue;
        const docNumber = doc.dok_NrPelny?.trim() || `ZD #${dokId}`;
        if (
          !zdNumbersEquivalent(docNumber, safeQuery) &&
          !normalizeZdNumberKey(docNumber).includes(compactKey) &&
          !compactKey.includes(normalizeZdNumberKey(docNumber))
        ) {
          continue;
        }
        const issuedAt = parseSubiektDocDate(doc.dok_DataWyst);
        if (issuedAt && issuedAt < dataOd) continue;
        candidates.push({
          dokId,
          docNumber,
          issuedAt,
        });
        seen.add(dokId);
      }
    } catch (e) {
      if (isSubiektOfflineError(e)) {
        subiektOffline = true;
      } else {
        throw e;
      }
    }
  }

  candidates.sort((a, b) => {
    const da = a.issuedAt ?? "";
    const db = b.issuedAt ?? "";
    return db.localeCompare(da) || b.dokId - a.dokId;
  });

  return { candidates, subiektOffline };
}

/** Wyszukuje ZD po krótkim kodzie lub pełnym numerze — jeden wynik albo lista do wyboru. */
export async function actionSearchZdReceiveFilter(
  docNumberInput: string
): Promise<ZdReceiveSearchResult> {
  await requireWarehouse();

  const validation = validateZdQueryForSubmit(docNumberInput);
  if (!validation.ok) {
    throw new Error(validation.message);
  }

  const { candidates, subiektOffline } = await findZdCandidatesByNumber(validation.normalized);

  if (candidates.length === 0) {
    throw new Error("Nie znaleziono ZD o podanym numerze.");
  }

  if (isPartialZdNumberQuery(validation.normalized)) {
    return {
      kind: "choose",
      candidates: await enrichZdReceiveCandidates(candidates),
      hint: zdReceiveSearchChooseHint(validation.normalized, candidates.length),
      subiektOffline,
    };
  }

  const picked = pickZdCandidateFromSearch(validation.normalized, candidates);

  if (picked) {
    const filter = await loadZdReceiveFilterByDokId(picked.dokId);
    return { kind: "single", filter, subiektOffline };
  }

  if (candidates.length > 1) {
    return {
      kind: "choose",
      candidates: await enrichZdReceiveCandidates(candidates),
      hint: zdReceiveSearchChooseHint(validation.normalized, candidates.length),
      subiektOffline,
    };
  }

  throw new Error("Nie znaleziono ZD o podanym numerze.");
}

/** Rozwiązuje wybrane ZD po dok_Id (po wyborze z listy kandydatów). */
export async function actionResolveZdReceiveFilterByDokId(
  dokId: number
): Promise<ZdResolveReceiveFilterResult> {
  await requireWarehouse();
  const filter = await loadZdReceiveFilterByDokId(dokId);
  return { filter, subiektOffline: false };
}

/** Wyszukuje ZD po numerze, ustala dostawcę i profil dopasowania do kolejki przyjęcia. */
export async function actionResolveZdReceiveFilter(
  docNumberInput: string
): Promise<ZdResolveReceiveFilterResult> {
  const result = await actionSearchZdReceiveFilter(docNumberInput);
  if (result.kind === "choose") {
    throw new Error(result.hint);
  }
  return result;
}
