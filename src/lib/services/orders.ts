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
import {
  sendDeliveryNotificationEmails,
  sendInformacjaArrivedEmails,
} from "@/lib/services/email";
import type { IndividualRequestKind } from "@/types/database";
import { INFORMACJA_NO_QUANTITY, quantityForRequestKind } from "@/lib/orders/individual";
import { orderPlacementAt } from "@/lib/orders/order-timing";
import { isProcurementDraftReady } from "@/lib/orders/procurement-readiness";
import {
  formatDeliveryEmailLine,
  formatInformacjaEmailLine,
  normalizeSalesClientName,
} from "@/lib/orders/sales-client-label";
import {
  assessRequestCompleteness,
  hasAnyProductHint,
  hasValidOrderQuantity,
  normalizeDraftProducts,
} from "@/lib/orders/request-completeness";
import {
  canEditIndividualRequestGroup,
  type IndividualRequestEditPayload,
} from "@/lib/orders/individual-request-edit";
import { v4 as uuidv4 } from "uuid";

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
    product?: string;
    quantity?: string;
    requestKind?: IndividualRequestKind;
    clientName?: string;
  }>,
  createdBy?: string
): Promise<{ count: number; complete: number; verification: number }> {
  const { tryAcquireLock, releaseLock } = await import("@/lib/services/locks");
  const ok = await tryAcquireLock("BATCH_INDIVIDUAL", 10);
  if (!ok) throw new Error("Trwa inna operacja dodawania zamówień");

  const supabase = createAdminClient();
  const submissionGroupId = uuidv4();
  try {
    let complete = 0;
    let verification = 0;
    const rows = entries.map((e) => {
      const kind = (e.requestKind ?? "zamowienie") as IndividualRequestKind;
      const draft = {
        supplierId: e.supplierId,
        symbol: e.symbol,
        product: e.product,
        quantity: e.quantity,
        requestKind: kind,
      };
      if (!hasAnyProductHint(draft)) {
        throw new Error("Podaj symbol lub opis produktu.");
      }
      if (kind === "zamowienie" && !hasValidOrderQuantity(e.quantity, kind)) {
        throw new Error("Podaj ilość (liczba sztuk, np. 1).");
      }
      const assessment = assessRequestCompleteness(draft);
      const { products, symbol } = normalizeDraftProducts(draft);
      const status: IndividualOrderStatus =
        assessment === "complete" ? "Nowe" : "Weryfikacja";
      if (status === "Nowe") complete++;
      else verification++;

      return {
        id: uuidv4(),
        supplier_id: e.supplierId?.trim() || null,
        sales_person_id: e.salesPersonId,
        symbol,
        products,
        quantity: quantityForRequestKind(e.requestKind, e.quantity),
        status,
        order_type: "None" as OrderType,
        request_kind: (e.requestKind ?? "zamowienie") as IndividualRequestKind,
        submission_group_id: submissionGroupId,
        created_by: createdBy ?? null,
        sales_client_name: normalizeSalesClientName(e.clientName),
      };
    });
    const { error } = await supabase.from("individual_orders").insert(rows);
    if (error) throw new Error(formatDbError(error));
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
    product: string;
    quantity?: string;
    requestKind?: IndividualRequestKind;
  }
) {
  const kind = (data.requestKind ?? "zamowienie") as IndividualRequestKind;
  const assessment = assessRequestCompleteness({
    supplierId: data.supplierId,
    symbol: data.symbol,
    product: data.product,
    quantity: data.quantity,
    requestKind: kind,
  });
  if (assessment !== "complete") {
    throw new Error(
      kind === "zamowienie"
        ? "Uzupełnij dostawcę, opis produktu i ilość (np. 1), aby zatwierdzić."
        : "Uzupełnij dostawcę oraz opis produktu, aby zatwierdzić."
    );
  }

  const { products, symbol } = normalizeDraftProducts(data);
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("individual_orders")
    .update({
      supplier_id: data.supplierId,
      sales_person_id: data.salesPersonId,
      symbol,
      products,
      quantity: quantityForRequestKind(data.requestKind, data.quantity),
      request_kind: (data.requestKind ?? "zamowienie") as IndividualRequestKind,
      status: "Nowe",
    })
    .eq("id", orderId)
    .eq("status", "Weryfikacja");

  if (error) throw new Error(error.message);
}

function statusForEditedLine(
  draft: {
    supplierId: string;
    symbol?: string;
    product?: string;
    quantity?: string;
    requestKind: IndividualRequestKind;
  }
): IndividualOrderStatus {
  return assessRequestCompleteness(draft) === "complete" ? "Nowe" : "Weryfikacja";
}

