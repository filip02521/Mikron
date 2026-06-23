import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDbError } from "@/lib/supabase/db-errors";
import {
  normalizeIndividualOrder,
  normalizeIndividualOrders,
} from "@/lib/data/normalize-order";
import {
  calculateNextOrderDate,
  dateToIso,
  parseDateOnly,
  resolveSupplierInterval,
  snapToBusinessDay,
} from "@/lib/orders/dates";
import { todayInWarsaw } from "@/lib/time/warsaw";
import { resolveStatusFromDeliveredQuantity } from "@/lib/orders/individual";
import { effectiveSalesCancelledQuantity } from "@/lib/orders/sales-cancel";
import { recalcSingleSupplierSchedule } from "@/lib/services/sync";
import {
  aggregateDeliveryStatsFromOrders,
  aggregatedToDeliveryStatsRow,
  businessDaysForDeliveryStatsSample,
  DELIVERY_STATS_COMPLETED_STATUS,
  hasSiblingDeliveryStatsSample,
  type DeliveryStatsOrderInput,
} from "@/lib/orders/delivery-stats-aggregation";
import type {
  IndividualOrder,
  IndividualOrderStatus,
  OrderType,
} from "@/types/database";
import { scheduleHistoryRetentionPurge } from "@/lib/services/history-cleanup";
import { releaseLock, tryAcquireLock } from "@/lib/services/locks";
import {
  sendDeliveryNotificationEmails,
  sendInformacjaArrivedEmails,
  sendProcurementCancelEmails,
} from "@/lib/services/email";
import type { IndividualRequestKind } from "@/types/database";
import { INFORMACJA_NO_QUANTITY, quantityForRequestKind } from "@/lib/orders/individual";
import { isInformacjaWarehouseQueueOrder } from "@/lib/orders/informacja-warehouse-queue";
import {
  flagsFromInformacjaFlowPath,
  isInformacjaStockOutReorder,
} from "@/lib/orders/informacja-stock-out-reorder";
import { glowneScheduleSupplierIds, glowneSchedulableSupplierIds } from "@/lib/orders/glowne-supplier-placement";
import { resolveVerificationInformacjaFlags } from "@/lib/orders/verification-informacja-ui";
import type { InformacjaFlowPath } from "@/lib/orders/informacja-stock-out-reorder";
import { isProcurementDraftReady } from "@/lib/orders/procurement-readiness";
import { normalizeSalesClientName } from "@/lib/orders/sales-client-label";
import { normalizeSalesRequestNote } from "@/lib/orders/sales-request-note";
import {
  normalizeProcurementCancelNote,
  throwIfProcurementCancelNoteColumnMissing,
  buildProcurementCancelUpdate,
  isProcurementInitiatedCancel,
  canEditProcurementCancelNote,
} from "@/lib/orders/procurement-cancel-note";
import {
  normalizeZkProsbaSourceInput,
  zkProsbaSourceFromOrder,
} from "@/lib/orders/zk-prosba-source";
import { WAREHOUSE_SHELF_DEFAULT } from "@/lib/orders/warehouse-inventory";
import type { SalesPersonEmailBatch } from "@/lib/email/sales-notification-types";
import {
  buildDeliveryNotificationItem,
  buildInformacjaNotificationItem,
  buildProcurementCancelNotificationItem,
} from "@/lib/email/sales-notification-items";
import {
  assessRequestCompleteness,
  hasAnyProductHint,
  hasValidOrderQuantity,
  normalizeDraftProducts,
} from "@/lib/orders/request-completeness";
import { planSalesRequestSubmit } from "@/lib/orders/sales-request-submit";
import {
  canEditIndividualRequestGroup,
  resolveIndividualRequestEditLineId,
  type IndividualRequestEditPayload,
} from "@/lib/orders/individual-request-edit";
import { v4 as uuidv4 } from "uuid";
import { resolveSalesPersonEmail } from "@/lib/orders/resolve-sales-person-email";
import {
  assertMaxBatchSize,
  MAX_BATCH_ORDER_LINES,
  MAX_DELIVERED_QTY_LEN,
  MAX_QUEUE_BATCH_SIZE,
  MAX_REQUEST_EDIT_LINES,
} from "@/lib/security/text-limits";
import { sanitizeOrderDraftFields } from "@/lib/security/sanitize-order-fields";
import { indexOrderLineToProductCatalog } from "@/lib/data/product-catalog";
import {
  assertProcurementEntryComplete,
  procurementStatusForEntry,
  shouldLinkProcurementCatalogEntry,
} from "@/lib/orders/procurement-submit";
import {
  formatGlowneMissingIntervalError,
  supplierNamesWithoutOrderInterval,
} from "@/lib/orders/glowne-interval-validation";
import { shouldSyncZkWatchLineChecksAfterDeliveryChange } from "@/lib/sales/zk-watch-order-sync";

async function recalcSupplierSchedule(supplierId: string) {
  await recalcSingleSupplierSchedule(supplierId);
}

export async function logNormalHistory(
  supplierId: string,
  action: string,
  nextDate: Date | null,
  userEmail: string
) {
  const supabase = createAdminClient();
  await supabase.from("normal_order_history").insert({
    supplier_id: supplierId,
    action,
    user_email: userEmail,
    next_date: dateToIso(nextDate),
  });
  scheduleHistoryRetentionPurge();
}

export async function markStandardOrdered(
  supplierId: string,
  userEmail: string
) {
  const supabase = createAdminClient();
  const { data: supplier } = await supabase
    .from("suppliers")
    .select("*")
    .eq("id", supplierId)
    .single();
  const interval = resolveSupplierInterval(
    supplier?.interval_raw as string | null,
    supplier?.interval_weeks != null ? Number(supplier.interval_weeks) : null
  );
  if (!interval) {
    throw new Error(`Brak interwału dla dostawcy`);
  }

  const orderDateKey = dateToIso(todayInWarsaw());
  if (!orderDateKey) {
    throw new Error("Nie udało się ustalić daty bieżącej.");
  }

  await supabase.from("supplier_schedules").upsert(
    {
      supplier_id: supplierId,
      order_date: orderDateKey,
      shift_date: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "supplier_id" }
  );

  await recalcSupplierSchedule(supplierId);

  const { data: updatedSchedule } = await supabase
    .from("supplier_schedules")
    .select("computed_next_date")
    .eq("supplier_id", supplierId)
    .maybeSingle();
  const historyDate = parseDateOnly(updatedSchedule?.computed_next_date ?? null);
  await logNormalHistory(supplierId, "Zamówione", historyDate, userEmail);
}

export async function shiftSupplierOrder(
  supplierId: string,
  weeks: number | null,
  manualDate: Date | null,
  userEmail: string
) {
  const supabase = createAdminClient();
  const { data: supplier } = await supabase
    .from("suppliers")
    .select("*, supplier_schedules(*)")
    .eq("id", supplierId)
    .single();
  if (!supplier) throw new Error("Nie znaleziono dostawcy");

  const schedule = Array.isArray(supplier.supplier_schedules)
    ? supplier.supplier_schedules[0]
    : supplier.supplier_schedules;

  let newShift: Date;
  if (manualDate) {
    newShift = snapToBusinessDay(manualDate);
  } else if (weeks) {
    const base =
      parseDateOnly(schedule?.shift_date ?? null) ??
      parseDateOnly(schedule?.computed_next_date ?? null) ??
      parseDateOnly(schedule?.order_date ?? null) ??
      snapToBusinessDay(todayInWarsaw());
    const next = calculateNextOrderDate(base, weeks);
    if (!next) throw new Error("Nieprawidłowa data");
    newShift = next;
  } else {
    throw new Error("Brak parametrów przesunięcia");
  }

  await supabase.from("supplier_schedules").upsert(
    {
      supplier_id: supplierId,
      order_date: schedule?.order_date,
      shift_date: dateToIso(newShift),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "supplier_id" }
  );

  await recalcSupplierSchedule(supplierId);
  const { data: updatedSchedule } = await supabase
    .from("supplier_schedules")
    .select("computed_next_date")
    .eq("supplier_id", supplierId)
    .maybeSingle();
  const historyDate = parseDateOnly(updatedSchedule?.computed_next_date ?? null) ?? newShift;
  await logNormalHistory(
    supplierId,
    manualDate ? "Ręcznie przesunięte" : `Przesunięte o ${weeks} tyg.`,
    historyDate,
    userEmail
  );
}

