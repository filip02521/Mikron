import { createAdminClient, hasSupabaseConfig } from "@/lib/supabase/admin";

export type TeethOrderHistoryAction =
  | "ordered"
  | "unmark"
  | "delivery_override"
  | "delivery_clear"
  | "schedule_ordered"
  | "schedule_shift";

export type TeethOrderHistoryRow = {
  id: string;
  action_at: string;
  actor_id: string | null;
  actor_email: string | null;
  supplier_id: string | null;
  action: TeethOrderHistoryAction;
  order_ids: string[];
  meta: Record<string, unknown>;
  supplier?: { id: string; name: string } | null;
};

export type TeethOrderHistoryActor = {
  id?: string | null;
  email?: string | null;
};

export async function appendTeethOrderHistory(entry: {
  action: TeethOrderHistoryAction;
  actor?: TeethOrderHistoryActor;
  supplierId?: string | null;
  orderIds?: string[];
  meta?: Record<string, unknown>;
}): Promise<void> {
  if (!hasSupabaseConfig()) return;

  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from("teeth_order_history").insert({
      actor_id: entry.actor?.id ?? null,
      actor_email: entry.actor?.email ?? null,
      supplier_id: entry.supplierId ?? null,
      action: entry.action,
      order_ids: entry.orderIds ?? [],
      meta: entry.meta ?? {},
    });
    if (error) {
      console.error("[appendTeethOrderHistory]", error.message);
    }
  } catch (err) {
    console.error("[appendTeethOrderHistory]", err);
  }
}

export async function fetchTeethOrderHistoryAudit(options?: {
  limit?: number;
  supplierId?: string | null;
}): Promise<TeethOrderHistoryRow[]> {
  if (!hasSupabaseConfig()) return [];

  const supabase = createAdminClient();
  const limit = Math.min(Math.max(options?.limit ?? 40, 1), 200);

  let query = supabase
    .from("teeth_order_history")
    .select("*, supplier:suppliers(id, name)")
    .order("action_at", { ascending: false })
    .limit(limit);

  if (options?.supplierId) {
    query = query.eq("supplier_id", options.supplierId);
  }

  const { data, error } = await query;
  if (error) {
    if (error.message?.includes("teeth_order_history")) return [];
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => ({
    id: String(row.id),
    action_at: String(row.action_at),
    actor_id: row.actor_id != null ? String(row.actor_id) : null,
    actor_email: row.actor_email != null ? String(row.actor_email) : null,
    supplier_id: row.supplier_id != null ? String(row.supplier_id) : null,
    action: row.action as TeethOrderHistoryAction,
    order_ids: Array.isArray(row.order_ids) ? row.order_ids.map(String) : [],
    meta: (row.meta as Record<string, unknown>) ?? {},
    supplier: row.supplier
      ? {
          id: String((row.supplier as { id: string }).id),
          name: String((row.supplier as { name: string }).name),
        }
      : null,
  }));
}
