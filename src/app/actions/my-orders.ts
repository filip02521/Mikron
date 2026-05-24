"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { resolveSalesPersonForUser } from "@/lib/auth/sales-person";
import { isSalesAccount } from "@/lib/auth-roles";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  isSalesCancelNoticePending,
  resolveSalesCancelPhase,
} from "@/lib/orders/sales-cancel";
import { normalizeSalesClientName } from "@/lib/orders/sales-client-label";
import {
  buildSalesCancelUpdate,
  getSalesCancelDbCaps,
  SALES_CANCEL_MIGRATION_HINT,
  salesCancelAckSelect,
  salesCancelOrderSelect,
} from "@/lib/orders/sales-cancel-db";
import type { IndividualOrder, IndividualOrderStatus } from "@/types/database";
import { updateIndividualRequestGroup } from "@/lib/services/orders";
import type { IndividualRequestEditPayload } from "@/lib/orders/individual-request-edit";

async function salesPersonIdForAction(): Promise<string> {
  const user = await getSessionUser();
  if (!user) throw new Error("Wymagane logowanie");
  if (!isSalesAccount(user.role)) {
    throw new Error("Brak uprawnień do tej operacji.");
  }
  const resolved = await resolveSalesPersonForUser(user);
  if (!resolved) {
    throw new Error("Konto nie jest powiązane z kartą handlowca.");
  }
  return resolved.id;
}

type AckOptions = {
  allowedStatuses?: IndividualOrderStatus[];
  requireSalesCancelled?: boolean;
};

async function acknowledgeOrders(
  orderIds: string[],
  options: AckOptions = {}
) {
  if (!orderIds.length) throw new Error("Brak pozycji do potwierdzenia.");
  const salesPersonId = await salesPersonIdForAction();
  const supabase = createAdminClient();
  const caps = await getSalesCancelDbCaps(supabase);
  const now = new Date().toISOString();

  const { data: rowsRaw, error: fetchError } = await supabase
    .from("individual_orders")
    .select(salesCancelAckSelect(caps))
    .in("id", orderIds);

  if (fetchError) throw new Error(fetchError.message);
  const rows = (rowsRaw ?? []) as unknown as IndividualOrder[];
  if (!rows.length) throw new Error("Nie znaleziono pozycji.");

  for (const row of rows) {
    if (row.sales_person_id !== salesPersonId) {
      throw new Error("Brak uprawnień do tej pozycji.");
    }
    if (row.sales_acknowledged_at) {
      throw new Error("Pozycja została już potwierdzona.");
    }
    if (options.requireSalesCancelled) {
      if (!caps.hasCancelledAt) {
        throw new Error(SALES_CANCEL_MIGRATION_HINT);
      }
      if (!isSalesCancelNoticePending(row as IndividualOrder)) {
        throw new Error("Brak rezygnacji do ukrycia.");
      }
    } else if (options.allowedStatuses?.length) {
      if (!options.allowedStatuses.includes(row.status as IndividualOrderStatus)) {
        throw new Error("Ta pozycja nie wymaga już potwierdzenia.");
      }
    }
  }

  const { error } = await supabase
    .from("individual_orders")
    .update({ sales_acknowledged_at: now })
    .in("id", orderIds)
    .eq("sales_person_id", salesPersonId)
    .is("sales_acknowledged_at", null);

  if (error) throw new Error(error.message);

  revalidatePath("/moje");
  revalidatePath("/zespol");
  return { success: true, count: orderIds.length };
}

/** Przypisanie lub zmiana etykiety klienta końcowego (tylko handlowiec). */
export async function actionUpdateSalesClientName(
  orderId: string,
  clientName: string | null
) {
  const salesPersonId = await salesPersonIdForAction();
  const supabase = createAdminClient();
  const normalized = normalizeSalesClientName(clientName);

  const { data: row, error: fetchError } = await supabase
    .from("individual_orders")
    .select("id, sales_person_id")
    .eq("id", orderId)
    .maybeSingle();

  if (fetchError) throw new Error(fetchError.message);
  if (!row) throw new Error("Nie znaleziono pozycji.");
  if (row.sales_person_id !== salesPersonId) {
    throw new Error("Brak uprawnień do tej pozycji.");
  }

  const { error } = await supabase
    .from("individual_orders")
    .update({ sales_client_name: normalized })
    .eq("id", orderId)
    .eq("sales_person_id", salesPersonId);

  if (error) {
    if (error.message?.includes("sales_client_name")) {
      throw new Error(
        "Brak kolumny sales_client_name — uruchom migrację 017_sales_client_name.sql"
      );
    }
    throw new Error(error.message);
  }

  revalidatePath("/moje");
  return { success: true, clientName: normalized };
}

/** Ukrycie anulowanej prośby / dostawy. */
export async function actionAcknowledgeCancelled(orderIds: string[]) {
  return acknowledgeOrders(orderIds, { allowedStatuses: ["Anulowane"] });
}

/** Ukrycie informacji o rezygnacji (towar w drodze / na stanie). */
export async function actionAcknowledgeSalesCancelNotice(orderIds: string[]) {
  return acknowledgeOrders(orderIds, { requireSalesCancelled: true });
}

