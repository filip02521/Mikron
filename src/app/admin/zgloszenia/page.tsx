import { fetchSalesBugReports } from "@/lib/data/sales-bug-reports";
import { getSessionUser } from "@/lib/auth";
import { BugReportsAdminClient } from "@/components/admin/BugReportsAdminClient";
import { PageHeader } from "@/components/ui/PageHeader";
import Link from "next/link";
import { BackChevron } from "@/components/ui/UiGlyphs";
import { redirect } from "next/navigation";

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
    <>
      <PageHeader
        title="Zgłoszenia handlowców"
        description="Wiadomości o błędach i problemach — osobna skrzynka, poza głównym UI."
        actions={
          <Link
            href="/admin"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 underline-offset-2 hover:text-slate-900 hover:underline"
          >
            <BackChevron className="text-slate-500" />
            Administracja
          </Link>
        }
      />
      <BugReportsAdminClient initialReports={reports} />
    </>
  );
}
