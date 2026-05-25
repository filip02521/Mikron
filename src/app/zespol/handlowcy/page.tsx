import { requireSalesTeamManagement } from "@/lib/auth";
import { fetchSalesPeopleAdmin } from "@/lib/data/sales-people-admin";
import { SalesAdminClient } from "@/components/admin/SalesAdminClient";
import { SalesTeamWorkspace } from "@/components/sales/SalesTeamWorkspace";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

export default async function ZespolHandlowcyPage() {
  await requireSalesTeamManagement();
  const rows = await fetchSalesPeopleAdmin();

  return (
    <SalesTeamWorkspace
      title="Handlowcy i konta"
      description="Dodawaj handlowców, zakładaj konta z hasłem jednorazowym i generuj linki zaproszenia."
      iconKey="teamAccounts"
      action={
        <Link href="/zespol">
          <Button variant="outline" size="sm">
            Podgląd zespołu
          </Button>
        </Link>
      }
    >
      <SalesAdminClient initial={rows} managerMode />
    </SalesTeamWorkspace>
  );
}
