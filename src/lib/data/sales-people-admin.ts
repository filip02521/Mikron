import { createAdminClient, hasSupabaseConfig } from "@/lib/supabase/admin";

export type SalesPersonAdminRow = {
  id: string;
  name: string;
  email: string;
  orderCount: number;
  linkedUserId: string | null;
  linkedUserEmail: string | null;
};

export async function fetchSalesPeopleAdmin(): Promise<SalesPersonAdminRow[]> {
  if (!hasSupabaseConfig()) return [];

  const supabase = createAdminClient();

  const [{ data: people, error: peopleError }, { data: profiles, error: profilesError }] =
    await Promise.all([
      supabase.from("sales_people").select("id, name, email").order("name"),
      supabase
        .from("profiles")
        .select("id, email, sales_person_id")
        .not("sales_person_id", "is", null),
    ]);

  if (peopleError) throw new Error(peopleError.message);
  if (profilesError) throw new Error(profilesError.message);

  const linkedBySalesId = new Map(
    (profiles ?? []).map((p) => [
      p.sales_person_id as string,
      { id: p.id, email: p.email ?? "—" },
    ])
  );

  const { data: orderRows, error: ordersError } = await supabase
    .from("individual_orders")
    .select("sales_person_id");
  if (ordersError) throw new Error(ordersError.message);

  const orderCountBySalesId = new Map<string, number>();
  for (const row of orderRows ?? []) {
    const id = row.sales_person_id;
    if (!id) continue;
    orderCountBySalesId.set(id, (orderCountBySalesId.get(id) ?? 0) + 1);
  }

  return (people ?? []).map((p) => {
    const linked = linkedBySalesId.get(p.id);
    return {
      id: p.id,
      name: p.name,
      email: p.email,
      orderCount: orderCountBySalesId.get(p.id) ?? 0,
      linkedUserId: linked?.id ?? null,
      linkedUserEmail: linked?.email ?? null,
    };
  });
}
