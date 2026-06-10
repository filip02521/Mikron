import type { SupabaseClient } from "@supabase/supabase-js";
import {
  hasSalesCancelPhaseColumn,
  hasSalesCancelledAtColumn,
} from "@/lib/supabase/schema-check";
import type { SalesCancelPhase } from "@/lib/orders/sales-cancel";
import type { IndividualOrderStatus } from "@/types/database";

export type SalesCancelDbCaps = {
  hasCancelledAt: boolean;
  hasCancelPhase: boolean;
};

export async function getSalesCancelDbCaps(
  supabase: SupabaseClient
): Promise<SalesCancelDbCaps> {
  const [hasCancelledAt, hasCancelPhase] = await Promise.all([
    hasSalesCancelledAtColumn(supabase),
    hasSalesCancelPhaseColumn(supabase),
  ]);
  return { hasCancelledAt, hasCancelPhase };
}

export const SALES_CANCEL_MIGRATION_HINT =
  "Brak kolumn rezygnacji w bazie. W Supabase uruchom migrację: supabase/migrations/018_sales_cancel_bundle.sql (SQL Editor lub wtyczka Supabase).";

/** Pola SELECT dla akcji anulowania — bez kolumn, których jeszcze nie ma w DB. */
export function salesCancelOrderSelect(caps: SalesCancelDbCaps): string {
  const base =
    "id, status, sales_person_id, sales_acknowledged_at, quantity, delivered_quantity, request_kind";
  if (!caps.hasCancelledAt) return base;
  return caps.hasCancelPhase
    ? `${base}, sales_cancelled_at, sales_cancel_phase`
    : `${base}, sales_cancelled_at`;
}

export function salesCancelAckSelect(caps: SalesCancelDbCaps): string {
  const base = "id, status, sales_person_id, sales_acknowledged_at, quantity, delivered_quantity";
  if (!caps.hasCancelledAt) return base;
  return caps.hasCancelPhase
    ? `${base}, sales_cancelled_at, sales_cancel_phase`
    : `${base}, sales_cancelled_at`;
}

export function buildSalesCancelUpdate(
  caps: SalesCancelDbCaps,
  phase: SalesCancelPhase,
  now: string
): Record<string, unknown> | null {
  if (!caps.hasCancelledAt) {
    if (phase === "before_order") {
      return { status: "Anulowane", sales_acknowledged_at: now };
    }
    return null;
  }

  const update: Record<string, unknown> = {
    sales_cancelled_at: now,
    /** Wszystkie rezygnacje — od razu do archiwum, bez dodatkowego potwierdzenia na liście. */
    sales_acknowledged_at: now,
  };
  if (caps.hasCancelPhase) {
    update.sales_cancel_phase = phase;
  }
  if (phase === "before_order") {
    update.status = "Anulowane";
  }
  return update;
}

/** Cofnięcie wycofania prośby w oknie undo — przywraca aktywną pozycję na liście. */
export function buildSalesCancelUndoUpdate(
  caps: SalesCancelDbCaps,
  restoreStatus: IndividualOrderStatus | null
): Record<string, unknown> {
  const update: Record<string, unknown> = {
    sales_acknowledged_at: null,
  };
  if (caps.hasCancelledAt) {
    update.sales_cancelled_at = null;
  }
  if (caps.hasCancelPhase) {
    update.sales_cancel_phase = null;
  }
  if (restoreStatus) {
    update.status = restoreStatus;
  }
  return update;
}