export async function batchAddIndividualOrders(
  entries: Array<{
    supplierId?: string;
    salesPersonId: string;
    symbol?: string;
    mikranCode?: string;
    product?: string;
    quantity?: string;
    requestKind?: IndividualRequestKind;
    clientName?: string;
    clientKhId?: number | null;
    requestNote?: string | null;
    subiektTwId?: number | null;
    sourceZkWatchId?: string | null;
    sourceZkNumber?: string | null;
    informacjaQueueViaDailyPanel?: boolean;
    informacjaStockOutReorder?: boolean;
  }>,
  createdBy?: string,
  options?: { submitMode?: "sales" | "procurement" }
): Promise<{
  count: number;
  complete: number;
  verification: number;
}> {
  assertMaxBatchSize(entries.length, MAX_BATCH_ORDER_LINES, "pozycji");

  const { tryAcquireLock, releaseLock } = await import("@/lib/services/locks");
  const ok = await tryAcquireLock("BATCH_INDIVIDUAL", 10);
  if (!ok) throw new Error("Trwa inna operacja dodawania zamówień");

  const supabase = createAdminClient();
  const submissionGroupId = uuidv4();
  const procurementMode = options?.submitMode === "procurement";
  const catalogSource = procurementMode ? "procurement_verification" : "order_history";
  try {
    let complete = 0;
    let verification = 0;

    // Nowe podejście: jeśli handlowiec wpisał symbol / kod, ale nie wybrał pozycji z podpowiedzi Subiekta,
    // spróbuj dopasować tw_Id po naszej bazie `subiekt_products` (symbol/plu).
    // Dzięki temu dalsze kroki (katalog mapowań produkt→dostawca) działają bez ZD.
    const escapeIlike = (v: string) => v.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
    const resolveTwIdFromCatalog = async (input: {
      subiektTwId?: number | null;
      symbol?: string;
      mikranCode?: string;
    }): Promise<number | null> => {
      const existing = input.subiektTwId != null ? Math.trunc(Number(input.subiektTwId)) : null;
      if (existing && Number.isFinite(existing) && existing > 0) return existing;

      const symbol = String(input.symbol ?? "").trim();
      const plu = String(input.mikranCode ?? "").trim();

      // 1) symbol exact (case-insensitive) => ilike bez wildcardów
      if (symbol) {
        const pattern = escapeIlike(symbol);
        const { data, error } = await supabase
          .from("subiekt_products")
          .select("subiekt_tw_id, symbol")
          .ilike("symbol", pattern)
          .limit(2);
        if (error) throw new Error(error.message);
        if ((data ?? []).length === 1) {
          const row = (data ?? [])[0] as { subiekt_tw_id: number | string };
          return Number(row.subiekt_tw_id) || null;
        }
      }

      // 2) PLU (Mikran) exact
      if (plu) {
        const pattern = escapeIlike(plu);
        const { data, error } = await supabase
          .from("subiekt_products")
          .select("subiekt_tw_id, plu")
          .ilike("plu", pattern)
          .limit(2);
        if (error) throw new Error(error.message);
        if ((data ?? []).length === 1) {
          const row = (data ?? [])[0] as { subiekt_tw_id: number | string };
          return Number(row.subiekt_tw_id) || null;
        }
      }

      return null;
    };

    const rows = await Promise.all(entries.map(async (e) => {
      const sanitized = sanitizeOrderDraftFields({
        symbol: e.symbol,
        mikranCode: e.mikranCode,
        product: e.product,
        quantity: e.quantity,
      });
      const kind = (e.requestKind ?? "zamowienie") as IndividualRequestKind;
      let informacjaQueueViaDailyPanel =
        kind === "informacja" && Boolean(e.informacjaQueueViaDailyPanel);
      const informacjaStockOutReorder =
        kind === "informacja" && Boolean(e.informacjaStockOutReorder);
      if (informacjaStockOutReorder) {
        informacjaQueueViaDailyPanel = false;
      }
      const draft = {
        supplierId: e.supplierId,
        symbol: sanitized.symbol,
        mikranCode: sanitized.mikranCode,
        product: sanitized.product,
        quantity: sanitized.quantity,
        requestKind: kind,
        informacjaQueueViaDailyPanel,
        subiektTwId: await resolveTwIdFromCatalog({
          subiektTwId: e.subiektTwId,
          symbol: sanitized.symbol,
          mikranCode: sanitized.mikranCode,
        }),
      };
      if (!hasAnyProductHint(draft)) {
        throw new Error("Podaj symbol, kod Mikran lub opis produktu.");
      }

      let status: IndividualOrderStatus;
      if (procurementMode) {
        assertProcurementEntryComplete({
          ...draft,
          requestKind: kind,
          informacjaQueueViaDailyPanel,
        });
        status = procurementStatusForEntry({ ...draft, requestKind: kind });
        complete++;
      } else {
        const submitPlan = planSalesRequestSubmit(draft);
        if (!submitPlan.submittable) {
          if (kind === "zamowienie" && !hasValidOrderQuantity(sanitized.quantity, kind)) {
            throw new Error("Podaj ilość (liczba sztuk, np. 1).");
          }
          throw new Error("Uzupełnij wymagane pola prośby.");
        }
        status = submitPlan.initialStatus;
        if (status === "Nowe") complete++;
        else verification++;
      }

      const { products, symbol } = normalizeDraftProducts(draft);
      // Stare podejście (dopasowanie dostawcy z ZD w tle) zostało wycofane.

      return {
        id: uuidv4(),
        supplier_id: e.supplierId?.trim() || null,
        sales_person_id: e.salesPersonId,
        symbol,
        products,
        quantity: quantityForRequestKind(kind, sanitized.quantity),
        status,
        order_type: "None" as OrderType,
        request_kind: kind,
        submission_group_id: submissionGroupId,
        created_by: createdBy ?? null,
        sales_client_name: normalizeSalesClientName(e.clientName),
        sales_client_kh_id:
          e.clientKhId != null && e.clientKhId > 0 ? Math.trunc(e.clientKhId) : null,
        sales_request_note: normalizeSalesRequestNote(e.requestNote),
        subiekt_tw_id:
          draft.subiektTwId != null && draft.subiektTwId > 0 ? draft.subiektTwId : null,
        mikran_code: sanitized.mikranCode?.trim() || null,
        informacja_queue_via_daily_panel: informacjaQueueViaDailyPanel,
        informacja_stock_out_reorder: informacjaStockOutReorder,
        ...normalizeZkProsbaSourceInput({
          sourceZkWatchId: e.sourceZkWatchId,
          sourceZkNumber: e.sourceZkNumber,
        }),
      };
    }));
    const { error } = await supabase.from("individual_orders").insert(rows);
    if (error) {
      const msg = formatDbError(error);
      if (msg.includes("source_zk")) {
        throw new Error(
          `${msg} — uruchom migrację supabase/migrations/055_individual_orders_source_zk.sql w bazie.`
        );
      }
      if (msg.includes("mikran_code")) {
        throw new Error(
          `${msg} — uruchom migrację supabase/migrations/031_mikran_code.sql w bazie.`
        );
      }
      if (msg.includes("sales_request_note")) {
        throw new Error(
          `${msg} — uruchom migrację supabase/migrations/058_individual_orders_sales_request_note.sql w bazie.`
        );
      }
      throw new Error(msg);
    }

    const { after } = await import("next/server");
    after(async () => {
      for (const row of rows) {
        try {
          await indexOrderLineToProductCatalog({
            orderId: row.id,
            subiektTwId: row.subiekt_tw_id ?? null,
            symbol: row.symbol ?? null,
            productName: row.products ?? null,
            mikranCode: row.mikran_code ?? null,
            supplierId: row.supplier_id ?? null,
            actionAt: null,
            source: catalogSource,
            linkSupplier: procurementMode
              ? shouldLinkProcurementCatalogEntry({
                  subiektTwId: row.subiekt_tw_id,
                  supplierId: row.supplier_id ?? undefined,
                  symbol: row.symbol ?? undefined,
                  product: row.products ?? undefined,
                  quantity: row.quantity ?? undefined,
                  requestKind: row.request_kind ?? "zamowienie",
                })
              : Boolean(row.supplier_id && row.subiekt_tw_id),
          });
        } catch (e) {
          console.error("[indexOrderLineToProductCatalog batchAdd]", e);
        }
      }
    });

    return { count: rows.length, complete, verification };
  } finally {
    await releaseLock("BATCH_INDIVIDUAL");
  }
}

