import { requireSalesTeamManagement } from "@/lib/auth";
import { resolveSalesPersonForUser } from "@/lib/auth/sales-person";
import { fetchSalesPeopleAdmin } from "@/lib/data/sales-people-admin";
import { SalesTeamOverview } from "@/components/sales/SalesTeamOverview";
import { SalesTeamWorkspace } from "@/components/sales/SalesTeamWorkspace";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

export default async function ZespolPage() {
  const user = await requireSalesTeamManagement();
  const [rows, ownSalesPerson] = await Promise.all([
    fetchSalesPeopleAdmin(),
    resolveSalesPersonForUser(user),
  ]);

  return (
    <SalesTeamWorkspace
      title="Podgląd zespołu"
      description="Szybki dostęp do panelu każdego handlowca i składanie prośb w jego imieniu."
      action={
        <Link href="/zespol/handlowcy">
          <Button variant="secondary" size="sm">
            Handlowcy i konta
          </Button>
        </Link>
      }
    >
      <SalesTeamOverview rows={rows} managerSalesPersonId={ownSalesPerson?.id ?? null} />
    </SalesTeamWorkspace>
  );
}
