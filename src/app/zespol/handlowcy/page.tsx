import { requireSalesTeamManagement } from "@/lib/auth";
import { fetchSalesPeopleAdmin } from "@/lib/data/sales-people-admin";
import { PageHeader } from "@/components/ui/PageHeader";
import { SalesAdminClient } from "@/components/admin/SalesAdminClient";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

export default async function ZespolHandlowcyPage() {
  await requireSalesTeamManagement();
  const rows = await fetchSalesPeopleAdmin();

  return (
    <>
      <PageHeader
        title="Handlowcy i konta"
        description="Dodawaj handlowców, zakładaj konta z hasłem jednorazowym i generuj linki zaproszenia."
        actions={
          <Link href="/zespol">
            <Button variant="outline">Podgląd zespołu</Button>
          </Link>
        }
      />
      <SalesAdminClient initial={rows} managerMode />
    </>
  );
}