export async function completeVerificationOrder(
  orderId: string,
  data: {
    supplierId: string;
    salesPersonId: string;
    symbol?: string;
    mikranCode?: string;
    product: string;
    quantity?: string;
    requestKind?: IndividualRequestKind;
    subiektTwId?: number | null;
    informacjaPath?: InformacjaFlowPath;
  }
) {
  const kind = (data.requestKind ?? "zamowienie") as IndividualRequestKind;
  const supabase = createAdminClient();
  const { data: priorRow, error: priorErr } = await supabase
    .from("individual_orders")
    .select(
      "id, request_kind, informacja_queue_via_daily_panel, informacja_stock_out_reorder"
    )
    .eq("id", orderId)
    .eq("status", "Weryfikacja")
    .maybeSingle();

  if (priorErr) throw new Error(priorErr.message);
  if (!priorRow) {
    throw new Error("Prośba została już przetworzona — odśwież listę.");
  }

  const informacjaFlags = resolveVerificationInformacjaFlags({
    requestKind: kind,
    informacjaPath: data.informacjaPath ?? null,
    priorOrder: priorRow as IndividualOrder,
  });

  const sanitized = sanitizeOrderDraftFields({
    symbol: data.symbol,
    mikranCode: data.mikranCode,
    product: data.product,
    quantity: data.quantity,
  });
  const assessment = assessRequestCompleteness({
    supplierId: data.supplierId,
    symbol: sanitized.symbol,
    mikranCode: sanitized.mikranCode,
    product: sanitized.product,
    quantity: sanitized.quantity,
    requestKind: kind,
    informacjaQueueViaDailyPanel: informacjaFlags.informacjaQueueViaDailyPanel,
    informacjaStockOutReorder: informacjaFlags.informacjaStockOutReorder,
  });
  if (assessment !== "complete") {
    throw new Error(
      kind === "zamowienie"
        ? "Uzupełnij dostawcę, opis produktu i ilość (np. 1), aby zatwierdzić."
        : "Uzupełnij dostawcę oraz opis produktu, aby zatwierdzić."
    );
  }

  const { products, symbol } = normalizeDraftProducts({
    ...data,
    symbol: sanitized.symbol,
    product: sanitized.product,
    quantity: sanitized.quantity,
  });
  const { data: updated, error } = await supabase
    .from("individual_orders")
    .update({
      supplier_id: data.supplierId,
      sales_person_id: data.salesPersonId,
      symbol,
      products,
      quantity: quantityForRequestKind(data.requestKind, sanitized.quantity),
      request_kind: (data.requestKind ?? "zamowienie") as IndividualRequestKind,
      status: "Nowe",
      subiekt_tw_id:
        data.subiektTwId != null && data.subiektTwId > 0 ? data.subiektTwId : null,
      mikran_code: sanitized.mikranCode?.trim() || null,
      informacja_queue_via_daily_panel: informacjaFlags.informacjaQueueViaDailyPanel,
      informacja_stock_out_reorder: informacjaFlags.informacjaStockOutReorder,
    })
    .eq("id", orderId)
    .eq("status", "Weryfikacja")
    .select("id")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!updated) {
    throw new Error("Prośba została już przetworzona — odśwież listę.");
  }

  try {
    const twId =
      data.subiektTwId != null && data.subiektTwId > 0 ? data.subiektTwId : null;
    await indexOrderLineToProductCatalog({
      orderId,
      subiektTwId: twId,
      symbol,
      productName: products,
      mikranCode: sanitized.mikranCode?.trim() || null,
      supplierId: data.supplierId,
      actionAt: new Date().toISOString(),
      source: "procurement_verification",
      linkSupplier: shouldLinkProcurementCatalogEntry({
        subiektTwId: twId,
        supplierId: data.supplierId,
        symbol,
        product: products,
        quantity: sanitized.quantity,
        requestKind: data.requestKind ?? "zamowienie",
      }),
    });
  } catch (e) {
    console.error("[indexOrderLineToProductCatalog completeVerificationOrder]", e);
  }
}

function statusForEditedLine(
  draft: {
    supplierId: string;
    symbol?: string;
    mikranCode?: string;
    product?: string;
    quantity?: string;
    requestKind: IndividualRequestKind;
    subiektTwId?: number | null;
  }
): { status: IndividualOrderStatus; supplierResolvePending: boolean } {
  const plan = planSalesRequestSubmit({
    supplierId: draft.supplierId?.trim() || undefined,
    symbol: draft.symbol,
    mikranCode: draft.mikranCode,
    product: draft.product,
    quantity: draft.quantity,
    requestKind: draft.requestKind,
    subiektTwId: draft.subiektTwId,
  });
  if (!plan.submittable) {
    return { status: "Weryfikacja", supplierResolvePending: false };
  }
  return {
    status: plan.initialStatus,
    supplierResolvePending: false,
  };
}

