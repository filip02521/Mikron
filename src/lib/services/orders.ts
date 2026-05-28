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
  toDateOnly,
} from "@/lib/orders/dates";
import { todayInWarsaw } from "@/lib/time/warsaw";
import { resolveStatusFromDeliveredQuantity } from "@/lib/orders/individual";
import { recalcScheduleRow } from "@/lib/orders/recalc";
import {
  resolveVacationConflictOnOrder,
  resolveVacationConflictOnShift,
  type VacationPeriod,
} from "@/lib/orders/vacations";
import { calculateBusinessDays } from "@/lib/orders/dates";
import { isMissingProduct, parseOrderQuantity } from "@/lib/orders/individual";
import type { IndividualOrderStatus, OrderType, SupplierLocation } from "@/types/database";
import { scheduleHistoryRetentionPurge } from "@/lib/services/history-cleanup";
import {
  sendDeliveryNotificationEmails,
  sendInformacjaArrivedEmails,
} from "@/lib/services/email";
import type { IndividualRequestKind } from "@/types/database";
import { INFORMACJA_NO_QUANTITY, quantityForRequestKind } from "@/lib/orders/individual";
import { orderPlacementAt } from "@/lib/orders/order-timing";
import { isProcurementDraftReady } from "@/lib/orders/procurement-readiness";
import { normalizeSalesClientName } from "@/lib/orders/sales-client-label";
import { WAREHOUSE_SHELF_DEFAULT } from "@/lib/orders/warehouse-inventory";
import type { SalesPersonEmailBatch } from "@/lib/email/sales-notification-types";
import {
  buildDeliveryNotificationItem,
  buildInformacjaNotificationItem,
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

async function getVacationsForSupplier(supplierId: string): Promise<VacationPeriod[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("vacations")
    .select("*")
    .eq("supplier_id", supplierId)
    .eq("active", true);
  const periods = (data ?? [])
    .map((v) => {
      const start = parseDateOnly(v.start_date);
      const end = parseDateOnly(v.end_date);
      const lastOrder = parseDateOnly(v.last_order_date);
      if (!start || !end || !lastOrder) return null;
      return { start, end, lastOrder };
    })
    .filter((p): p is VacationPeriod => p != null);
  periods.sort((a, b) => a.start.getTime() - b.start.getTime());
  return periods;
}

async function recalcSupplierSchedule(supplierId: string) {
  const supabase = createAdminClient();
  const { data: supplier } = await supabase
    .from("suppliers")
    .select("*, supplier_schedules(*)")
    .eq("id", supplierId)
    .single();
  if (!supplier) return;

  const schedule = Array.isArray(supplier.supplier_schedules)
    ? supplier.supplier_schedules[0]
    : supplier.supplier_schedules;

  const vacations = await getVacationsForSupplier(supplierId);
  const recalc = recalcScheduleRow({
    orderDate: parseDateOnly(schedule?.order_date ?? null),
    shiftDate: parseDateOnly(schedule?.shift_date ?? null),
    interval: resolveSupplierInterval(
      supplier.interval_raw as string | null,
      supplier.interval_weeks != null ? Number(supplier.interval_weeks) : null
    ),
    location: supplier.location as SupplierLocation,
    vacations,
  });

  await supabase.from("supplier_schedules").upsert(
    {
      supplier_id: supplierId,
      order_date: schedule?.order_date,
      shift_date: schedule?.shift_date,
      computed_next_date: dateToIso(recalc.computedNextDate),
      vacation_note: recalc.vacationNote,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "supplier_id" }
  );
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
  userEmail: string,
  applyVacationCorrection = true
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

  const today = snapToBusinessDay(todayInWarsaw());
  const baseNext = calculateNextOrderDate(today, interval);
  if (!baseNext) throw new Error("Nie można obliczyć daty");

  const vacations = await getVacationsForSupplier(supplierId);
  let finalDate = snapToBusinessDay(baseNext);
  if (applyVacationCorrection) {
    finalDate = snapToBusinessDay(resolveVacationConflictOnOrder(finalDate, vacations));
  }
  const vacationShift =
    applyVacationCorrection && finalDate.getTime() !== baseNext.getTime();

  const { data: schedule } = await supabase
    .from("supplier_schedules")
    .select("*")
    .eq("supplier_id", supplierId)
    .maybeSingle();

  await supabase.from("supplier_schedules").upsert(
    {
      supplier_id: supplierId,
      order_date: dateToIso(today),
      shift_date: vacationShift ? dateToIso(finalDate) : null,
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
  const historyDate =
    parseDateOnly(updatedSchedule?.computed_next_date ?? null) ?? finalDate;
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

  const vacations = await getVacationsForSupplier(supplierId);
  newShift = snapToBusinessDay(
    resolveVacationConflictOnShift(
      newShift,
      supplier.location as SupplierLocation,
      vacations,
      schedule?.vacation_note ?? null
    )
  );

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
  await logNormalHistory(
    supplierId,
    manualDate ? "Ręcznie przesunięte" : `Przesunięte o ${weeks} tyg.`,
    newShift,
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
    subiektTwId?: number | null;
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
        if ((data ?? []).length === 1) return Number((data as any)[0].subiekt_tw_id) || null;
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
        if ((data ?? []).length === 1) return Number((data as any)[0].subiekt_tw_id) || null;
      }

      return null;
    };

    const rows = await Promise.all(entries.map(async (e) => {
      const kind = (e.requestKind ?? "zamowienie") as IndividualRequestKind;
      const sanitized = sanitizeOrderDraftFields({
        symbol: e.symbol,
        mikranCode: e.mikranCode,
        product: e.product,
        quantity: e.quantity,
      });
      const draft = {
        supplierId: e.supplierId,
        symbol: sanitized.symbol,
        mikranCode: sanitized.mikranCode,
        product: sanitized.product,
        quantity: sanitized.quantity,
        requestKind: kind,
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
        quantity: quantityForRequestKind(e.requestKind, sanitized.quantity),
        status,
        order_type: "None" as OrderType,
        request_kind: (e.requestKind ?? "zamowienie") as IndividualRequestKind,
        submission_group_id: submissionGroupId,
        created_by: createdBy ?? null,
        sales_client_name: normalizeSalesClientName(e.clientName),
        subiekt_tw_id:
          draft.subiektTwId != null && draft.subiektTwId > 0 ? draft.subiektTwId : null,
        mikran_code: sanitized.mikranCode?.trim() || null,
      };
    }));
    const { error } = await supabase.from("individual_orders").insert(rows);
    if (error) {
      const msg = formatDbError(error);
      if (msg.includes("mikran_code")) {
        throw new Error(
          `${msg} — uruchom migrację supabase/migrations/031_mikran_code.sql w bazie.`
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
  }
) {
  const kind = (data.requestKind ?? "zamowienie") as IndividualRequestKind;
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
  const supabase = createAdminClient();
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
  }
): Promise<{ updated: number; inserted: number; removed: number }> {
  if (!orderIds.length) throw new Error("Brak pozycji do edycji.");
  if (!payload.lines.length) throw new Error("Dodaj co najmniej jedną pozycję.");
  assertMaxBatchSize(payload.lines.length, MAX_REQUEST_EDIT_LINES, "pozycji w prośbie");

  const supabase = createAdminClient();
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
  const keptIds = new Set<string>();
  let updated = 0;
  let inserted = 0;
  // Stare podejście (dopasowanie dostawcy z ZD) zostało wycofane.

  for (const line of payload.lines) {
    const kind = payload.requestKind;
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
    const supplierResolvePending = false;
    const rowPayload = {
      supplier_id: payload.supplierId.trim() || null,
      sales_person_id: payload.salesPersonId,
      symbol,
      products,
      quantity: quantityForRequestKind(kind, sanitized.quantity),
      request_kind: kind,
      status,
      sales_client_name: normalizeSalesClientName(line.clientName),
      subiekt_tw_id:
        line.subiektTwId != null && line.subiektTwId > 0 ? line.subiektTwId : null,
      mikran_code: sanitized.mikranCode?.trim() || null,
    };

    if (line.id) {
      if (!existing.some((o) => o.id === line.id)) {
        throw new Error("Pozycja nie należy do tej prośby.");
      }
      const { error } = await supabase
        .from("individual_orders")
        .update(rowPayload)
        .eq("id", line.id)
        .in("status", ["Nowe", "Weryfikacja"]);
      if (error) throw new Error(error.message);
      keptIds.add(line.id);
      updated++;

      try {
        await indexOrderLineToProductCatalog({
          orderId: line.id,
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

export async function processIndividualFromSummary(
  orderIds: string[],
  action: "GLOWNE" | "POBOCZNE" | "ANULOWANO",
  userEmail: string
) {
  const supabase = createAdminClient();
  const { data: statusRows } = await supabase
    .from("individual_orders")
    .select("id, request_kind, status, supplier_id, symbol, products, quantity")
    .in("id", orderIds);

  const zamowienieNowe = (statusRows ?? []).filter(
    (r) => (r.request_kind ?? "zamowienie") === "zamowienie" && r.status === "Nowe"
  );

  const incomplete = zamowienieNowe.filter(
    (r) =>
      !isProcurementDraftReady({
        supplierId: r.supplier_id ?? undefined,
        symbol: r.symbol ?? undefined,
        product: r.products ?? undefined,
        quantity: r.quantity ?? undefined,
        requestKind: (r.request_kind ?? "zamowienie") as "zamowienie" | "informacja",
      })
  );
  if (incomplete.length && action !== "ANULOWANO") {
    throw new Error(
      incomplete.length === 1
        ? "Ta pozycja nie ma kompletnych danych (dostawca, produkt, ilość) — użyj edycji prośby lub uzupełnij w widoku Weryfikacja."
        : `${incomplete.length} pozycji nie ma kompletnych danych — użyj edycji lub widoku Weryfikacja przed oznaczeniem jako Główne/Uzupełniające.`
    );
  }

  const allowedIds = new Set(zamowienieNowe.map((r) => r.id));

  if (!allowedIds.size) {
    throw new Error(
      "Brak prośb do obsłużenia — wszystkie są już zamknięte lub to nie jest zamówienie."
    );
  }

  const orderType: OrderType = action === "GLOWNE" ? "Glowne" : "Poboczne";
  const batchOrderedAt = new Date().toISOString();
  const placementGroupId = uuidv4();
  const glowneSupplierIds = new Set<string>();

  for (const id of orderIds) {
    if (!allowedIds.has(id)) continue;
    const { data: raw } = await supabase
      .from("individual_orders")
      .select("*, supplier:suppliers(*), sales_person:sales_people(*)")
      .eq("id", id)
      .single();
    const order = raw ? normalizeIndividualOrder(raw) : null;
    if (!order) continue;

    if (action === "ANULOWANO") {
      await supabase
        .from("individual_orders")
        .update({ status: "Anulowane" })
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
      })
      .eq("id", id);

    if (action === "GLOWNE" && order.supplier_id) {
      glowneSupplierIds.add(order.supplier_id);
    }
  }

  for (const supplierId of glowneSupplierIds) {
    await markStandardOrdered(supplierId, userEmail, true);
  }
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
    if (!order || order.request_kind !== "informacja" || order.status !== "Nowe") {
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

export async function cancelIndividualOrder(orderId: string) {
  const supabase = createAdminClient();
  await supabase
    .from("individual_orders")
    .update({ status: "Anulowane" })
    .eq("id", orderId);
  scheduleHistoryRetentionPurge();
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
  const delivered = parseInt(qtyInput, 10);
  if (!isNaN(ordered) && ordered > 0) {
    if (isNaN(delivered) || delivered < 0) {
      throw new Error("Podaj poprawną liczbę dostarczonych sztuk (0 lub więcej)");
    }
    if (delivered > ordered) {
      throw new Error(`Nie można dostarczyć więcej niż zamówiono (${ordered} szt.)`);
    }
  }

  const prevStatus = order.status;
  const status = resolveStatusFromDeliveredQuantity(order.quantity, qtyInput);
  const finalDelivered =
    status === "Zrealizowane" && !isNaN(ordered) ? String(ordered) : qtyInput;

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

  let statsUpdated = false;
  if (status === "Zrealizowane" && prevStatus !== "Zrealizowane") {
    statsUpdated = true;
    const placement = orderPlacementAt(order);
    const orderDate = placement ? parseDateOnly(placement) : null;
    const skipStats = isMissingProduct(order.products);
    if (
      orderDate &&
      !skipStats &&
      order.supplier_id &&
      order.supplier &&
      order.order_type !== "None"
    ) {
      const days = calculateBusinessDays(orderDate, toDateOnly(new Date()));
      if (days >= 0) {
        await updateSupplierStats(order.supplier_id, days, order.order_type);
      }
    }
  }

  const shouldNotify =
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
};

export async function processMarkedDeliveries(): Promise<ProcessDeliveriesResult> {
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

  const processedGroups = new Set<string>();
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

    const placement = orderPlacementAt(order);
    const orderDate = placement ? parseDateOnly(placement) : null;
    const groupKey = `${order.supplier_id}|${orderDate?.toISOString().slice(0, 10)}`;
    const skipStats = isMissingProduct(order.products);

    if (
      !skipStats &&
      !processedGroups.has(groupKey) &&
      orderDate &&
      order.supplier_id &&
      order.supplier
    ) {
      const deliveryDate = toDateOnly(new Date());
      const days = calculateBusinessDays(orderDate, deliveryDate);
      if (days >= 0 && order.order_type !== "None") {
        await updateSupplierStats(order.supplier_id, days, order.order_type);
        processedGroups.add(groupKey);
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
      const finalQty =
        status === "Zrealizowane" && !isNaN(ordered) ? String(ordered) : deliveredQty;
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
    .in("status", ["Zrealizowane", "Czesciowo_zrealizowane"]);

  const processed = new Set<string>();
  const stats: Record<string, { Glowne: { sum: number; count: number }; Poboczne: { sum: number; count: number } }> = {};

  for (const row of history ?? []) {
    if (row.request_kind === "informacja") continue;
    if (isMissingProduct(row.products)) continue;

    const placement = orderPlacementAt({
      ordered_at: row.ordered_at,
      action_at: row.action_at,
      status: row.status,
    });
    const orderDate = placement ? parseDateOnly(placement) : null;
    const deliveryDate = parseDateOnly(row.delivery_at);
    if (!orderDate || !deliveryDate) continue;
    const key = `${row.supplier_id}|${orderDate.toISOString().slice(0, 10)}`;
    if (processed.has(key)) continue;
    const days = calculateBusinessDays(orderDate, deliveryDate);
    if (days < 0) continue;
    processed.add(key);
    if (!stats[row.supplier_id]) {
      stats[row.supplier_id] = {
        Glowne: { sum: 0, count: 0 },
        Poboczne: { sum: 0, count: 0 },
      };
    }
    const type = row.order_type === "Glowne" ? "Glowne" : "Poboczne";
    stats[row.supplier_id][type].sum += days;
    stats[row.supplier_id][type].count += 1;
  }

  for (const [supplierId, s] of Object.entries(stats)) {
    await supabase.from("delivery_stats").insert({
      supplier_id: supplierId,
      main_sum: s.Glowne.count ? s.Glowne.sum : null,
      main_count: s.Glowne.count || null,
      main_avg: s.Glowne.count ? Math.round(s.Glowne.sum / s.Glowne.count) : null,
      side_sum: s.Poboczne.count ? s.Poboczne.sum : null,
      side_count: s.Poboczne.count || null,
      side_avg: s.Poboczne.count ? Math.round(s.Poboczne.sum / s.Poboczne.count) : null,
    });
  }

  return Object.keys(stats).length;
}

export { recalcSupplierSchedule };
