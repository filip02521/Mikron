import type { SupabaseClient } from "@supabase/supabase-js";

async function columnExists(
  supabase: SupabaseClient,
  column: string
): Promise<boolean> {
  const { error } = await supabase.from("individual_orders").select(column).limit(0);

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

export async function hasProcurementCancelDispositionColumn(
  supabase: SupabaseClient
): Promise<boolean> {
  return columnExists(supabase, "procurement_cancel_disposition");
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
  if (!(await hasProcurementSalesCancelAckColumn(supabase))) {
    issues.push(
      "Brak kolumny individual_orders.procurement_sales_cancel_ack_at — uruchom supabase/migrations/019_procurement_sales_cancel_ack.sql"
    );
  }
  if (!(await hasJobLockRpc(supabase))) {
    issues.push(
      "Brak funkcji try_acquire_job_lock — uruchom supabase/migrations/013_job_lock_atomic.sql"
    );
  }

  return { ok: issues.length === 0, issues };
}

export const MIGRATION_006_HINT =
  "Uruchom w Supabase SQL Editor: supabase/migrations/006_request_kind_informacja.sql";