export async function updateIndividualRequestGroup(
  orderIds: string[],
  payload: IndividualRequestEditPayload,
  options: {
    salesPersonIdConstraint?: string;
    /**
     * Źródło indeksowania do katalogu produktów.
     * - Edycje handlowca w "/moje" powinny być słabszym sygnałem ("order_history")
     * - Operacje/zakupy (admin) mogą zapisywać mocny sygnał ("procurement_verification")
     */
    catalogSource?: "order_history" | "procurement_verification";
    /** Sesja użytkownika (JWT) — np. edycja prośby z /moje; domyślnie service role. */
    supabase?: SupabaseClient;
  }
): Promise<{ updated: number; inserted: number; removed: number }> {
  if (!orderIds.length) throw new Error("Brak pozycji do edycji.");
  if (!payload.lines.length) throw new Error("Dodaj co najmniej jedną pozycję.");
  assertMaxBatchSize(payload.lines.length, MAX_REQUEST_EDIT_LINES, "pozycji w prośbie");

  const { assertProsbaSubmitStockAllowed } = await import("@/lib/orders/prosba-stock-server");
  await assertProsbaSubmitStockAllowed({
    lines: payload.lines,
    requestKind: payload.requestKind,
    acknowledgeSufficientStock: payload.acknowledgeSufficientStock,
  });

  const supabase = options.supabase ?? createAdminClient();
  const { data: rawRows, error: fetchError } = await supabase
    .from("individual_orders")
    .select("*")
    .in("id", orderIds);

  if (fetchError) throw new Error(fetchError.message);
  const existing = normalizeIndividualOrders(rawRows ?? []);
  if (existing.length !== orderIds.length) {
    throw new Error("Nie znaleziono wszystkich pozycji prośby.");
  }

  if (!canEditIndividualRequestGroup(existing)) {
    throw new Error(
      "Tej prośby nie można już edytować — została zamówiona u dostawcy lub anulowana."
    );
  }

  if (options.salesPersonIdConstraint) {
    for (const row of existing) {
      if (row.sales_person_id !== options.salesPersonIdConstraint) {
        throw new Error("Brak uprawnień do edycji tej prośby.");
      }
    }
    if (payload.salesPersonId !== options.salesPersonIdConstraint) {
      throw new Error("Nie można zmienić przypisanego handlowca.");
    }
  }

  const catalogSource: "order_history" | "procurement_verification" =
    options.catalogSource ??
    (options.salesPersonIdConstraint ? "order_history" : "procurement_verification");

  const submissionGroupId =
    existing[0]?.submission_group_id ?? uuidv4();
  const inheritedZkSource = zkProsbaSourceFromOrder(existing[0]);
  const keptIds = new Set<string>();
  let updated = 0;
  let inserted = 0;
  // Stare podejście (dopasowanie dostawcy z ZD) zostało wycofane.

  const resolveInformacjaFlags = (lineId?: string) => {
    if (payload.requestKind !== "informacja") {
      return { informacjaQueueViaDailyPanel: false, informacjaStockOutReorder: false };
    }
    if (payload.informacjaPath) {
      const flags = flagsFromInformacjaFlowPath(payload.informacjaPath);
      return {
        informacjaQueueViaDailyPanel: flags.informacjaQueueViaDailyPanel,
        informacjaStockOutReorder: flags.informacjaStockOutReorder,
      };
    }
    const prior =
      (lineId ? existing.find((o) => o.id === lineId) : null) ?? existing[0];
    return {
      informacjaQueueViaDailyPanel: prior?.informacja_queue_via_daily_panel === true,
      informacjaStockOutReorder: prior?.informacja_stock_out_reorder === true,
    };
  };

  const existingOrderIds = existing.map((order) => order.id);

  for (const line of payload.lines) {
    const kind = payload.requestKind;
    const existingLineId = resolveIndividualRequestEditLineId(line.id, existingOrderIds);
    const informacjaFlags = resolveInformacjaFlags(existingLineId);
    const sanitized = sanitizeOrderDraftFields({
      symbol: line.symbol,
      mikranCode: line.mikranCode,
      product: line.product,
      quantity: line.quantity,
    });
    const draft = {
      supplierId: payload.supplierId,
      symbol: sanitized.symbol,
      mikranCode: sanitized.mikranCode,
      product: sanitized.product,
      quantity: sanitized.quantity,
      requestKind: kind,
      informacjaQueueViaDailyPanel: informacjaFlags.informacjaQueueViaDailyPanel,
      informacjaStockOutReorder: informacjaFlags.informacjaStockOutReorder,
    };
    if (!hasAnyProductHint(draft)) {
      throw new Error("Podaj symbol, kod Mikran lub opis produktu w każdej pozycji.");
    }
    if (kind === "zamowienie" && !hasValidOrderQuantity(sanitized.quantity, kind)) {
      throw new Error("Podaj ilość (liczba sztuk, np. 1) w każdej pozycji zamówienia.");
    }

    const { products, symbol } = normalizeDraftProducts(draft);
    const lineDraft = { ...draft, subiektTwId: line.subiektTwId };
    const status =
      catalogSource === "procurement_verification"
        ? procurementStatusForEntry(lineDraft)
        : statusForEditedLine(lineDraft).status;
    const salesRequestNote =
      line.requestNote !== undefined
        ? normalizeSalesRequestNote(line.requestNote)
        : payload.requestNote !== undefined
          ? normalizeSalesRequestNote(payload.requestNote)
          : existingLineId
            ? undefined
            : null;
    const rowPayload = {
      supplier_id: payload.supplierId.trim() || null,
      sales_person_id: payload.salesPersonId,
      symbol,
      products,
      quantity: quantityForRequestKind(kind, sanitized.quantity),
      request_kind: kind,
      status,
      sales_client_name: normalizeSalesClientName(line.clientName),
      sales_client_kh_id:
        line.clientKhId != null && line.clientKhId > 0
          ? Math.trunc(line.clientKhId)
          : null,
      ...(salesRequestNote !== undefined ? { sales_request_note: salesRequestNote } : {}),
      subiekt_tw_id:
        line.subiektTwId != null && line.subiektTwId > 0 ? line.subiektTwId : null,
      mikran_code: sanitized.mikranCode?.trim() || null,
      informacja_queue_via_daily_panel: informacjaFlags.informacjaQueueViaDailyPanel,
      informacja_stock_out_reorder: informacjaFlags.informacjaStockOutReorder,
    };

    if (existingLineId) {
      const { error } = await supabase
        .from("individual_orders")
        .update(rowPayload)
        .eq("id", existingLineId)
        .in("status", ["Nowe", "Weryfikacja"]);
      if (error) throw new Error(error.message);
      keptIds.add(existingLineId);
      updated++;

      try {
        await indexOrderLineToProductCatalog({
          orderId: existingLineId,
          subiektTwId: rowPayload.subiekt_tw_id ?? null,
          symbol: rowPayload.symbol ?? null,
          productName: rowPayload.products ?? null,
          mikranCode: rowPayload.mikran_code ?? null,
          supplierId: rowPayload.supplier_id ?? null,
          actionAt: new Date().toISOString(),
          source: catalogSource,
          linkSupplier:
            catalogSource === "procurement_verification"
              ? shouldLinkProcurementCatalogEntry(lineDraft)
              : Boolean(rowPayload.supplier_id && rowPayload.subiekt_tw_id),
        });
      } catch (e) {
        console.error("[indexOrderLineToProductCatalog updateIndividualRequestGroup update]", e);
      }
    } else {
      const newId = uuidv4();
      const { error } = await supabase.from("individual_orders").insert({
        id: newId,
        ...rowPayload,
        ...inheritedZkSource,
        order_type: "None" as OrderType,
        submission_group_id: submissionGroupId,
      });
      if (error) throw new Error(formatDbError(error));
      inserted++;

      try {
        await indexOrderLineToProductCatalog({
          orderId: newId,
          subiektTwId: rowPayload.subiekt_tw_id ?? null,
          symbol: rowPayload.symbol ?? null,
          productName: rowPayload.products ?? null,
          mikranCode: rowPayload.mikran_code ?? null,
          supplierId: rowPayload.supplier_id ?? null,
          actionAt: new Date().toISOString(),
          source: catalogSource,
          linkSupplier:
            catalogSource === "procurement_verification"
              ? shouldLinkProcurementCatalogEntry(lineDraft)
              : Boolean(rowPayload.supplier_id && rowPayload.subiekt_tw_id),
        });
      } catch (e) {
        console.error("[indexOrderLineToProductCatalog updateIndividualRequestGroup insert]", e);
      }
    }
  }

  const removeIds = orderIds.filter((id) => !keptIds.has(id));
  let removed = 0;
  if (removeIds.length) {
    const { error } = await supabase
      .from("individual_orders")
      .delete()
      .in("id", removeIds)
      .in("status", ["Nowe", "Weryfikacja"]);
    if (error) throw new Error(error.message);
    removed = removeIds.length;
  }

  return { updated, inserted, removed };
}

type IndividualOrderProcessSnapshot = {
  id: string;
  status: IndividualOrderStatus;
  order_type: OrderType | null;
  ordered_at: string | null;
  placement_group_id: string | null;
  procurement_seen_at: string | null;
  informacja_queue_via_daily_panel: boolean | null;
};

async function captureIndividualOrderProcessSnapshots(
  orderIds: string[]
): Promise<IndividualOrderProcessSnapshot[]> {
  if (!orderIds.length) return [];
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("individual_orders")
    .select(
      "id, status, order_type, ordered_at, placement_group_id, procurement_seen_at, informacja_queue_via_daily_panel"
    )
    .in("id", orderIds);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: row.id,
    status: row.status as IndividualOrderStatus,
    order_type: row.order_type as OrderType | null,
    ordered_at: row.ordered_at,
    placement_group_id: row.placement_group_id,
    procurement_seen_at: row.procurement_seen_at ?? null,
    informacja_queue_via_daily_panel: row.informacja_queue_via_daily_panel ?? null,
  }));
}

async function rollbackIndividualOrderProcessSnapshots(
  snapshots: IndividualOrderProcessSnapshot[]
): Promise<void> {
  if (!snapshots.length) return;
  const supabase = createAdminClient();
  for (const s of snapshots) {
    const { error } = await supabase
      .from("individual_orders")
      .update({
        status: s.status,
        order_type: s.order_type,
        ordered_at: s.ordered_at,
        placement_group_id: s.placement_group_id,
        procurement_seen_at: s.procurement_seen_at,
        informacja_queue_via_daily_panel: s.informacja_queue_via_daily_panel,
      })
      .eq("id", s.id);
    if (error) throw new Error(error.message);
  }
}

