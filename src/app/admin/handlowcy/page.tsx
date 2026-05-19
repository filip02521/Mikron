import { fetchSalesPeopleAdmin } from "@/lib/data/sales-people-admin";
import { SalesAdminClient } from "@/components/admin/SalesAdminClient";
import { AdminHubNav } from "@/components/admin/AdminHubNav";
import { PageHeader } from "@/components/ui/PageHeader";

export default async function HandlowcyPage() {
  let people: Awaited<ReturnType<typeof fetchSalesPeopleAdmin>> = [];
  try {
    people = await fetchSalesPeopleAdmin();
  } catch {
    people = [];
  }

  return (
    <>
      <PageHeader
        title="Handlowcy"
        description="Osoby kontaktowe, powiadomienia e-mail i linki zaproszeń do zakładania kont."
      />
      <AdminHubNav activeTab="sales" />
      <SalesAdminClient initial={people} />
    </>
  );
}
