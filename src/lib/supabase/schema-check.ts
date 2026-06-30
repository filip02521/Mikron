import type { SupabaseClient } from "@supabase/supabase-js";

async function columnExists(
  supabase: SupabaseClient,
  column: string
): Promise<boolean> {
  return columnExistsOnTable(supabase, "individual_orders", column);
}

async function columnExistsOnTable(
  supabase: SupabaseClient,
  table: string,
  column: string
): Promise<boolean> {
  const { error } = await supabase.from(table).select(column).limit(0);
  if (!error) return true;
  const msg = error.message ?? "";
  if (
    error.code === "42703" ||
    error.code === "PGRST204" ||
    msg.includes(column)
  ) {
    return false;
  }
  return true;
}

export async function hasTeethOrderDetailsTable(
  supabase: SupabaseClient
): Promise<boolean> {
  const { error } = await supabase
    .from("individual_order_teeth_details")
    .select("id")
    .limit(0);
  if (!error) return true;
  const msg = error.message ?? "";
  if (
    error.code === "42P01" ||
    (msg.includes("individual_order_teeth_details") && msg.includes("does not exist"))
  ) {
    return false;
  }
  return false;
}

export async function hasTeethOrderDetailsJawColumn(
  supabase: SupabaseClient
): Promise<boolean> {
  if (!(await hasTeethOrderDetailsTable(supabase))) return false;
  return columnExistsOnTable(supabase, "individual_order_teeth_details", "jaw");
}

export async function hasTeethOrderDetailsKindColumn(
  supabase: SupabaseClient
): Promise<boolean> {
  if (!(await hasTeethOrderDetailsTable(supabase))) return false;
  return columnExistsOnTable(supabase, "individual_order_teeth_details", "kind");
}

export async function hasRequestKindColumn(
  supabase: SupabaseClient
): Promise<boolean> {
  return columnExists(supabase, "request_kind");
}

export async function hasOrderedAtColumn(supabase: SupabaseClient): Promise<boolean> {
  return columnExists(supabase, "ordered_at");
}

export async function hasSalesAcknowledgedColumn(
  supabase: SupabaseClient
): Promise<boolean> {
  return columnExists(supabase, "sales_acknowledged_at");
}

export async function hasSalesCancelledAtColumn(
  supabase: SupabaseClient
): Promise<boolean> {
  return columnExists(supabase, "sales_cancelled_at");
}

export async function hasSalesCancelPhaseColumn(
  supabase: SupabaseClient
): Promise<boolean> {
  return columnExists(supabase, "sales_cancel_phase");
}

export async function hasSalesClientNameColumn(
  supabase: SupabaseClient
): Promise<boolean> {
  return columnExists(supabase, "sales_client_name");
}

export async function hasSalesRequestNoteColumn(
  supabase: SupabaseClient
): Promise<boolean> {
  return columnExists(supabase, "sales_request_note");
}

export async function hasProcurementCancelNoteColumn(
  supabase: SupabaseClient
): Promise<boolean> {
  return columnExists(supabase, "procurement_cancel_note");
}

export async function hasSalesCancelledQuantityColumn(
  supabase: SupabaseClient
): Promise<boolean> {
  return columnExists(supabase, "sales_cancelled_quantity");
}

export async function hasProcurementSalesCancelAckColumn(
  supabase: SupabaseClient
): Promise<boolean> {
  return columnExists(supabase, "procurement_sales_cancel_ack_at");
}

export async function hasProcurementSeenAtColumn(
  supabase: SupabaseClient
): Promise<boolean> {
  return columnExists(supabase, "procurement_seen_at");
}

export async function hasZdFulfillmentDeadlineChangeColumns(
  supabase: SupabaseClient
): Promise<boolean> {
  const columns = [
    "zd_fulfillment_previous_deadline",
    "zd_fulfillment_deadline_changed_at",
    "zd_fulfillment_deadline_change_seen_at",
  ] as const;
  for (const column of columns) {
    if (!(await columnExists(supabase, column))) return false;
  }
  return true;
}

export async function hasProcurementCancelDispositionColumn(
  supabase: SupabaseClient
): Promise<boolean> {
  return columnExists(supabase, "procurement_cancel_disposition");
}

export async function hasWarehouseCancelFulfilledColumn(
  supabase: SupabaseClient
): Promise<boolean> {
  return columnExists(supabase, "warehouse_cancel_fulfilled_at");
}

