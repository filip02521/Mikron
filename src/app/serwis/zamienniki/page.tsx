import type { Metadata } from "next";
import { requireServicePanel } from "@/lib/auth";
import { fetchLoanerFleet } from "@/lib/data/service-loaners";
import { fetchOrderNumbersByLoaner } from "@/lib/data/service-orders";
import { LoanersBoard } from "@/components/serwis/LoanersBoard";
import { ServiceHubTabs } from "@/components/serwis/ServiceHubTabs";
import { PageHeader } from "@/components/ui/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { pageMetadataFor } from "@/lib/ui/page-metadata";
import { adminPageShellClass } from "@/lib/ui/ontime-theme";
import { userFacingErrorText } from "@/lib/ui/user-facing-error";

export const metadata: Metadata = pageMetadataFor("serwisZamienniki");
export const dynamic = "force-dynamic";

export default async function ZamiennikiPage() {
  await requireServicePanel("read");
  let fleet: Awaited<ReturnType<typeof fetchLoanerFleet>> | null = null;
  let orderByUnit: Record<string, string> = {};
  let error: string | null = null;
  try {
    const [f, orders] = await Promise.all([fetchLoanerFleet(), fetchOrderNumbersByLoaner()]);
    fleet = f;
    orderByUnit = Object.fromEntries(orders);
  } catch (e) {
    error = userFacingErrorText(e, "Nie udało się wczytać sprzętu zastępczego.");
  }
  return (
    <div className={`${adminPageShellClass} touch-ui space-y-6`}>
      <PageHeader
        title="Sprzęt zastępczy"
        description="Kto ma który egzemplarz, od ilu dni i kiedy ma oddać. Model to towar z Subiekta, historię egzemplarza prowadzi OnTime."
      />
      <ServiceHubTabs active="zamienniki" />
      {error ? (
        <Alert tone="error" title="Nie wczytano danych">
          {`${error} Odśwież stronę za chwilę.`}
        </Alert>
      ) : fleet ? (
        <LoanersBoard units={fleet.units} events={fleet.events} orderByUnit={orderByUnit} />
      ) : null}
    </div>
  );
}
