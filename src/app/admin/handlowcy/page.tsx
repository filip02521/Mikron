import { fetchSalesGroups } from "@/lib/data/sales-groups";
import { fetchSalesPeopleAdmin } from "@/lib/data/sales-people-admin";
import { SalesAdminClient } from "@/components/admin/SalesAdminClient";
import { AdminHubShell } from "@/components/admin/AdminHubShell";
import { Alert } from "@/components/ui/Alert";

import type { Metadata } from "next";
import { pageMetadataFor } from "@/lib/ui/page-metadata";

export const metadata: Metadata = pageMetadataFor("adminSales");

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
      <SalesAdminClient initial={people} groups={groups} />
    </AdminHubShell>
  );
}