async function assertGlowneSuppliersHaveInterval(supplierIds: Set<string>): Promise<void> {
  if (!supplierIds.size) return;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("suppliers")
    .select("name, interval_raw, interval_weeks")
    .in("id", [...supplierIds]);
  if (error) throw new Error(error.message);
  const missing = supplierNamesWithoutOrderInterval(data ?? []);
  if (missing.length) {
    throw new Error(formatGlowneMissingIntervalError(missing));
  }
}

export async function processIndividualFromSummary(
  orderIds: string[],
  action: "GLOWNE" | "POBOCZNE" | "ANULOWANO",
  userEmail: string,
  procurementCancelNote?: string | null
) {
  const supabase = createAdminClient();
  const { data: statusRows } = await supabase
    .from("individual_orders")
    .select(
      "id, request_kind, status, supplier_id, symbol, products, quantity, informacja_queue_via_daily_panel, informacja_stock_out_reorder"
    )
    .in("id", orderIds);

  const processableNowe = (statusRows ?? []).filter((r) => {
    if (r.status !== "Nowe") return false;
    const kind = r.request_kind ?? "zamowienie";
    if (kind === "zamowienie") return true;
    return (
      kind === "informacja" &&
      (r.informacja_queue_via_daily_panel === true ||
        r.informacja_stock_out_reorder === true)
    );
  });

  const incomplete = processableNowe.filter((r) => {
    const kind = (r.request_kind ?? "zamowienie") as IndividualRequestKind;
    const draft = {
      supplierId: r.supplier_id ?? undefined,
      symbol: r.symbol ?? undefined,
      product: r.products ?? undefined,
      quantity: r.quantity ?? undefined,
      requestKind: kind,
    };
    if (kind === "zamowienie") return !isProcurementDraftReady(draft);
    return assessRequestCompleteness({ ...draft, requestKind: "informacja" }) !== "complete";
  });
  if (incomplete.length && action !== "ANULOWANO") {
    const hasInformacja = incomplete.some(
      (r) => (r.request_kind ?? "zamowienie") === "informacja"
    );
    const fieldsHint = hasInformacja
      ? "dostawca i produkt"
      : "dostawca, produkt i ilość";
    throw new Error(
      incomplete.length === 1
        ? `Ta pozycja nie ma kompletnych danych (${fieldsHint}) — użyj edycji prośby lub uzupełnij w widoku Weryfikacja.`
        : `${incomplete.length} pozycji nie ma kompletnych danych (${fieldsHint}) — użyj edycji lub widoku Weryfikacja przed oznaczeniem jako Główne/Uzupełniające.`
    );
  }

  const allowedIds = new Set(processableNowe.map((r) => r.id));

  if (!allowedIds.size) {
    throw new Error(
      "Brak prośb do obsłużenia — wszystkie są już zamknięte lub nie kwalifikują się do Główne/Uzupełniające."
    );
  }

  const orderType: OrderType = action === "GLOWNE" ? "Glowne" : "Poboczne";
  const batchOrderedAt = new Date().toISOString();
  const placementGroupId = uuidv4();

  const ordersToProcess: IndividualOrder[] = [];
  for (const id of orderIds) {
    if (!allowedIds.has(id)) continue;
    const { data: raw } = await supabase
      .from("individual_orders")
      .select("*, supplier:suppliers(*), sales_person:sales_people(*)")
      .eq("id", id)
      .single();
    const order = raw ? normalizeIndividualOrder(raw) : null;
    if (order) ordersToProcess.push(order);
  }

  const glowneCandidateIds = glowneScheduleSupplierIds(ordersToProcess, action);
  let glowneSupplierIds = glowneCandidateIds;
  if (action === "GLOWNE" && glowneCandidateIds.size) {
    const { data: supplierRows, error: supplierError } = await supabase
      .from("suppliers")
      .select("id, order_on_demand, stock_raw, interval_raw, extra_info")
      .in("id", [...glowneCandidateIds]);
    if (supplierError) throw new Error(supplierError.message);
    glowneSupplierIds = glowneSchedulableSupplierIds(
      glowneCandidateIds,
      supplierRows ?? []
    );
  }
  if (action === "GLOWNE") {
    await assertGlowneSuppliersHaveInterval(glowneSupplierIds);
  }

  const processSnapshots = await captureIndividualOrderProcessSnapshots(
    ordersToProcess.map((o) => o.id)
  );

  const zdEtaSyncSalesPersonIds: string[] = [];

  const normalizedCancelNote =
    action === "ANULOWANO"
      ? normalizeProcurementCancelNote(procurementCancelNote)
      : null;

  for (const order of ordersToProcess) {
    const id = order.id;
    const seenPatch = { procurement_seen_at: batchOrderedAt };

    if (action === "ANULOWANO") {
      const { error: cancelErr } = await supabase
        .from("individual_orders")
        .update({
          ...buildProcurementCancelUpdate(normalizedCancelNote),
          ...seenPatch,
        })
        .eq("id", id);
      if (cancelErr) {
        throwIfProcurementCancelNoteColumnMissing(cancelErr);
        throw new Error(cancelErr.message);
      }
      continue;
    }

    if (
      order.request_kind === "informacja" &&
      order.informacja_queue_via_daily_panel
    ) {
      await supabase
        .from("individual_orders")
        .update({
          informacja_queue_via_daily_panel: false,
          order_type: orderType,
          ordered_at: batchOrderedAt,
          placement_group_id: placementGroupId,
          ...seenPatch,
        })
        .eq("id", id);
      continue;
    }

    await supabase
      .from("individual_orders")
      .update({
        status: "Zamowione",
        order_type: orderType,
        ordered_at: batchOrderedAt,
        placement_group_id: placementGroupId,
        ...seenPatch,
      })
      .eq("id", id);

    if (order.request_kind !== "informacja") {
      zdEtaSyncSalesPersonIds.push(order.sales_person_id);
    }
  }

  if (action !== "ANULOWANO" && zdEtaSyncSalesPersonIds.length) {
    const { scheduleZdEtaSyncAfterProcurement } = await import(
      "@/lib/subiekt/zd-eta-procurement-trigger"
    );
    await scheduleZdEtaSyncAfterProcurement(zdEtaSyncSalesPersonIds);
  }

  if (glowneSupplierIds.size) {
    try {
      for (const supplierId of glowneSupplierIds) {
        await markStandardOrdered(supplierId, userEmail);
      }
    } catch (e) {
      await rollbackIndividualOrderProcessSnapshots(processSnapshots);
      throw e;
    }
  }

  if (action === "ANULOWANO") {
    const cancelledIds = ordersToProcess.map((o) => o.id);
    if (cancelledIds.length) {
      scheduleHistoryRetentionPurge();
      await notifyProcurementCancelForOrders(cancelledIds);
    }
  }
}

export type ProcurementCancelEmailResult = {
  emailSent: number;
  emailError?: string;
};

