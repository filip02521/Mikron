import {
  INFORMACJA_FLOW_DIRECT,
  INFORMACJA_FLOW_VIA_PANEL,
  INFORMACJA_STOCK_OUT_PROCUREMENT_SECTION_HINT,
} from "@/lib/orders/informacja-flow-copy";
import {
  flagsFromInformacjaFlowPath,
  informacjaFlowPathFromOrder,
  type InformacjaFlowPath,
} from "@/lib/orders/informacja-stock-out-reorder";
import { isInformacjaRequest } from "@/lib/orders/individual";
import type { IndividualOrder, IndividualRequestKind } from "@/types/database";

export type VerificationPathBadgeTone = "warning" | "info" | "violet" | "neutral";

export type VerificationInformacjaUi = {
  path: InformacjaFlowPath;
  badgeLabel: string;
  badgeTone: VerificationPathBadgeTone;
  queueHint: string;
  /** Ścieżka wybrana przez handlowca — zakupy nie zmieniają typu. */
  pathLocked: boolean;
  lockedReason: string | null;
  completeSuccessMessage: string;
  productSectionHint: string;
  destinationSummary: string;
};

function pathUi(path: InformacjaFlowPath, pathLocked: boolean): VerificationInformacjaUi {
  switch (path) {
    case "stock_out":
      return {
        path,
        badgeLabel: "Brak na stanie",
        badgeTone: "warning",
        queueHint: "Sygnał magazynowy — sekcja „Brak na stanie” w panelu Dziś",
        pathLocked: pathLocked,
        lockedReason: pathLocked
          ? "Handlowiec zgłosił brak na stanie. Po zatwierdzeniu trafi wyłącznie do sekcji „Brak na stanie” — nie do magazynu ani „Moje zamówienia” handlowca."
          : null,
        completeSuccessMessage:
          "Uzupełniono — sygnał trafi do sekcji „Brak na stanie” w panelu Dziś (Prośby handlowców).",
        productSectionHint:
          "Wystarczy nazwa lub symbol — bez ilości. Po Główne pozycja znika z listy (sygnał obsłużony).",
        destinationSummary: INFORMACJA_STOCK_OUT_PROCUREMENT_SECTION_HINT,
      };
    case "via_panel":
      return {
        path,
        badgeLabel: "Magazyn → info",
        badgeTone: "info",
        queueHint: "Najpierw zamówienie u dostawcy, potem e-mail z magazynu",
        pathLocked: pathLocked,
        lockedReason: pathLocked
          ? "Ścieżka „najpierw zamówienie u dostawcy” — po zatwierdzeniu trafi do Prośb handlowców, nie od razu do magazynu."
          : null,
        completeSuccessMessage:
          "Uzupełniono — prośba trafi do Prośb handlowców w panelu Dziś (najpierw Główne, potem magazyn).",
        productSectionHint:
          "Wystarczy nazwa lub symbol — bez ilości. Magazyn wyśle e-mail po zamówieniu u dostawcy.",
        destinationSummary: INFORMACJA_FLOW_VIA_PANEL.short,
      };
    default:
      return {
        path: "direct",
        badgeLabel: INFORMACJA_FLOW_DIRECT.label,
        badgeTone: "violet",
        queueHint: "Od razu kolejka magazynu — e-mail po przyjęciu towaru",
        pathLocked: false,
        lockedReason: null,
        completeSuccessMessage:
          "Uzupełniono — trafi do Wyjątków w panelu Dziś (kolejka informacji magazynu).",
        productSectionHint:
          "Wystarczy nazwa lub symbol — bez ilości. Magazyn obserwuje dostępność i wyśle e-mail.",
        destinationSummary: INFORMACJA_FLOW_DIRECT.short,
      };
  }
}

export function informacjaPathFromOrder(order: IndividualOrder): InformacjaFlowPath | null {
  if (!isInformacjaRequest(order)) return null;
  return informacjaFlowPathFromOrder(order) ?? "direct";
}

export function isVerificationInformacjaPathLocked(order: IndividualOrder): boolean {
  const path = informacjaPathFromOrder(order);
  return path === "stock_out" || path === "via_panel";
}

export function verificationInformacjaUiForOrder(
  order: IndividualOrder
): VerificationInformacjaUi | null {
  const path = informacjaPathFromOrder(order);
  if (!path) return null;
  return pathUi(path, isVerificationInformacjaPathLocked(order));
}

export function verificationInformacjaUiForDraft(input: {
  requestKind: IndividualRequestKind;
  informacjaPath: InformacjaFlowPath | null;
  sourceOrder: IndividualOrder | null;
}): VerificationInformacjaUi | null {
  if (input.requestKind !== "informacja") return null;
  const path =
    input.informacjaPath ??
    (input.sourceOrder ? informacjaPathFromOrder(input.sourceOrder) : null) ??
    "direct";
  const locked = input.sourceOrder
    ? isVerificationInformacjaPathLocked(input.sourceOrder)
    : false;
  return pathUi(path, locked);
}

export function resolveVerificationInformacjaFlags(input: {
  requestKind: IndividualRequestKind;
  informacjaPath: InformacjaFlowPath | null;
  priorOrder: IndividualOrder;
}): {
  informacjaQueueViaDailyPanel: boolean;
  informacjaStockOutReorder: boolean;
} {
  if (input.requestKind !== "informacja") {
    return { informacjaQueueViaDailyPanel: false, informacjaStockOutReorder: false };
  }
  const locked = isVerificationInformacjaPathLocked(input.priorOrder);
  const path = locked
    ? (informacjaPathFromOrder(input.priorOrder) ?? "direct")
    : (input.informacjaPath ?? informacjaPathFromOrder(input.priorOrder) ?? "direct");
  return flagsFromInformacjaFlowPath(path);
}

export function verificationQueueKindLabel(order: IndividualOrder): string | null {
  const ui = verificationInformacjaUiForOrder(order);
  if (ui) return ui.badgeLabel;
  if ((order.request_kind ?? "zamowienie") === "informacja") return "Informacja";
  return null;
}