/** Wycofanie prośby przez handlowca (klient się rozmyślił). */
export async function actionSalesCancelOrders(orderIds: string[]) {
  if (!orderIds.length) throw new Error("Brak pozycji do anulowania.");
  const salesPersonId = await salesPersonIdForAction();
  const supabase = createAdminClient();
  const caps = await getSalesCancelDbCaps(supabase);
  const now = new Date().toISOString();

  const { data: rowsRaw, error: fetchError } = await supabase
    .from("individual_orders")
    .select(salesCancelOrderSelect(caps))
    .in("id", orderIds);

  if (fetchError) {
    if (fetchError.message?.includes("sales_cancelled_at")) {
      throw new Error(SALES_CANCEL_MIGRATION_HINT);
    }
    throw new Error(fetchError.message);
  }
  const rows = (rowsRaw ?? []) as unknown as IndividualOrder[];
  if (!rows.length) throw new Error("Nie znaleziono pozycji.");

  const toCancel: { id: string; phase: NonNullable<ReturnType<typeof resolveSalesCancelPhase>> }[] =
    [];

  for (const row of rows) {
    if (row.sales_person_id !== salesPersonId) {
      throw new Error("Brak uprawnień do tej pozycji.");
    }
    if (row.sales_acknowledged_at) {
      throw new Error("Ta pozycja jest już zamknięta.");
    }
    if (caps.hasCancelledAt && row.sales_cancelled_at) {
      continue;
    }

    const phase = resolveSalesCancelPhase(row as IndividualOrder);
    if (!phase) {
      throw new Error("Tej prośby nie można już wycofać.");
    }
    if (!caps.hasCancelledAt && phase !== "before_order") {
      throw new Error(SALES_CANCEL_MIGRATION_HINT);
    }
    toCancel.push({ id: row.id, phase });
  }

  if (!toCancel.length) {
    throw new Error("Wybrane pozycje są już wycofane lub zamknięte.");
  }

  for (const { id, phase } of toCancel) {
    const update = buildSalesCancelUpdate(caps, phase, now);
    if (!update) {
      throw new Error(SALES_CANCEL_MIGRATION_HINT);
    }

    let q = supabase
      .from("individual_orders")
      .update(update)
      .eq("id", id)
      .eq("sales_person_id", salesPersonId);

    if (caps.hasCancelledAt) {
      q = q.is("sales_cancelled_at", null);
    }

    const { error } = await q;

    if (error) {
      if (
        error.message?.includes("sales_cancelled_at") ||
        error.message?.includes("sales_cancel_phase")
      ) {
        throw new Error(SALES_CANCEL_MIGRATION_HINT);
      }
      throw new Error(error.message);
    }
  }

  revalidatePath("/moje");
  revalidatePath("/podsumowanie");
  revalidatePath("/kolejka");
  return {
    success: true,
    count: toCancel.length,
    phases: [...new Set(toCancel.map((t) => t.phase))],
  };
}

/** Potwierdzenie odbioru z magazynu (pojedyncza pozycja lub linia w grupie). */
export async function actionAcknowledgePickup(orderIds: string[]) {
  return acknowledgeOrders(orderIds, { allowedStatuses: ["Zrealizowane"] });
}

const UNDO_WINDOW_MS = 5_000;

/** Cofnięcie odbioru — tylko w ciągu kilku sekund po potwierdzeniu. */
export async function actionUnacknowledgePickup(orderIds: string[]) {
  if (!orderIds.length) throw new Error("Brak pozycji do cofnięcia.");
  const salesPersonId = await salesPersonIdForAction();
  const supabase = createAdminClient();
  const now = Date.now();

  const { data: rows, error: fetchError } = await supabase
    .from("individual_orders")
    .select("id, status, sales_person_id, sales_acknowledged_at")
    .in("id", orderIds);

  if (fetchError) throw new Error(fetchError.message);
  if (!rows?.length) throw new Error("Nie znaleziono pozycji.");

  for (const row of rows) {
    if (row.sales_person_id !== salesPersonId) {
      throw new Error("Brak uprawnień do tej pozycji.");
    }
    if (!row.sales_acknowledged_at) {
      throw new Error("Ta pozycja nie była jeszcze potwierdzona.");
    }
    if (row.status !== "Zrealizowane") {
      throw new Error("Cofnięcie dotyczy tylko potwierdzenia odbioru.");
    }
    const ackAt = new Date(row.sales_acknowledged_at).getTime();
    if (now - ackAt > UNDO_WINDOW_MS) {
      throw new Error("Minął czas na cofnięcie — odśwież listę.");
    }
  }

  const { error } = await supabase
    .from("individual_orders")
    .update({ sales_acknowledged_at: null })
    .in("id", orderIds)
    .eq("sales_person_id", salesPersonId)
    .eq("status", "Zrealizowane");

  if (error) throw new Error(error.message);

  revalidatePath("/moje");
  return { success: true, count: orderIds.length };
}

export async function actionUpdateMyIndividualRequest(
  orderIds: string[],
  payload: IndividualRequestEditPayload
) {
  const salesPersonId = await salesPersonIdForAction();
  const result = await updateIndividualRequestGroup(orderIds, payload, {
    salesPersonIdConstraint: salesPersonId,
  });
  revalidatePath("/moje");
  revalidatePath("/podsumowanie");
  revalidatePath("/prosba");
  return { success: true as const, ...result };
}
