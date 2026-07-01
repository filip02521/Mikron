import { isStockExemptTwId } from "@/lib/orders/teeth-stock-exempt";
import { formatPlDate } from "@/lib/display-labels";
import type { IndividualRequestKind } from "@/types/database";

/** Etapy toru zębów — onboarding i pomoc w panelach. */
export const TEETH_PROCUREMENT_FLOW_STAGES = [
  {
    stage: "Prośba",
    actor: "Handlowiec",
    where: "Formularz prośby",
    detail: "Lista zębów, badge Zęby",
  },
  {
    stage: "Kolejka zakupów",
    actor: "Zakupy zęby",
    where: "Panel zębów → Kolejka",
    detail: "Specyfikacja, batch per lab",
  },
  {
    stage: "Zamówione",
    actor: "Zakupy zęby",
    where: "Panel zębów → Historia",
    detail: "Data zamówienia, ETA labu",
  },
  {
    stage: "Przyjęcie",
    actor: "Zakupy zęby",
    where: "Panel zębów → Przyjęcie",
    detail: "Co dotarło od labu — bez maila",
  },
  {
    stage: "Odbiór",
    actor: "Handlowiec",
    where: "Moje zamówienia",
    detail: "Potwierdź odbiór zębów",
  },
  {
    stage: "Archiwum",
    actor: "Zakupy zęby",
    where: "Panel zębów → Historia",
    detail: "Pełny ślad operacji",
  },
] as const;

export const TEETH_PROCUREMENT_PANEL_LABEL = "panel zębów";
export const TEETH_PROCUREMENT_PANEL_HINT =
  "Trafia do panelu zębów — nie do panelu dziennego.";

export const TEETH_EDIT_REQUEST_TITLE = "Edycja prośby zębowej";
export const TEETH_EDIT_REQUEST_BANNER =
  "To prośba na zęby syntetyczne — realizuje ją panel zębów (/zeby), nie panel dzienny.";

export const TEETH_READINESS_SUPPLIER_DETAIL = "Wybrany — trafia do panelu zębów";
export const TEETH_READINESS_READY_SUBLINE =
  "Kompletne — trafi do kolejki panelu zębów.";

export const TEETH_SALES_STATUS_NEW_TITLE = "Przed zamówieniem u labu";
export const TEETH_SALES_STATUS_NEW_DETAIL =
  "Prośba jest w kolejce panelu zębów — dział zakupów zębów zamówi u dostawcy.";
export const TEETH_SALES_STATUS_VERIFICATION_TITLE = "W kolejce panelu zębów";
export const TEETH_SALES_STATUS_VERIFICATION_DETAIL =
  "Dział zakupów zębów doprecyzuje szczegóły — nie przechodzi przez panel dzienny.";
export const TEETH_SALES_STATUS_ORDERED_TITLE = "Zamówione u labu";

export type ProsbaLaneClassification = {
  hasTeeth: boolean;
  hasRegular: boolean;
};

export function prosbaLineIsTeethProduct(
  line: { subiektTwId?: number | null },
  exemptTwIds?: ReadonlySet<number>
): boolean {
  return isStockExemptTwId(line.subiektTwId, exemptTwIds);
}

export function classifyProsbaLinesByLane(
  lines: Array<{ subiektTwId?: number | null }>,
  exemptTwIds?: ReadonlySet<number>
): ProsbaLaneClassification {
  let hasTeeth = false;
  let hasRegular = false;
  for (const line of lines) {
    if (prosbaLineIsTeethProduct(line, exemptTwIds)) hasTeeth = true;
    else hasRegular = true;
  }
  return { hasTeeth, hasRegular };
}

function pluralPozycja(count: number): string {
  const n = Math.abs(Math.trunc(count));
  if (n === 1) return "pozycję";
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "pozycje";
  return "pozycji";
}

/** Komunikat sukcesu po zapisie prośby zakupowej (panel dzienny / quick order). */
export function procurementZamowienieSubmitSuccessMessage(
  count: number,
  lanes: ProsbaLaneClassification
): string {
  const n = Math.max(0, Math.trunc(count));
  if (n === 0) return "Zapisano prośbę.";
  const word = pluralPozycja(n);

  if (lanes.hasTeeth && !lanes.hasRegular) {
    return `Dodano ${n} ${word} do panelu zębów. ${TEETH_PROCUREMENT_PANEL_HINT}`;
  }
  if (lanes.hasTeeth && lanes.hasRegular) {
    return `Dodano ${n} ${word} — część trafi do panelu zębów, część do panelu dziennego.`;
  }
  return `Dodano ${n} pozycji do panelu dziennego.`;
}

export function procurementInformacjaSubmitSuccessMessage(
  count: number,
  options: {
    stockOutReorder?: boolean;
    viaDailyPanel?: boolean;
  }
): string | null {
  const n = Math.max(0, Math.trunc(count));
  if (options.stockOutReorder) {
    return `Dodano ${n} sygnał(ów) „brak na stanie” — w panelu Dziś (Prośby handlowców).`;
  }
  if (options.viaDailyPanel) {
    return `Dodano ${n} prośb(y) informacyjn(e) — najpierw kolejka Dziś (Główne/Uzupełniające).`;
  }
  if (n > 0) {
    return `Dodano ${n} prośb(y) informacyjn(e) — od razu do kolejki magazynu.`;
  }
  return null;
}

export function procurementSubmitSuccessMessage(options: {
  count: number;
  requestKind: IndividualRequestKind;
  lanes: ProsbaLaneClassification;
  informacjaStockOutReorder?: boolean;
  informacjaQueueViaDailyPanel?: boolean;
}): string {
  if (options.requestKind === "informacja") {
    return (
      procurementInformacjaSubmitSuccessMessage(options.count, {
        stockOutReorder: options.informacjaStockOutReorder,
        viaDailyPanel: options.informacjaQueueViaDailyPanel,
      }) ?? "Zapisano prośbę informacyjną."
    );
  }
  return procurementZamowienieSubmitSuccessMessage(options.count, options.lanes);
}

export function teethSalesOrderedStatusDetail(
  orderedAt: string | null,
  deliveryEta: string | null
): string {
  const parts: string[] = [];
  if (orderedAt) {
    parts.push(`Zamówiono ${formatPlDate(orderedAt.slice(0, 10))}`);
  }
  if (deliveryEta) {
    parts.push(`Planowana dostawa: ${formatPlDate(deliveryEta)}`);
  }
  if (parts.length === 0) {
    return "Lab przygotowuje zamówienie — termin dostawy pojawi się po ustaleniu z dostawcą.";
  }
  return parts.join(" · ");
}

export function prosbaReadinessTargetsTeethPanel(
  lines: Array<{ subiektTwId?: number | null }>,
  exemptTwIds?: ReadonlySet<number>
): boolean {
  const { hasTeeth, hasRegular } = classifyProsbaLinesByLane(lines, exemptTwIds);
  return hasTeeth && !hasRegular;
}
