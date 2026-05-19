import { createAdminClient, hasSupabaseConfig } from "@/lib/supabase/admin";

type OrderRow = {
  action_at: string;
  ordered_at: string | null;
  delivery_at: string | null;
  status: string;
  sales_acknowledged_at: string | null;
};

/**
 * Skrót stanu listy handlowca — zmiana = nowa prośba, status, dostawa lub potwierdzenie.
 */
export async function computeSalesActivityVersion(
  salesPersonId: string
): Promise<string> {
  if (!hasSupabaseConfig()) return "0";

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("individual_orders")
    .select("action_at, ordered_at, delivery_at, status, sales_acknowledged_at")
    .eq("sales_person_id", salesPersonId);

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as OrderRow[];
  let activeCount = 0;
  let maxAction = "";
  let maxOrdered = "";
  let maxDelivery = "";
  const statusCounts: Record<string, number> = {};

  for (const row of rows) {
    statusCounts[row.status] = (statusCounts[row.status] ?? 0) + 1;
    if (!row.sales_acknowledged_at) activeCount++;
    if (row.action_at > maxAction) maxAction = row.action_at;
    if (row.ordered_at && row.ordered_at > maxOrdered) maxOrdered = row.ordered_at;
    if (row.delivery_at && row.delivery_at > maxDelivery) maxDelivery = row.delivery_at;
  }

  const statusPart = Object.entries(statusCounts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([s, n]) => `${s}:${n}`)
    .join(",");

  return `${activeCount}|${maxAction}|${maxOrdered}|${maxDelivery}|${statusPart}`;
}