/** Powiadomienia e-mail po anulowaniu prośby przez dział dostaw. */
export async function notifyProcurementCancelForOrders(
  orderIds: string[],
  opts?: { noteUpdated?: boolean }
): Promise<ProcurementCancelEmailResult> {
  const uniqueIds = [...new Set(orderIds)];
  if (!uniqueIds.length) {
    return { emailSent: 0 };
  }

  const supabase = createAdminClient();
  const personEmailCache = new Map<string, Awaited<ReturnType<typeof resolveSalesPersonEmail>>>();
  const notifications = new Map<string, SalesPersonEmailBatch>();
  const notifySkipped: string[] = [];
  let loaded = 0;

  for (const id of uniqueIds) {
    const { data: raw } = await supabase
      .from("individual_orders")
      .select("*, supplier:suppliers(*), sales_person:sales_people(*)")
      .eq("id", id)
      .single();
    const order = raw ? normalizeIndividualOrder(raw) : null;
    if (!order) continue;
    if (opts?.noteUpdated) {
      if (!canEditProcurementCancelNote(order)) continue;
    } else if (!isProcurementInitiatedCancel(order)) {
      continue;
    }
    loaded++;

    let person = personEmailCache.get(order.sales_person_id);
    if (person === undefined) {
      person = await resolveSalesPersonEmail(supabase, order);
      personEmailCache.set(order.sales_person_id, person);
    }

    if (person) {
      const item = buildProcurementCancelNotificationItem(order);
      const existing = notifications.get(person.personId);
      if (existing) {
        existing.items.push(item);
      } else {
        notifications.set(person.personId, {
          email: person.email,
          name: person.name,
          items: [item],
        });
      }
    } else if (order.sales_person_id) {
      notifySkipped.push(order.sales_person?.name?.trim() ?? "Handlowiec");
    }
  }

  let emailSent = 0;
  let emailError: string | undefined;
  if (notifications.size) {
    const mailResult = await sendProcurementCancelEmails(notifications, {
      noteUpdated: opts?.noteUpdated,
    });
    emailSent = mailResult.sent;
    if (mailResult.failures.length) {
      emailError = `${mailResult.failures[0].to}: ${mailResult.failures[0].error}`;
    }
  } else if (loaded > 0) {
    emailError = "Brak adresu e-mail handlowca — zapisano bez powiadomienia";
  }
  if (notifySkipped.length) {
    const skipNote =
      notifySkipped.length === 1
        ? `${notifySkipped[0]}: brak e-maila — zapisano bez powiadomienia`
        : `${notifySkipped.length} handlowców bez e-maila — zapisano bez powiadomienia`;
    emailError = emailError ? `${emailError}; ${skipNote}` : skipNote;
  }

  return { emailSent, emailError };
}

export async function markInformacjaArrived(
  orderIds: string[]
): Promise<{
  updated: number;
  skipped: number;
  requested: number;
  emailSent: number;
  emailError?: string;
}> {
  const uniqueIds = [...new Set(orderIds)];
  assertMaxBatchSize(uniqueIds.length, MAX_QUEUE_BATCH_SIZE, "pozycji informacyjnych");
  const supabase = createAdminClient();
  const personEmailCache = new Map<string, Awaited<ReturnType<typeof resolveSalesPersonEmail>>>();
  const notifications = new Map<string, SalesPersonEmailBatch>();
  const notifySkipped: string[] = [];
  let updated = 0;
  let skipped = 0;

  for (const id of uniqueIds) {
    const { data: raw } = await supabase
      .from("individual_orders")
      .select("*, supplier:suppliers(*), sales_person:sales_people(*)")
      .eq("id", id)
      .single();
    const order = raw ? normalizeIndividualOrder(raw) : null;
    if (!order || !isInformacjaWarehouseQueueOrder(order)) {
      skipped++;
      continue;
    }

    const shelfUpdate: Record<string, unknown> = {
      status: "Zrealizowane",
      delivered_quantity: INFORMACJA_NO_QUANTITY,
      delivery_at: new Date().toISOString(),
    };
    if (!order.warehouse_shelf?.trim()) {
      shelfUpdate.warehouse_shelf = WAREHOUSE_SHELF_DEFAULT;
    }
    await supabase.from("individual_orders").update(shelfUpdate).eq("id", id);
    updated++;

    let person = personEmailCache.get(order.sales_person_id);
    if (person === undefined) {
      person = await resolveSalesPersonEmail(supabase, order);
      personEmailCache.set(order.sales_person_id, person);
    }

    if (person) {
      const item = buildInformacjaNotificationItem(order);
      const existing = notifications.get(person.personId);
      if (existing) {
        existing.items.push(item);
      } else {
        notifications.set(person.personId, {
          email: person.email,
          name: person.name,
          items: [item],
        });
      }
    } else if (order.sales_person_id) {
      notifySkipped.push(order.sales_person?.name?.trim() ?? "Handlowiec");
    }
  }

  let emailSent = 0;
  let emailError: string | undefined;
  if (notifications.size) {
    const mailResult = await sendInformacjaArrivedEmails(notifications);
    emailSent = mailResult.sent;
    if (mailResult.failures.length) {
      emailError = `${mailResult.failures[0].to}: ${mailResult.failures[0].error}`;
    }
  } else if (updated > 0) {
    emailError = "Brak adresu e-mail handlowca — zapisano bez powiadomienia";
  }
  if (notifySkipped.length) {
    const skipNote =
      notifySkipped.length === 1
        ? `${notifySkipped[0]}: brak e-maila — zapisano bez powiadomienia`
        : `${notifySkipped.length} handlowców bez e-maila — zapisano bez powiadomienia`;
    emailError = emailError ? `${emailError}; ${skipNote}` : skipNote;
  }

  if (updated > 0) scheduleHistoryRetentionPurge();

  return { updated, skipped, requested: uniqueIds.length, emailSent, emailError };
}

export async function cancelIndividualOrder(
  orderId: string,
  procurementCancelNote?: string | null
): Promise<ProcurementCancelEmailResult> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("individual_orders")
    .update(buildProcurementCancelUpdate(procurementCancelNote))
    .eq("id", orderId)
    .in("status", ["Nowe", "Weryfikacja"])
    .is("sales_cancelled_at", null)
    .select("id");
  if (error) {
    throwIfProcurementCancelNoteColumnMissing(error);
    throw new Error(error.message);
  }
  if (!data?.length) {
    throw new Error(
      "Nie można anulować tej prośby — sprawdź status (tylko Nowe lub Weryfikacja, bez rezygnacji handlowca)."
    );
  }
  scheduleHistoryRetentionPurge();
  return notifyProcurementCancelForOrders([orderId]);
}

type DeliveryNotifyPayload = {
  personId: string;
  email: string;
  name: string;
  item: ReturnType<typeof buildDeliveryNotificationItem>;
};

type PersonEmailCache = Map<
  string,
  Awaited<ReturnType<typeof resolveSalesPersonEmail>>
>;

