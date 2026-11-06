import type { Metadata } from "next";
import { requireServicePanel } from "@/lib/auth";
import { fetchRepairedModels, fetchServiceModelParts, fetchServiceModelWarranties } from "@/lib/data/service-orders";
import { ServiceModelsCatalog } from "@/components/serwis/ServiceModelsCatalog";
import { ServiceOverdueLoanersNotice } from "@/components/serwis/ServiceOverdueLoanersNotice";
import { PageHeader } from "@/components/ui/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { pageMetadataFor } from "@/lib/ui/page-metadata";
import { adminPageShellClass } from "@/lib/ui/ontime-theme";
import { userFacingErrorText } from "@/lib/ui/user-facing-error";

export const metadata: Metadata = pageMetadataFor("serwisModele");
export const dynamic = "force-dynamic";

export default async function ModelePage() {
  await requireServicePanel("read");
  let data: {
    parts: Awaited<ReturnType<typeof fetchServiceModelParts>>;
    repaired: Awaited<ReturnType<typeof fetchRepairedModels>>;
    warranties: Awaited<ReturnType<typeof fetchServiceModelWarranties>>;
  } | null = null;
  let error: string | null = null;
  try {
    const [parts, repaired, warranties] = await Promise.all([fetchServiceModelParts(), fetchRepairedModels(), fetchServiceModelWarranties()]);
    data = { parts, repaired, warranties };
  } catch (e) {
    error = userFacingErrorText(e, "Nie udało się wczytać katalogu części.");
  }
  return (
    <div className={`${adminPageShellClass} touch-ui space-y-6`}>
      <PageHeader
        title="Katalog modeli"
        description="Części do naprawy i okres gwarancji danego modelu."
      />
      <ServiceOverdueLoanersNotice />
      {error ? (
        <Alert tone="error" title="Nie wczytano katalogu">
          {`${error} Odśwież stronę za chwilę.`}
        </Alert>
      ) : data ? (
        <ServiceModelsCatalog parts={data.parts} repaired={data.repaired} warranties={data.warranties} />
      ) : null}
    </div>
  );
}
