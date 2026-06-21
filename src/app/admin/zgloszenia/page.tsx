import { fetchSalesBugReports } from "@/lib/data/sales-bug-reports";
import { getSessionUser } from "@/lib/auth";
import { BugReportsAdminClient } from "@/components/admin/BugReportsAdminClient";
import { AdminSecondaryShell } from "@/components/admin/AdminSecondaryShell";
import { Alert } from "@/components/ui/Alert";
import { logDevPageError } from "@/lib/dev/log-page-error";
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
  let loadError: string | null = null;
  try {
    reports = await fetchSalesBugReports("all");
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Nie udało się wczytać zgłoszeń.";
    logDevPageError("admin/zgloszenia/page", error);
  }

  return (
    <AdminSecondaryShell
      title="Zgłoszenia handlowców"
      description="Karteczki zgłoszeń — celowo inny układ niż reszta panelu."
      iconKey="notepad"
    >
      {loadError ? <Alert tone="error">{loadError}</Alert> : null}
      <BugReportsAdminClient initialReports={reports} />
    </AdminSecondaryShell>
  );
}
