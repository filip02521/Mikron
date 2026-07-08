import type { SupabaseClient } from "@supabase/supabase-js";
import {
  hasSalesCancelPhaseColumn,
  hasSalesCancelledAtColumn,
  hasSalesCancelledQuantityColumn,
} from "@/lib/supabase/schema-check";
import type { SalesCancelQuantityPlan } from "@/lib/orders/sales-cancel";
import type { SalesCancelPhase } from "@/lib/orders/sales-cancel";
import type { IndividualOrder, IndividualOrderStatus } from "@/types/database";

export type SalesCancelDbCaps = {
  hasCancelledAt: boolean;
  hasCancelPhase: boolean;
  hasCancelledQuantity: boolean;
};

export async function getSalesCancelDbCaps(
  supabase: SupabaseClient
): Promise<SalesCancelDbCaps> {
  const [hasCancelledAt, hasCancelPhase, hasCancelledQuantity] = await Promise.all([
    hasSalesCancelledAtColumn(supabase),
    hasSalesCancelPhaseColumn(supabase),
    hasSalesCancelledQuantityColumn(supabase),
  ]);
  return { hasCancelledAt, hasCancelPhase, hasCancelledQuantity };
}

export const SALES_CANCEL_MIGRATION_HINT =
  "Brak kolumn rezygnacji w bazie. W Supabase uruchom migrację: supabase/migrations/018_sales_cancel_bundle.sql (SQL Editor lub wtyczka Supabase).";

export const SALES_CANCEL_QUANTITY_MIGRATION_HINT =
  "Brak kolumny sales_cancelled_quantity. W Supabase uruchom migrację: supabase/migrations/059_individual_orders_sales_cancelled_quantity.sql";

/** Pola SELECT dla akcji anulowania — bez kolumn, których jeszcze nie ma w DB. */
export function salesCancelOrderSelect(caps: SalesCancelDbCaps): string {
  const base =
    "id, status, sales_person_id, sales_acknowledged_at, quantity, delivered_quantity, request_kind";
  if (!caps.hasCancelledAt) return base;
  const withCancel = caps.hasCancelPhase
    ? `${base}, sales_cancelled_at, sales_cancel_phase`
    : `${base}, sales_cancelled_at`;
  if (!caps.hasCancelledQuantity) return withCancel;
  return `${withCancel}, sales_cancelled_quantity`;
}

export function salesCancelAckSelect(caps: SalesCancelDbCaps): string {
  const base = "id, status, sales_person_id, sales_acknowledged_at, quantity, delivered_quantity";
  if (!caps.hasCancelledAt) return base;
  const withCancel = caps.hasCancelPhase
    ? `${base}, sales_cancelled_at, sales_cancel_phase`
    : `${base}, sales_cancelled_at`;
  if (!caps.hasCancelledQuantity) return withCancel;
  return `${withCancel}, sales_cancelled_quantity`;
}

export function buildSalesCancelUpdate(
  caps: SalesCancelDbCaps,
  phase: SalesCancelPhase,
  now: string,
  quantityPlan?: Pick<
    SalesCancelQuantityPlan,
    "storedCancelledQuantity" | "statusAfter" | "keepLineActiveForSales"
  >
): Record<string, unknown> | null {
  if (!caps.hasCancelledAt) {
    if (phase === "before_order") {
      return { status: "Anulowane", sales_acknowledged_at: now };
    }
    return null;
  }

  const keepActive = quantityPlan?.keepLineActiveForSales === true;

  const update: Record<string, unknown> = {
    sales_cancelled_at: now,
  };
  if (!keepActive) {
    /** Pełna rezygnacja — od razu do archiwum u handlowca. */
    update.sales_acknowledged_at = now;
  }
  if (caps.hasCancelPhase) {
    update.sales_cancel_phase = phase;
  }
  if (quantityPlan?.statusAfter) {
    update.status = quantityPlan.statusAfter;
  } else if (
    phase === "before_order" &&
    (!quantityPlan || quantityPlan.storedCancelledQuantity === null)
  ) {
    update.status = "Anulowane";
  }
  if (
    caps.hasCancelledQuantity &&
    quantityPlan &&
    quantityPlan.storedCancelledQuantity !== undefined
  ) {
    update.sales_cancelled_quantity = quantityPlan.storedCancelledQuantity;
  }
  return update;
}

/** Cofnięcie wycofania prośby w oknie undo — przywraca aktywną pozycję na liście. */
export type SalesCancelUndoRestore = {
  sales_cancelled_at?: string | null;
  sales_cancelled_quantity?: string | null;
  sales_cancel_phase?: string | null;
  status?: IndividualOrderStatus | null;
};

/** Migawka przed rezygnacją — do przywrócenia przy cofnięciu (⌘Z). */
export function salesCancelUndoRestoreSnapshot(
  order: Pick<
    IndividualOrder,
    "sales_cancelled_at" | "sales_cancelled_quantity" | "sales_cancel_phase" | "status"
  >
): SalesCancelUndoRestore {
  return {
    sales_cancelled_at: order.sales_cancelled_at ?? null,
    sales_cancelled_quantity: order.sales_cancelled_quantity ?? null,
    sales_cancel_phase: order.sales_cancel_phase ?? null,
    status: order.status,
  };
}

/** Warunek optymistyczny przy cofaniu rezygnacji — dopasowuje stan wiersza przed UPDATE. */
export function salesCancelUndoMatchKind(
  row: Pick<IndividualOrder, "sales_cancelled_at" | "sales_acknowledged_at" | "status">,
  caps: SalesCancelDbCaps
): "cancelled_at" | "legacy_anulowane" | "ack_only" {
  if (!caps.hasCancelledAt) return "legacy_anulowane";
  if (row.sales_cancelled_at) return "cancelled_at";
  if (row.sales_acknowledged_at && row.status === "Anulowane") return "ack_only";
  return "cancelled_at";
}

export function buildSalesCancelUndoUpdate(
  caps: SalesCancelDbCaps,
  restoreStatus: IndividualOrderStatus | null,
  restore?: SalesCancelUndoRestore | null
): Record<string, unknown> {
  const update: Record<string, unknown> = {
    sales_acknowledged_at: null,
  };
  if (caps.hasCancelledAt) {
    update.sales_cancelled_at =
      restore && "sales_cancelled_at" in restore
        ? restore.sales_cancelled_at
        : null;
  }
  if (caps.hasCancelPhase) {
    update.sales_cancel_phase =
      restore && "sales_cancel_phase" in restore
        ? restore.sales_cancel_phase
        : null;
  }
  if (caps.hasCancelledQuantity) {
    update.sales_cancelled_quantity =
      restore && "sales_cancelled_quantity" in restore
        ? restore.sales_cancelled_quantity
        : null;
  }
  const statusFromRestore = restore?.status;
  if (statusFromRestore !== undefined && statusFromRestore !== null) {
    update.status = statusFromRestore;
  } else if (restoreStatus) {
    update.status = restoreStatus;
  }
  return update;
}
