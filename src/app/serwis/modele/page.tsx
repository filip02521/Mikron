import type { Metadata } from "next";
import { requireServicePanel } from "@/lib/auth";
import { fetchKnownServiceModels, fetchServiceModelParts, fetchServiceModelWarranties } from "@/lib/data/service-orders";
import { ServiceModelsCatalog } from "@/components/serwis/ServiceModelsCatalog";
import { ServiceOverdueLoanersNotice } from "@/components/serwis/ServiceOverdueLoanersNotice";
import { PageHeader } from "@/components/ui/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { SERVICE_WARRANTY_DEFAULT_MONTHS } from "@/lib/orders/service-warranty";
import { pageMetadataFor } from "@/lib/ui/page-metadata";
import { adminPageShellClass } from "@/lib/ui/ontime-theme";
import { userFacingErrorText } from "@/lib/ui/user-facing-error";

export const metadata: Metadata = pageMetadataFor("serwisModele");
export const dynamic = "force-dynamic";

export default async function ModelePage() {
  await requireServicePanel("read");
  let data: {
    parts: Awaited<ReturnType<typeof fetchServiceModelParts>>;
    known: Awaited<ReturnType<typeof fetchKnownServiceModels>>;
    warranties: Awaited<ReturnType<typeof fetchServiceModelWarranties>>;
  } | null = null;
  let error: string | null = null;
  try {
    const [parts, known, warranties] = await Promise.all([fetchServiceModelParts(), fetchKnownServiceModels(), fetchServiceModelWarranties()]);
    data = { parts, known, warranties };
  } catch (e) {
    error = userFacingErrorText(e, "Nie udało się wczytać katalogu modeli.");
  }
  return (
    <div className={`${adminPageShellClass} touch-ui space-y-6`}>
      <PageHeader
        title="Katalog modeli"
        description={`Części, które zwykle idą do naprawy modelu, i jego gwarancja (domyślnie ${SERVICE_WARRANTY_DEFAULT_MONTHS} mies. od zakupu). Otwórz model, żeby je ustawić.`}
      />
      <ServiceOverdueLoanersNotice />
      {error ? (
        <Alert tone="error" title="Nie wczytano katalogu">
          {`${error} Odśwież stronę za chwilę.`}
        </Alert>
      ) : data ? (
        <ServiceModelsCatalog parts={data.parts} known={data.known} warranties={data.warranties} />
      ) : null}
    </div>
  );
}
