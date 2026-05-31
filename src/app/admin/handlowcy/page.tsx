import { fetchSalesGroups } from "@/lib/data/sales-groups";
import { fetchSalesPeopleAdmin } from "@/lib/data/sales-people-admin";
import { SalesAdminClient } from "@/components/admin/SalesAdminClient";
import { AdminHubNav } from "@/components/admin/AdminHubNav";
import { PageHeader } from "@/components/ui/PageHeader";
import Link from "next/link";

export default async function HandlowcyPage() {
  let people: Awaited<ReturnType<typeof fetchSalesPeopleAdmin>> = [];
  let groups: Awaited<ReturnType<typeof fetchSalesGroups>> = [];
  try {
    [people, groups] = await Promise.all([
      fetchSalesPeopleAdmin(),
      fetchSalesGroups(),
    ]);
  } catch {
    people = [];
    groups = [];
  }

  return (
    <>
      <PageHeader
        title="Handlowcy"
        description="Osoby kontaktowe, powiadomienia e-mail i linki zaproszeń do zakładania kont."
      />
      <AdminHubNav activeTab="sales" />
      <p className="mb-4 rounded-md border border-indigo-100 bg-indigo-50/70 px-4 py-3 text-sm text-indigo-950">
        Brak grupy na liście?{" "}
        <Link href="/zespol/grupy" className="font-semibold text-indigo-800 underline underline-offset-2">
          Utwórz grupę zespołu
        </Link>{" "}
        (np. Sklep, Biuro), potem przypisz handlowca i — przy koncie kierownika — zakres w{" "}
        <Link href="/admin/uzytkownicy" className="font-semibold text-indigo-800 underline underline-offset-2">
          Konta
        </Link>
        .
      </p>
      <SalesAdminClient initial={people} groups={groups} />
    </>
  );
}
