import type { Metadata } from "next";
import { requireServicePanel } from "@/lib/auth";
import { fetchServiceModelParts, fetchServiceModelWarranties, fetchServiceOrderBoard } from "@/lib/data/service-orders";
import { fetchLoanerFleet } from "@/lib/data/service-loaners";
import { ServiceOrdersBoard } from "@/components/serwis/ServiceOrdersBoard";
import { ServiceOverdueLoanersNotice } from "@/components/serwis/ServiceOverdueLoanersNotice";
import { PageHeader } from "@/components/ui/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { pageMetadataFor } from "@/lib/ui/page-metadata";
import { adminPageShellClass } from "@/lib/ui/ontime-theme";
import { userFacingErrorText } from "@/lib/ui/user-facing-error";

export const metadata: Metadata = pageMetadataFor("serwisZlecenia");
export const dynamic = "force-dynamic";

export default async function ZleceniaPage() {
  await requireServicePanel("read");
  let data: {
    board: Awaited<ReturnType<typeof fetchServiceOrderBoard>>;
    loaners: Awaited<ReturnType<typeof fetchLoanerFleet>>["units"];
    modelParts: Awaited<ReturnType<typeof fetchServiceModelParts>>;
    warranties: Awaited<ReturnType<typeof fetchServiceModelWarranties>>;
  } | null = null;
  let error: string | null = null;
  try {
    const [board, fleet, modelParts, warranties] = await Promise.all([
      fetchServiceOrderBoard(),
      fetchLoanerFleet(),
      fetchServiceModelParts(),
      fetchServiceModelWarranties(),
    ]);
    data = { board, loaners: fleet.units, modelParts, warranties };
  } catch (e) {
    error = userFacingErrorText(e, "Nie udało się wczytać zleceń serwisowych.");
  }
  return (
    <div className={`${adminPageShellClass} touch-ui space-y-6`}>
      <PageHeader
        title="Zlecenia serwisowe"
        description="Sprzęt klientów w naprawie — od przyjęcia do wydania."
      />
      <ServiceOverdueLoanersNotice />
      {error ? (
        <Alert tone="error" title="Nie wczytano zleceń">
          {`${error} Odśwież stronę za chwilę.`}
        </Alert>
      ) : data ? (
        <ServiceOrdersBoard
          orders={data.board.orders}
          parts={data.board.parts}
          events={data.board.events}
          loaners={data.loaners
            .filter((u) => u.status === "u_klienta")
            .map((u) => ({ id: u.id, code: u.code, twName: u.twName, clientName: u.currentClientName, khId: u.currentKhId }))}
          modelParts={data.modelParts.map((m) => ({
            modelTwId: m.modelTwId,
            partTwId: m.partTwId,
            partSymbol: m.partSymbol,
            partName: m.partName,
            defaultQty: m.defaultQty,
          }))}
          warrantyMonths={data.warranties.map((w) => [w.modelTwId, w.months] as [number, number])}
        />
      ) : null}
    </div>
  );
}