export async function hasJobLockRpc(supabase: SupabaseClient): Promise<boolean> {
  const { data, error } = await supabase.rpc("try_acquire_job_lock", {
    p_key: "__schema_probe__",
    p_ttl_seconds: 1,
    p_locked_by: "probe",
  });
  if (error) {
    const msg = error.message ?? "";
    return !(
      msg.includes("try_acquire_job_lock") ||
      msg.includes("Could not find the function")
    );
  }
  if (data === true) {
    await supabase.from("job_locks").delete().eq("key", "__schema_probe__");
  }
  return true;
}

export type SchemaCheckResult = {
  ok: boolean;
  issues: string[];
};

export async function runSchemaChecks(
  supabase: SupabaseClient
): Promise<SchemaCheckResult> {
  const issues: string[] = [];

  if (!(await hasRequestKindColumn(supabase))) {
    issues.push(
      "Brak kolumny individual_orders.request_kind — uruchom supabase/migrations/006_request_kind_informacja.sql"
    );
  }
  if (!(await hasOrderedAtColumn(supabase))) {
    issues.push(
      "Brak kolumny individual_orders.ordered_at — uruchom supabase/migrations/007_ordered_at.sql"
    );
  }
  if (!(await hasSalesAcknowledgedColumn(supabase))) {
    issues.push(
      "Brak kolumny individual_orders.sales_acknowledged_at — uruchom supabase/migrations/011_sales_acknowledged.sql"
    );
  }
  if (!(await hasSalesCancelledAtColumn(supabase))) {
    issues.push(
      "Brak kolumny individual_orders.sales_cancelled_at — uruchom supabase/migrations/014_sales_cancelled_at.sql (lub 018_sales_cancel_bundle.sql)"
    );
  }
  if (!(await hasSalesCancelPhaseColumn(supabase))) {
    issues.push(
      "Brak kolumny individual_orders.sales_cancel_phase — uruchom supabase/migrations/015_sales_cancel_phase.sql"
    );
  }
  if (!(await hasSalesClientNameColumn(supabase))) {
    issues.push(
      "Brak kolumny individual_orders.sales_client_name — uruchom supabase/migrations/017_sales_client_name.sql"
    );
  }
  if (!(await hasSalesRequestNoteColumn(supabase))) {
    issues.push(
      "Brak kolumny individual_orders.sales_request_note — uruchom supabase/migrations/058_individual_orders_sales_request_note.sql"
    );
  }
  if (!(await hasProcurementCancelNoteColumn(supabase))) {
    issues.push(
      "Brak kolumny individual_orders.procurement_cancel_note — uruchom supabase/migrations/063_procurement_cancel_note.sql"
    );
  }
  if (!(await hasSalesCancelledQuantityColumn(supabase))) {
    issues.push(
      "Brak kolumny individual_orders.sales_cancelled_quantity — uruchom supabase/migrations/059_individual_orders_sales_cancelled_quantity.sql"
    );
  }
  if (!(await hasProcurementSalesCancelAckColumn(supabase))) {
    issues.push(
      "Brak kolumny individual_orders.procurement_sales_cancel_ack_at — uruchom supabase/migrations/019_procurement_sales_cancel_ack.sql"
    );
  }
  if (!(await hasWarehouseCancelFulfilledColumn(supabase))) {
    issues.push(
      "Brak kolumny individual_orders.warehouse_cancel_fulfilled_at — uruchom supabase/migrations/062_warehouse_cancel_fulfilled.sql"
    );
  }
  if (!(await hasZdFulfillmentDeadlineChangeColumns(supabase))) {
    issues.push(
      "Brak kolumn terminów ZD (067) — uruchom supabase/migrations/067_individual_orders_zd_fulfillment_deadline_change.sql"
    );
  }
  if (!(await hasJobLockRpc(supabase))) {
    issues.push(
      "Brak funkcji try_acquire_job_lock — uruchom supabase/migrations/013_job_lock_atomic.sql"
    );
  }
  if (!(await hasTeethOrderDetailsTable(supabase))) {
    issues.push(
      "Brak tabeli individual_order_teeth_details — uruchom supabase/migrations/079_teeth_order_details.sql"
    );
  } else {
    if (!(await hasTeethOrderDetailsJawColumn(supabase))) {
      issues.push(
        "Brak kolumny individual_order_teeth_details.jaw — uruchom supabase/migrations/080_teeth_jaw.sql"
      );
    }
    if (!(await hasTeethOrderDetailsKindColumn(supabase))) {
      issues.push(
        "Brak kolumny individual_order_teeth_details.kind — uruchom supabase/migrations/081_teeth_kind.sql"
      );
    }
  }

  return { ok: issues.length === 0, issues };
}

export const MIGRATION_006_HINT =
  "Uruchom w Supabase SQL Editor: supabase/migrations/006_request_kind_informacja.sql";
