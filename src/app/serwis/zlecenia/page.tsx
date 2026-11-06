import type { Metadata } from "next";
import { requireServicePanel } from "@/lib/auth";
import {
  fetchOrdersByHelpdeskIds,
  fetchServiceModelParts,
  fetchServiceModelWarranties,
  fetchServiceOrderBoard,
} from "@/lib/data/service-orders";
import { fetchOpenServiceTickets, helpdeskMode } from "@/lib/mikran-shop/helpdesk";
import type { HelpdeskBoardData } from "@/components/serwis/HelpdeskTicketsSection";
import { fetchLoanerFleet } from "@/lib/data/service-loaners";
import { fetchWaitingPartsAvailable } from "@/lib/data/service-waiting-parts";
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
    partAvailable: Map<number, number>;
  } | null = null;
  let error: string | null = null;
  try {
    const [board, fleet, modelParts, warranties] = await Promise.all([
      fetchServiceOrderBoard(),
      fetchLoanerFleet(),
      fetchServiceModelParts(),
      fetchServiceModelWarranties(),
    ]);
    // Stan tylko części, na które czekają zlecenia — „część dotarła” bez pobierania całego magazynu.
    const waitingTwIds = board.orders.flatMap((o) => (o.status === "czeka_na_czesc" && o.waitingPart?.twId ? [o.waitingPart.twId] : []));
    const partAvailable = await fetchWaitingPartsAvailable(waitingTwIds).catch(() => new Map<number, number>());
    data = { board, loaners: fleet.units, modelParts, warranties, partAvailable };
  } catch (e) {
    error = userFacingErrorText(e, "Nie udało się wczytać zleceń serwisowych.");
  }
  // Helpdesk mikran.pl osobno: jego awaria nie zasłania zleceń, tylko sekcję zgłoszeń.
  let helpdesk: HelpdeskBoardData = { mode: helpdeskMode(), tickets: [], linked: {}, error: null };
  if (data && helpdesk.mode !== "off") {
    try {
      const { mode, tickets } = await fetchOpenServiceTickets();
      const linked = await fetchOrdersByHelpdeskIds(tickets.map((t) => t.id));
      helpdesk = { mode, tickets, linked: Object.fromEntries(linked), error: null };
    } catch (e) {
      helpdesk = { ...helpdesk, error: userFacingErrorText(e, "Nie udało się pobrać zgłoszeń z helpdesku mikran.pl.") };
    }
  }
  return (
    <div className={`${adminPageShellClass} touch-ui space-y-6`}>
      <PageHeader
        title="Zlecenia serwisowe"
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
          partAvailable={[...data.partAvailable]}
          helpdesk={helpdesk}
        />
      ) : null}
    </div>
  );
}
