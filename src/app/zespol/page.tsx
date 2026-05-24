import { requireSalesTeamManagement } from "@/lib/auth";
import { resolveSalesPersonForUser } from "@/lib/auth/sales-person";
import { fetchSalesPeopleAdmin } from "@/lib/data/sales-people-admin";
import { PageHeader } from "@/components/ui/PageHeader";
import { SalesTeamOverview } from "@/components/sales/SalesTeamOverview";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

export default async function ZespolPage() {
  const user = await requireSalesTeamManagement();
  const [rows, ownSalesPerson] = await Promise.all([
    fetchSalesPeopleAdmin(),
    resolveSalesPersonForUser(user),
  ]);

  return (
    <>
      <PageHeader
        title="Podgląd zespołu"
        description="Szybki dostęp do panelu każdego handlowca i składanie prośb w jego imieniu."
        actions={
          <Link href="/zespol/handlowcy">
            <Button variant="secondary">Handlowcy i konta</Button>
          </Link>
        }
      />
      <SalesTeamOverview rows={rows} managerSalesPersonId={ownSalesPerson?.id ?? null} />
    </>
  );
}