export async function updateIndividualRequestGroup(
  orderIds: string[],
  payload: IndividualRequestEditPayload,
  options: {
    salesPersonIdConstraint?: string;
  }
): Promise<{ updated: number; inserted: number; removed: number }> {
  if (!orderIds.length) throw new Error("Brak pozycji do edycji.");
  if (!payload.lines.length) throw new Error("Dodaj co najmniej jedną pozycję.");

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

  const submissionGroupId =
    existing[0]?.submission_group_id ?? uuidv4();
  const keptIds = new Set<string>();
  let updated = 0;
  let inserted = 0;

  for (const line of payload.lines) {
    const kind = payload.requestKind;
    const draft = {
      supplierId: payload.supplierId,
      symbol: line.symbol,
      product: line.product,
      quantity: line.quantity,
      requestKind: kind,
    };
    if (!hasAnyProductHint(draft)) {
      throw new Error("Podaj symbol lub opis produktu w każdej pozycji.");
    }
    if (kind === "zamowienie" && !hasValidOrderQuantity(line.quantity, kind)) {
      throw new Error("Podaj ilość (liczba sztuk, np. 1) w każdej pozycji zamówienia.");
    }

    const { products, symbol } = normalizeDraftProducts(draft);
    const status = statusForEditedLine(draft);
    const rowPayload = {
      supplier_id: payload.supplierId.trim() || null,
      sales_person_id: payload.salesPersonId,
      symbol,
      products,
      quantity: quantityForRequestKind(kind, line.quantity),
      request_kind: kind,
      status,
      sales_client_name: normalizeSalesClientName(line.clientName),
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
    } else {
      const { error } = await supabase.from("individual_orders").insert({
        id: uuidv4(),
        ...rowPayload,
        order_type: "None" as OrderType,
        submission_group_id: submissionGroupId,
      });
      if (error) throw new Error(formatDbError(error));
      inserted++;
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
        ? "Uzupełnij dostawcę, produkt i ilość w zakładce Weryfikacja — bez tego nie można złożyć zamówienia u dostawcy."
        : `${incomplete.length} pozycje wymagają uzupełnienia w Weryfikacji (dostawca, produkt, ilość) — nie można ich jeszcze oznaczyć jako Główne/Uzupełniające.`
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
): Promise<{ updated: number; emailSent: number; emailError?: string }> {
  const supabase = createAdminClient();
  const notifications = new Map<
    string,
    { email: string; name: string; lines: string[] }
  >();
  let updated = 0;

  for (const id of orderIds) {
    const { data: raw } = await supabase
      .from("individual_orders")
      .select("*, supplier:suppliers(*), sales_person:sales_people(*)")
      .eq("id", id)
      .single();
    const order = raw ? normalizeIndividualOrder(raw) : null;
    if (!order || order.request_kind !== "informacja" || order.status !== "Nowe") {
      continue;
    }

    await supabase
      .from("individual_orders")
      .update({
        status: "Zrealizowane",
        delivered_quantity: INFORMACJA_NO_QUANTITY,
        delivery_at: new Date().toISOString(),
      })
      .eq("id", id);
    updated++;

    let personEmail = order.sales_person?.email?.trim();
    let personName = order.sales_person?.name?.trim() ?? "Handlowiec";
    const personId = order.sales_person_id;

    if (!personEmail && personId) {
      const { data: sp } = await supabase
        .from("sales_people")
        .select("email, name")
        .eq("id", personId)
        .maybeSingle();
      personEmail = sp?.email?.trim();
      if (sp?.name) personName = sp.name;
    }

    if (personEmail) {
      const line = formatInformacjaEmailLine(order);
      const existing = notifications.get(personId);
      if (existing) {
        existing.lines.push(line);
      } else {
        notifications.set(personId, {
          email: personEmail,
          name: personName,
          lines: [line],
        });
      }
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

  return { updated, emailSent, emailError };
}

export async function cancelIndividualOrder(orderId: string) {
  const supabase = createAdminClient();
  await supabase
    .from("individual_orders")
    .update({ status: "Anulowane" })
    .eq("id", orderId);
}

export async function updateDeliveredQuantity(
  orderId: string,
  deliveredQuantity: string
): Promise<{ emailSent: boolean; emailError?: string }> {
  const supabase = createAdminClient();
  const { data: raw } = await supabase
    .from("individual_orders")
    .select("*, supplier:suppliers(*), sales_person:sales_people(*)")
    .eq("id", orderId)
    .single();
  const order = raw ? normalizeIndividualOrder(raw) : null;
  if (!order) throw new Error("Nie znaleziono zamówienia");

  const ordered = parseInt(order.quantity, 10);
  const delivered = parseInt(deliveredQuantity, 10);
  if (!isNaN(ordered) && ordered > 0) {
    if (isNaN(delivered) || delivered < 0) {
      throw new Error("Podaj poprawną liczbę dostarczonych sztuk (0 lub więcej)");
    }
    if (delivered > ordered) {
      throw new Error(`Nie można dostarczyć więcej niż zamówiono (${ordered} szt.)`);
    }
  }

  const prevStatus = order.status;
  const status = resolveStatusFromDeliveredQuantity(
    order.quantity,
    deliveredQuantity
  );
  const finalDelivered =
    status === "Zrealizowane" && !isNaN(ordered) ? String(ordered) : deliveredQuantity;

  const update: Record<string, unknown> = {
    delivered_quantity: finalDelivered,
    status,
  };
  if (status === "Zrealizowane" || status === "Czesciowo_zrealizowane") {
    update.delivery_at = new Date().toISOString();
  } else if (status === "Zamowione") {
    update.delivery_at = null;
  }

  await supabase.from("individual_orders").update(update).eq("id", orderId);

  if (status === "Zrealizowane" && prevStatus !== "Zrealizowane") {
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

  let emailSent = false;
  let emailError: string | undefined;

  const shouldNotify =
    !order.sales_cancelled_at &&
    status !== "Zamowione" &&
    (status !== prevStatus || finalDelivered !== (order.delivered_quantity ?? ""));

  if (shouldNotify) {
    let personEmail = order.sales_person?.email?.trim();
    let personName = order.sales_person?.name?.trim() ?? "Handlowiec";
    const personId = order.sales_person_id;

    if (!personEmail && personId) {
      const { data: sp } = await supabase
        .from("sales_people")
        .select("email, name")
        .eq("id", personId)
        .maybeSingle();
      personEmail = sp?.email?.trim();
      if (sp?.name) personName = sp.name;
    }

    if (!personEmail) {
      emailError = "Brak adresu e-mail handlowca w bazie (Admin → Handlowcy)";
    } else {
      const label =
        status === "Czesciowo_zrealizowane"
          ? `Częściowo (${finalDelivered}/${order.quantity}) — brakuje jeszcze ${Math.max(0, (parseOrderQuantity(order.quantity) ?? 0) - parseInt(finalDelivered, 10))} szt.`
          : "Dostarczone w całości — możesz odebrać z magazynu";
      const mailResult = await sendDeliveryNotificationEmails(
        new Map([
          [
            personId,
            {
              email: personEmail,
              name: personName,
              lines: [formatDeliveryEmailLine(order, label)],
            },
          ],
        ])
      );
      if (mailResult.sent > 0) {
        emailSent = true;
      } else if (mailResult.failures.length) {
        emailError = `${mailResult.failures[0].to}: ${mailResult.failures[0].error}`;
      }
    }
  }

  return { emailSent, emailError };
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
  const notifications = new Map<
    string,
    { email: string; name: string; lines: string[] }
  >();
  let processed = 0;

  for (const order of queue) {
    const deliveredQty = order.delivered_quantity;
    if (!deliveredQty || deliveredQty === "-") continue;

    const ordered = parseInt(order.quantity, 10);
    const delivered = parseInt(deliveredQty, 10);
    if (isNaN(delivered) || delivered <= 0) continue;

    const status = resolveStatusFromDeliveredQuantity(order.quantity, deliveredQty);
    if (status === "Zamowione") continue;

    const { error: updateError } = await supabase
      .from("individual_orders")
      .update({
        status,
        delivery_at: new Date().toISOString(),
        delivered_quantity:
          status === "Zrealizowane" && !isNaN(ordered)
            ? String(ordered)
            : deliveredQty,
      })
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

    const person = order.sales_person;
    if (person?.email) {
      const key = person.id;
      if (!notifications.has(key)) {
        notifications.set(key, {
          email: person.email,
          name: person.name,
          lines: [],
        });
      }
      const label =
        status === "Czesciowo_zrealizowane"
          ? `Częściowo (${deliveredQty}/${order.quantity})`
          : "Dostarczone";
      notifications.get(key)!.lines.push(formatDeliveryEmailLine(order, label));
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
