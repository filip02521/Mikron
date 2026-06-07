import { fetchSalesGroups } from "@/lib/data/sales-groups";
import { fetchSalesPeopleAdmin } from "@/lib/data/sales-people-admin";
import { SalesAdminClient } from "@/components/admin/SalesAdminClient";
import { AdminHubShell } from "@/components/admin/AdminHubShell";
import { Alert } from "@/components/ui/Alert";
import Link from "next/link";

export default async function HandlowcyPage() {
  let people: Awaited<ReturnType<typeof fetchSalesPeopleAdmin>> = [];
  let groups: Awaited<ReturnType<typeof fetchSalesGroups>> = [];
  let loadError: string | null = null;

  try {
    [people, groups] = await Promise.all([
      fetchSalesPeopleAdmin(),
      fetchSalesGroups(),
    ]);
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Nie udało się wczytać listy handlowców.";
    people = [];
    groups = [];
  }

  return (
    <AdminHubShell activeTab="sales">
      {loadError ? <Alert tone="error">{loadError}</Alert> : null}
      <Alert tone="info">
        Brak grupy na liście?{" "}
        <Link href="/zespol/grupy" className="font-semibold text-indigo-800 underline underline-offset-2">
          Utwórz grupę zespołu
        </Link>{" "}
        (np. Sklep, Biuro), potem przypisz handlowca i — przy koncie kierownika — zakres w{" "}
        <Link href="/admin/uzytkownicy" className="font-semibold text-indigo-800 underline underline-offset-2">
          Konta
        </Link>
        .
      </Alert>
      <SalesAdminClient initial={people} groups={groups} />
    </AdminHubShell>
  );
}
