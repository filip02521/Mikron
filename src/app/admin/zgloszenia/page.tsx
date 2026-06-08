import { fetchSalesBugReports } from "@/lib/data/sales-bug-reports";
import { getSessionUser } from "@/lib/auth";
import { BugReportsAdminClient } from "@/components/admin/BugReportsAdminClient";
import { AdminSecondaryShell } from "@/components/admin/AdminSecondaryShell";
import { redirect } from "next/navigation";

import type { Metadata } from "next";
import { pageMetadataFor } from "@/lib/ui/page-metadata";

export const metadata: Metadata = pageMetadataFor("adminReports");

export default async function AdminZgloszeniaPage() {
  const session = await getSessionUser();
  if (!session || session.role !== "admin") {
    redirect("/podsumowanie");
  }

  let reports: Awaited<ReturnType<typeof fetchSalesBugReports>> = [];
  try {
    reports = await fetchSalesBugReports("all");
  } catch {
    /* empty */
  }

  return (
    <AdminSecondaryShell
      title="Zgłoszenia handlowców"
      description="Karteczki zgłoszeń — celowo inny układ niż reszta panelu."
      iconKey="notepad"
    >
      <BugReportsAdminClient initialReports={reports} />
    </AdminSecondaryShell>
  );
}