async function applyDeliveredQuantityUpdate(
  orderId: string,
  deliveredQuantity: string,
  opts?: { personEmailCache?: PersonEmailCache }
): Promise<{
  notify?: DeliveryNotifyPayload;
  statsUpdated: boolean;
  /** Zapis OK, ale brak adresu e-mail przy oczekiwanym powiadomieniu. */
  notifySkipped?: string;
}> {
  const qtyInput = deliveredQuantity.trim().slice(0, MAX_DELIVERED_QTY_LEN);
  const supabase = createAdminClient();
  const { data: raw } = await supabase
    .from("individual_orders")
    .select("*, supplier:suppliers(*), sales_person:sales_people(*)")
    .eq("id", orderId)
    .single();
  const order = raw ? normalizeIndividualOrder(raw) : null;
  if (!order) throw new Error("Nie znaleziono zamówienia");

  const ordered = parseInt(order.quantity, 10);
  const cancelled = effectiveSalesCancelledQuantity(order);
  const activeOrdered =
    !isNaN(ordered) && ordered > 0 ? Math.max(0, ordered - cancelled) : ordered;
  const delivered = parseInt(qtyInput, 10);
  const isCancelDispositionReceive =
    Boolean(order.sales_cancelled_at && order.procurement_cancel_disposition) &&
    cancelled > 0 &&
    (activeOrdered === 0 || isNaN(activeOrdered));

  if (isCancelDispositionReceive) {
    if (isNaN(delivered) || delivered < 0) {
      throw new Error("Podaj poprawną liczbę dostarczonych sztuk (0 lub więcej)");
    }
    if (delivered > cancelled) {
      throw new Error(`Nie można przyjąć więcej niż ${cancelled} szt. z rezygnacji`);
    }
  } else if (!isNaN(activeOrdered) && activeOrdered > 0) {
    if (isNaN(delivered) || delivered < 0) {
      throw new Error("Podaj poprawną liczbę dostarczonych sztuk (0 lub więcej)");
    }
    if (delivered > activeOrdered) {
      throw new Error(
        `Nie można dostarczyć więcej niż aktywne zamówienie (${activeOrdered} szt.)`
      );
    }
  }

  const prevStatus = order.status;
  const effectiveOrderedStr = isCancelDispositionReceive
    ? String(cancelled)
    : !isNaN(activeOrdered) && activeOrdered > 0
      ? String(activeOrdered)
      : order.quantity;
  const status = resolveStatusFromDeliveredQuantity(effectiveOrderedStr, qtyInput);
  const finalDelivered =
    status === "Zrealizowane" && isCancelDispositionReceive
      ? String(cancelled)
      : status === "Zrealizowane" && !isNaN(activeOrdered) && activeOrdered > 0
        ? String(activeOrdered)
        : status === "Zrealizowane" && !isNaN(ordered)
          ? String(ordered)
          : qtyInput;

  const update: Record<string, unknown> = {
    delivered_quantity: finalDelivered,
    status,
  };
  if (status === "Zrealizowane" || status === "Czesciowo_zrealizowane") {
    update.delivery_at = new Date().toISOString();
    if (!order.warehouse_shelf?.trim()) {
      update.warehouse_shelf = WAREHOUSE_SHELF_DEFAULT;
    }
  } else if (status === "Zamowione") {
    update.delivery_at = null;
  }

  await supabase.from("individual_orders").update(update).eq("id", orderId);

  if (shouldSyncZkWatchLineChecksAfterDeliveryChange(
    prevStatus,
    status,
    order.delivered_quantity,
    finalDelivered
  )) {
    try {
      const { syncZkWatchLineChecksFromOrder } = await import(
        "@/lib/sales/zk-watch-order-sync"
      );
      await syncZkWatchLineChecksFromOrder({
        ...order,
        status,
        delivered_quantity: finalDelivered,
      });
    } catch (e) {
      console.error("[syncZkWatchLineChecksFromOrder]", e);
    }
  }

  let statsUpdated = false;
  if (status === DELIVERY_STATS_COMPLETED_STATUS && prevStatus !== DELIVERY_STATS_COMPLETED_STATUS) {
    const deliveryAtIso = String(update.delivery_at ?? new Date().toISOString());
    statsUpdated = await tryIncrementDeliveryStatsFromOrder(order, deliveryAtIso);
  }

  const shouldNotify =
    !isInformacjaStockOutReorder(order) &&
    !order.sales_cancelled_at &&
    status !== "Zamowione" &&
    (status !== prevStatus || finalDelivered !== (order.delivered_quantity ?? ""));

  if (!shouldNotify) {
    return { statsUpdated };
  }

  let person = opts?.personEmailCache?.get(order.sales_person_id);
  if (person === undefined) {
    person = await resolveSalesPersonEmail(supabase, order);
    opts?.personEmailCache?.set(order.sales_person_id, person);
  }

  if (!person) {
    return {
      statsUpdated,
      notifySkipped: order.sales_person?.name?.trim() ?? "Handlowiec",
    };
  }

  const item = buildDeliveryNotificationItem(
    { ...order, status, delivered_quantity: finalDelivered },
    { deliveredQuantity: finalDelivered }
  );

  return {
    statsUpdated,
    notify: {
      personId: person.personId,
      email: person.email,
      name: person.name,
      item,
    },
  };
}

async function flushDeliveryNotifications(
  notifications: Map<string, SalesPersonEmailBatch>
): Promise<{ emailSent: number; emailError?: string }> {
  if (!notifications.size) {
    return { emailSent: 0 };
  }
  const mailResult = await sendDeliveryNotificationEmails(notifications);
  const emailError = mailResult.failures.length
    ? `${mailResult.failures[0].to}: ${mailResult.failures[0].error}`
    : undefined;
  return { emailSent: mailResult.sent, emailError };
}

export async function updateDeliveredQuantity(
  orderId: string,
  deliveredQuantity: string
): Promise<{ emailSent: boolean; emailError?: string }> {
  const result = await applyDeliveredQuantityUpdate(orderId, deliveredQuantity);
  if (result.statsUpdated) scheduleHistoryRetentionPurge();

  if (result.notifySkipped) {
    return {
      emailSent: false,
      emailError: `Brak e-maila handlowca (${result.notifySkipped}) — zapisano bez powiadomienia`,
    };
  }

  if (!result.notify) {
    return { emailSent: false };
  }

  const notifications = new Map<string, SalesPersonEmailBatch>([
    [
      result.notify.personId,
      {
        email: result.notify.email,
        name: result.notify.name,
        items: [result.notify.item],
      },
    ],
  ]);
  const { emailSent, emailError } = await flushDeliveryNotifications(notifications);
  return { emailSent: emailSent > 0, emailError };
}

export type BatchDeliveredUpdateResult = {
  saved: number;
  savedOrderIds: string[];
  emailSent: number;
  errors: string[];
  emailError?: string;
};

/** Zbiorczy zapis dostaw — jeden e-mail na handlowca z wieloma pozycjami. */
export async function batchUpdateDeliveredQuantities(
  updates: Array<{ orderId: string; deliveredQuantity: string }>
): Promise<BatchDeliveredUpdateResult> {
  if (!updates.length) {
    return { saved: 0, savedOrderIds: [], emailSent: 0, errors: ["Brak pozycji do zapisania."] };
  }

  const byOrderId = new Map<string, string>();
  for (const { orderId, deliveredQuantity } of updates) {
    byOrderId.set(orderId, deliveredQuantity);
  }
  const uniqueUpdates = [...byOrderId.entries()].map(([orderId, deliveredQuantity]) => ({
    orderId,
    deliveredQuantity,
  }));

  assertMaxBatchSize(uniqueUpdates.length, MAX_QUEUE_BATCH_SIZE, "pozycji dostaw");

  const notifications = new Map<string, SalesPersonEmailBatch>();
  const personEmailCache: PersonEmailCache = new Map();
  let saved = 0;
  const savedOrderIds: string[] = [];
  let statsTouches = 0;
  const errors: string[] = [];

  for (const { orderId, deliveredQuantity } of uniqueUpdates) {
    try {
      const result = await applyDeliveredQuantityUpdate(orderId, deliveredQuantity, {
        personEmailCache,
      });
      saved++;
      savedOrderIds.push(orderId);
      if (result.statsUpdated) statsTouches++;
      if (result.notify) {
        const existing = notifications.get(result.notify.personId);
        if (existing) {
          existing.items.push(result.notify.item);
        } else {
          notifications.set(result.notify.personId, {
            email: result.notify.email,
            name: result.notify.name,
            items: [result.notify.item],
          });
        }
      } else if (result.notifySkipped) {
        errors.push(
          `${result.notifySkipped}: brak e-maila — zapisano bez powiadomienia`
        );
      }
    } catch (e) {
      errors.push(e instanceof Error ? e.message : "Błąd zapisu pozycji");
    }
  }

  if (statsTouches > 0) scheduleHistoryRetentionPurge();

  const { emailSent, emailError } = await flushDeliveryNotifications(notifications);

  return { saved, savedOrderIds, emailSent, errors, emailError };
}

async function fetchSupplierCompletedOrdersForStats(
  supplierId: string,
  excludeOrderId?: string
): Promise<DeliveryStatsOrderInput[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("individual_orders")
    .select(
      "id, supplier_id, request_kind, status, ordered_at, action_at, delivery_at, order_type, products"
    )
    .eq("supplier_id", supplierId)
    .eq("request_kind", "zamowienie")
    .eq("status", DELIVERY_STATS_COMPLETED_STATUS);

  return ((data ?? []) as DeliveryStatsOrderInput[]).filter((row) => row.id !== excludeOrderId);
}

