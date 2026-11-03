import type { Metadata } from "next";
import { requireServicePanel } from "@/lib/auth";
import { loadServicePartsOverview } from "@/lib/data/service-parts-overview";
import { ServicePartsPanel } from "@/components/serwis/ServicePartsPanel";
import { PageHeader } from "@/components/ui/PageHeader";
import { ServiceHubTabs } from "@/components/serwis/ServiceHubTabs";
import { Alert } from "@/components/ui/Alert";
import { EmptyState } from "@/components/ui/EmptyState";
import { pageMetadataFor } from "@/lib/ui/page-metadata";
import { adminPageShellClass } from "@/lib/ui/ontime-theme";
import { userFacingErrorText } from "@/lib/ui/user-facing-error";
import type { ServicePartsOverview } from "@/lib/data/service-parts-overview";

export const metadata: Metadata = pageMetadataFor("serwis");
export const dynamic = "force-dynamic";

export default async function SerwisPage() {
  await requireServicePanel("read");
  let overview: ServicePartsOverview | null = null;
  let error: string | null = null;
  try {
    overview = await loadServicePartsOverview();
  } catch (e) {
    error = userFacingErrorText(e, "Nie udało się pobrać stanów części z Subiekta.");
  }

  return (
    <div className={`${adminPageShellClass} space-y-6`}>
      <PageHeader
        title="Części serwisowe"
        description="Towary z cechą Subiekta „Części serwisowe”. Zakupy zamawiają je tylko po zgłoszeniu, więc brakującą część zgłoś przyciskiem „Zgłoś brak”."
      />
      <ServiceHubTabs active="czesci" />
      {error ? (
        <Alert tone="error" title="Brak połączenia z Subiektem">
          {`${error} Spróbuj odświeżyć stronę za chwilę.`}
        </Alert>
      ) : overview?.kind === "no_cecha" ? (
        <EmptyState
          title={`Nie znaleziono cechy „${overview.cechaName}”`}
          description="Cechę bierzemy z indeksu cech Subiekta. Sprawdź nazwę cechy w Subiekcie albo poczekaj na nocną synchronizację indeksu."
        />
      ) : overview?.kind === "ok" ? (
        <ServicePartsPanel
          rows={overview.rows}
          cechaName={overview.cechaName}
          readAt={overview.readAt}
          canReport
        />
      ) : null}
    </div>
  );
}
