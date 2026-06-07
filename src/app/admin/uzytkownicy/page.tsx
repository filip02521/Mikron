import { fetchAppUsers } from "@/lib/data/users";
import { fetchSalesPeople } from "@/lib/data/queries";
import { fetchSalesGroups } from "@/lib/data/sales-groups";
import { fetchManagerGroupIdsByProfile } from "@/lib/data/sales-group-access";
import { getSessionUser } from "@/lib/auth";
import { UsersAdminClient } from "@/components/admin/UsersAdminClient";
import { AdminHubShell } from "@/components/admin/AdminHubShell";
import { Alert } from "@/components/ui/Alert";
import { redirect } from "next/navigation";

export default async function UzytkownicyPage({
  searchParams,
}: {
  searchParams: Promise<{ handlowiec?: string }>;
}) {
  const { handlowiec: prefillSalesPersonId } = await searchParams;
  const session = await getSessionUser();
  if (!session || session.role !== "admin") {
    redirect("/podsumowanie");
  }

  let users: Awaited<ReturnType<typeof fetchAppUsers>> = [];
  let salesPeople: { id: string; name: string; email: string }[] = [];
  let salesGroups: { id: string; name: string }[] = [];
  let initialManagerGroups: Record<string, string[]> = {};
  let loadError: string | null = null;

  try {
    const [u, sp, groups, managerMap] = await Promise.all([
      fetchAppUsers(),
      fetchSalesPeople(),
      fetchSalesGroups(),
      fetchManagerGroupIdsByProfile(),
    ]);
    users = u;
    salesPeople = sp.map((p) => ({
      id: p.id,
      name: p.name,
      email: p.email,
    }));
    salesGroups = groups.map((g) => ({ id: g.id, name: g.name }));
    initialManagerGroups = Object.fromEntries(managerMap);
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Nie udało się wczytać listy kont.";
  }

  return (
    <AdminHubShell activeTab="users">
      {loadError ? <Alert tone="error">{loadError}</Alert> : null}
      <UsersAdminClient
        initialUsers={users}
        salesPeople={salesPeople}
        salesGroups={salesGroups}
        initialManagerGroups={initialManagerGroups}
        currentUserId={session.id}
        prefillSalesPersonId={prefillSalesPersonId}
      />
    </AdminHubShell>
  );
}
