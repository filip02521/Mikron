import { describe, expect, it } from "vitest";
import { editInitialFromForSomeoneGroup, editInitialFromMyOrderRow } from "./individual-request-edit-ui";
import type { SummaryForSomeoneEnriched } from "./summary-workspace";
import type { MyOrderRow } from "./my-order-presenter";

function forSomeoneGroup(
  lines: SummaryForSomeoneEnriched["lines"]
): SummaryForSomeoneEnriched {
  return {
    kind: "forSomeone",
    supplierId: "s1",
    salesPersonId: "sp1",
    supplierName: "Dostawca",
    flaggedName: "Dostawca",
    location: "POLSKA",
    person: "Jan",
    displayText: "Jan",
    hoverNote: "",
    lines,
    orderIds: lines.map((l) => l.id),
    shift: "[DLA KOGOŚ]" as const,
    status: "Nowe",
    nextDate: new Date(),
    submittedAt: "2026-05-01",
    submittedAtLatest: "2026-05-01",
    hasUnseen: false,
    unseenCount: 0,
    supplierOrderOnDemand: false,
  };
}

describe("editInitialFromForSomeoneGroup", () => {
  it("rozpoznaje prośbę informacyjną — brak na stanie", () => {
    const initial = editInitialFromForSomeoneGroup(
      forSomeoneGroup([
        {
          id: "1",
          products: "Towar",
          symbol: "X",
          quantity: "-",
          fromSubiekt: false,
          submittedAt: "2026-05-01",
          informacjaStockOut: true,
        },
      ])
    );
    expect(initial.requestKind).toBe("informacja");
    expect(initial.informacjaPath).toBe("stock_out");
  });

  it("rozpoznaje zamówienie w [DLA KOGOŚ]", () => {
    const initial = editInitialFromForSomeoneGroup(
      forSomeoneGroup([
        {
          id: "2",
          products: "Towar",
          symbol: "Y",
          quantity: "2",
          fromSubiekt: true,
          submittedAt: "2026-05-01",
        },
      ])
    );
    expect(initial.requestKind).toBe("zamowienie");
    expect(initial.informacjaPath).toBeUndefined();
  });

  it("mapuje klienta końcowego z linii panelu dziennego", () => {
    const initial = editInitialFromForSomeoneGroup(
      forSomeoneGroup([
        {
          id: "3",
          products: "Towar",
          symbol: "Z",
          quantity: "1",
          fromSubiekt: true,
          submittedAt: "2026-05-01",
          clientName: "Klinika ABC",
          clientKhId: 42,
        },
      ])
    );
    expect(initial.lines[0]?.clientName).toBe("Klinika ABC");
    expect(initial.lines[0]?.clientKhId).toBe(42);
  });

  it("mapuje notatkę handlowca na linię", () => {
    const initial = editInitialFromForSomeoneGroup(
      forSomeoneGroup([
        {
          id: "4",
          products: "Towar",
          symbol: "N",
          quantity: "1",
          fromSubiekt: true,
          submittedAt: "2026-05-01",
          requestNote: "  pilne — termin piątek  ",
        },
      ])
    );
    expect(initial.lines[0]?.requestNote).toBe("pilne — termin piątek");
  });

  it("zachowuje różne notatki na liniach", () => {
    const initial = editInitialFromForSomeoneGroup(
      forSomeoneGroup([
        {
          id: "5",
          products: "A",
          symbol: "A",
          quantity: "1",
          fromSubiekt: true,
          submittedAt: "2026-05-01",
          requestNote: "notatka A",
        },
        {
          id: "6",
          products: "B",
          symbol: "B",
          quantity: "1",
          fromSubiekt: true,
          submittedAt: "2026-05-01",
          requestNote: "notatka B",
        },
      ])
    );
    expect(initial.lines[0]?.requestNote).toBe("notatka A");
    expect(initial.lines[1]?.requestNote).toBe("notatka B");
  });
});

function myOrderRow(partial: Partial<MyOrderRow>): MyOrderRow {
  return {
    id: "row-1",
    kind: "informacja",
    lineCount: 1,
    lines: [],
    submittedLabel: "01.05.2026",
    supplierName: "Dostawca",
    product: "Towar",
    symbol: "X",
    quantityLabel: "-",
    progressLabel: null,
    statusTitle: "Status",
    statusDetail: null,
    timingLabel: null,
    badgeVariant: "info",
    rowColor: "#fff",
    orderIds: ["ord-1"],
    acknowledgeMode: "none",
    pickupPendingCount: 0,
    pickupPendingIds: [],
    pickupReadyTotal: 0,
    pickupAcknowledgedCount: 0,
    canCancelBySales: false,
    salesCancelPhase: null,
    salesCancelOrderIds: [],
    cancelNoticeOrderIds: [],
    cancelledAckOrderIds: [],
    clientLabel: null,
    requestNote: null,
    procurementCancelNote: null,
    supplierId: "sup-1",
    salesPersonId: "sp-1",
    requestKind: "informacja",
    canEditBySales: true,
    ...partial,
  };
}

describe("editInitialFromMyOrderRow", () => {
  it("mapuje ścieżkę informacji z wiersza Moje zamówienia", () => {
    const initial = editInitialFromMyOrderRow(
      myOrderRow({ requestKind: "informacja", informacjaPath: "stock_out" })
    );
    expect(initial?.requestKind).toBe("informacja");
    expect(initial?.informacjaPath).toBe("stock_out");
  });

  it("domyślnie ustawia direct dla prośby informacyjnej bez ścieżki", () => {
    const initial = editInitialFromMyOrderRow(
      myOrderRow({ requestKind: "informacja", informacjaPath: undefined })
    );
    expect(initial?.informacjaPath).toBe("direct");
  });

  it("mapuje pustą notatkę na linię gdy brak uwag", () => {
    const initial = editInitialFromMyOrderRow(
      myOrderRow({
        lines: [
          {
            id: "ord-1",
            product: "Towar A",
            symbol: "A",
            subiektTwId: null,
            mikranCode: null,
            quantity: "1",
            quantityLabel: "1 szt.",
            progressLabel: null,
            stockStatus: "waiting",
            canAcknowledgePickup: false,
            canCancelBySales: false,
            salesCancelPhase: null,
            maxSalesCancelQuantity: null,
            defaultSalesCancelQuantity: null,
            canPartialSalesCancel: false,
            showSalesCancelRemainder: false,
            showSalesCancelSupplierQuick: false,
            salesCancelDeliveredQty: 0,
            salesCancelUndoRestore: { status: "Nowe", quantity: "1", delivered_quantity: "0" },
            clientName: null,
            clientKhId: null,
            requestNote: null,
            procurementCancelNote: null,
          },
        ],
        lineCount: 1,
      })
    );
    expect(initial?.lines[0]?.requestNote).toBe("");
  });
});
