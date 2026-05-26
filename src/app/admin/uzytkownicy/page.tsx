import { fetchAppUsers } from "@/lib/data/users";
import { fetchSalesPeople } from "@/lib/data/queries";
import { fetchSalesGroups } from "@/lib/data/sales-groups";
import { fetchManagerGroupIdsByProfile } from "@/lib/data/sales-group-access";
import { getSessionUser } from "@/lib/auth";
import { UsersAdminClient } from "@/components/admin/UsersAdminClient";
import { AdminHubNav } from "@/components/admin/AdminHubNav";
import { PageHeader } from "@/components/ui/PageHeader";
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
  } catch {
    /* empty */
  }

  return (
    <>
      <PageHeader
        title="Konta użytkowników"
        description="Logowanie do systemu, role i hasła. Handlowiec musi mieć kartę w zakładce Handlowcy."
      />
      <AdminHubNav activeTab="users" />
      <UsersAdminClient
        initialUsers={users}
        salesPeople={salesPeople}
        salesGroups={salesGroups}
        initialManagerGroups={initialManagerGroups}
        currentUserId={session.id}
        prefillSalesPersonId={prefillSalesPersonId}
      />
    </>
  );
}