async function tryIncrementDeliveryStatsFromOrder(
  order: IndividualOrder,
  deliveryAtIso: string
): Promise<boolean> {
  if (order.request_kind !== "zamowienie") return false;
  if (!order.supplier_id || !order.supplier || order.order_type === "None") return false;

  const days = businessDaysForDeliveryStatsSample(
    {
      id: order.id,
      supplier_id: order.supplier_id,
      request_kind: order.request_kind,
      status: DELIVERY_STATS_COMPLETED_STATUS,
      ordered_at: order.ordered_at,
      action_at: order.action_at,
      delivery_at: deliveryAtIso,
      order_type: order.order_type,
      products: order.products,
    },
    deliveryAtIso
  );
  if (days == null) return false;

  const siblings = await fetchSupplierCompletedOrdersForStats(order.supplier_id, order.id);
  const candidate: DeliveryStatsOrderInput = {
    id: order.id,
    supplier_id: order.supplier_id,
    request_kind: order.request_kind,
    status: DELIVERY_STATS_COMPLETED_STATUS,
    ordered_at: order.ordered_at,
    action_at: order.action_at,
    delivery_at: deliveryAtIso,
    order_type: order.order_type,
    products: order.products,
  };
  if (hasSiblingDeliveryStatsSample(candidate, siblings)) return false;

  await updateSupplierStats(order.supplier_id, days, order.order_type);
  return true;
}

export async function updateSupplierStats(
  supplierId: string,
  deliveryDays: number,
  orderType: OrderType
) {
  const supabase = createAdminClient();
  const isMain = orderType === "Glowne";
  const { data: existing } = await supabase
    .from("delivery_stats")
    .select("*")
    .eq("supplier_id", supplierId)
    .maybeSingle();

  if (existing) {
    const sumCol = isMain ? "main_sum" : "side_sum";
    const countCol = isMain ? "main_count" : "side_count";
    const avgCol = isMain ? "main_avg" : "side_avg";
    const currentSum = Number(existing[sumCol as keyof typeof existing] ?? 0);
    const currentCount = Number(existing[countCol as keyof typeof existing] ?? 0);
    const newSum = currentSum + deliveryDays;
    const newCount = currentCount + 1;
    await supabase
      .from("delivery_stats")
      .update({
        [sumCol]: newSum,
        [countCol]: newCount,
        [avgCol]: Math.round(newSum / newCount),
        updated_at: new Date().toISOString(),
      })
      .eq("supplier_id", supplierId);
  } else {
    await supabase.from("delivery_stats").insert({
      supplier_id: supplierId,
      main_sum: isMain ? deliveryDays : null,
      main_count: isMain ? 1 : null,
      main_avg: isMain ? deliveryDays : null,
      side_sum: !isMain ? deliveryDays : null,
      side_count: !isMain ? 1 : null,
      side_avg: !isMain ? deliveryDays : null,
    });
  }
}

export type ProcessDeliveriesResult = {
  processed: number;
  emailSent: number;
  emailFailures: string[];
  skipped?: boolean;
  skipReason?: string;
};

const PROCESS_MARKED_DELIVERIES_LOCK = "process-marked-deliveries";
const PROCESS_MARKED_DELIVERIES_LOCK_TTL_SEC = 300;

export async function processMarkedDeliveries(options?: {
  lockedBy?: string;
}): Promise<ProcessDeliveriesResult> {
  const lockedBy = options?.lockedBy ?? "process-deliveries";
  const acquired = await tryAcquireLock(
    PROCESS_MARKED_DELIVERIES_LOCK,
    PROCESS_MARKED_DELIVERIES_LOCK_TTL_SEC,
    lockedBy
  );
  if (!acquired) {
    return {
      processed: 0,
      emailSent: 0,
      emailFailures: [],
      skipped: true,
      skipReason: "lock_held",
    };
  }

  try {
    return await processMarkedDeliveriesUnlocked();
  } finally {
    await releaseLock(PROCESS_MARKED_DELIVERIES_LOCK);
  }
}

async function processMarkedDeliveriesUnlocked(): Promise<ProcessDeliveriesResult> {
  const supabase = createAdminClient();
  const { data: queueRaw } = await supabase
    .from("individual_orders")
    .select("*, supplier:suppliers(*), sales_person:sales_people(*)")
    .eq("request_kind", "zamowienie")
    .eq("status", "Zamowione");
  const queue = normalizeIndividualOrders(queueRaw ?? []);

  const empty: ProcessDeliveriesResult = {
    processed: 0,
    emailSent: 0,
    emailFailures: [],
  };
  if (!queue?.length) return empty;

  const notifications = new Map<string, SalesPersonEmailBatch>();
  let processed = 0;

  for (const order of queue) {
    const deliveredQty = order.delivered_quantity;
    if (!deliveredQty || deliveredQty === "-") continue;

    const ordered = parseInt(order.quantity, 10);
    const delivered = parseInt(deliveredQty, 10);
    if (isNaN(delivered) || delivered <= 0) continue;

    const status = resolveStatusFromDeliveredQuantity(order.quantity, deliveredQty);
    if (status === "Zamowione") continue;

    const updatePayload: {
      status: typeof status;
      delivery_at: string;
      delivered_quantity: string;
      warehouse_shelf?: string;
    } = {
      status,
      delivery_at: new Date().toISOString(),
      delivered_quantity:
        status === "Zrealizowane" && !isNaN(ordered)
          ? String(ordered)
          : deliveredQty,
    };
    if (status === "Zrealizowane" || status === "Czesciowo_zrealizowane") {
      updatePayload.warehouse_shelf = WAREHOUSE_SHELF_DEFAULT;
    }

    const { error: updateError } = await supabase
      .from("individual_orders")
      .update(updatePayload)
      .eq("id", order.id)
      .eq("status", "Zamowione");

    if (updateError) {
      console.error("processMarkedDeliveries update", order.id, updateError.message);
      continue;
    }

    processed++;

    const finalQty =
      status === "Zrealizowane" && !isNaN(ordered) ? String(ordered) : deliveredQty;
    try {
      const { syncZkWatchLineChecksFromOrder } = await import(
        "@/lib/sales/zk-watch-order-sync"
      );
      await syncZkWatchLineChecksFromOrder({
        ...order,
        status,
        delivered_quantity: finalQty,
        delivery_at: updatePayload.delivery_at,
        warehouse_shelf: updatePayload.warehouse_shelf,
      });
    } catch (e) {
      console.error("[processMarkedDeliveries syncZkWatchLineChecks]", order.id, e);
    }

    if (status === DELIVERY_STATS_COMPLETED_STATUS) {
      try {
        await tryIncrementDeliveryStatsFromOrder(order, updatePayload.delivery_at);
      } catch (e) {
        console.error("[processMarkedDeliveries stats]", order.id, e);
      }
    }

    const person = await resolveSalesPersonEmail(supabase, order);
    if (person) {
      if (!notifications.has(person.personId)) {
        notifications.set(person.personId, {
          email: person.email,
          name: person.name,
          items: [],
        });
      }
      const item = buildDeliveryNotificationItem(
        { ...order, status, delivered_quantity: finalQty },
        { deliveredQuantity: finalQty }
      );
      notifications.get(person.personId)!.items.push(item);
    }
  }

  let emailSent = 0;
  const emailFailures: string[] = [];
  if (notifications.size) {
    const mailResult = await sendDeliveryNotificationEmails(notifications);
    emailSent = mailResult.sent;
    for (const f of mailResult.failures) {
      emailFailures.push(`${f.to}: ${f.error}`);
    }
  }

  if (processed > 0) scheduleHistoryRetentionPurge();

  return { processed, emailSent, emailFailures };
}

export async function recalculateAllStats() {
  const supabase = createAdminClient();
  await supabase.from("delivery_stats").delete().neq("supplier_id", "00000000-0000-0000-0000-000000000000");

  const { data: history } = await supabase
    .from("individual_orders")
    .select("*")
    .eq("request_kind", "zamowienie")
    .eq("status", DELIVERY_STATS_COMPLETED_STATUS)
    .order("delivery_at", { ascending: true })
    .order("id", { ascending: true });

  const { bySupplier } = aggregateDeliveryStatsFromOrders(history ?? []);

  for (const [supplierId, agg] of bySupplier) {
    await supabase.from("delivery_stats").insert(aggregatedToDeliveryStatsRow(supplierId, agg));
  }

  return bySupplier.size;
}

export { recalcSupplierSchedule };
