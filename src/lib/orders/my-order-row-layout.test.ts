import { describe, expect, it } from "vitest";
import type { MyOrderRow } from "./my-order-presenter";
import {
  myOrderCollapsedProductMode,
  myOrderCollapsedSubline,
  myOrderExpandedNotes,
  myOrderExpandHint,
  myOrderNeedsExpand,
} from "./my-order-row-layout";

function row(extra: Partial<MyOrderRow> = {}): MyOrderRow {
  return {
    id: "1",
    kind: "zamowienie",
    lineCount: 1,
    lines: [
      {
        id: "l1",
        product: "Produkt A",
        symbol: "SYM",
        quantityLabel: "2 szt.",
        progressLabel: null,
        stockStatus: "waiting",
        clientName: null,
        canAcknowledgePickup: false,
      },
    ],
    submittedLabel: "01.05",
    supplierName: "Dostawca",
    product: "Produkt A",
    symbol: "SYM",
    quantityLabel: "2 szt.",
    progressLabel: null,
    statusTitle: "Zamówione",
    statusDetail: null,
    timingLabel: "ok. 10.05.2026 (~5 dni rob.)",
    badgeVariant: "info",
    rowColor: "#fff",
    orderIds: ["1"],
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
    supplierId: "s",
    salesPersonId: "sp",
    requestKind: "zamowienie",
    canEditBySales: false,
    headline: "Zamówione — czekamy na dostawę",
    headlineTone: "info",
    subline: "Mało dostaw w historii — termin jest orientacyjny",
    ...extra,
  };
}

describe("my-order-row-layout", () => {
  it("długi subline zamówienia trafia do expandedNotes, nie do collapsed", () => {
    const r = row();
    expect(myOrderCollapsedSubline(r)).toBeNull();
    expect(myOrderExpandedNotes(r)).toContain("Mało dostaw w historii");
  });

  it("weryfikacja — skrót na liście bez powtórzenia w expanded", () => {
    const r = row({
      statusTitle: "Uzupełnianie danych",
      statusDetail:
        "Brakuje: dostawca. Dział dostaw uzupełni to w systemie — nie musisz nic robić.",
      subline: "Brakuje: dostawca — dział dostaw uzupełni",
    });
    expect(myOrderCollapsedSubline(r)).toContain("Brakuje: dostawca");
    expect(myOrderExpandedNotes(r)).toBeNull();
  });

  it("zamówienie z wieloma pozycjami wymaga rozwinięcia i skrótu produktów", () => {
    const r = row({
      lineCount: 3,
      lines: [
        row().lines[0],
        { ...row().lines[0], id: "l2", product: "B" },
        { ...row().lines[0], id: "l3", product: "C" },
      ],
    });
    expect(
      myOrderNeedsExpand(r, { listKind: "zamowienie", showGroupPickup: false })
    ).toBe(true);
    expect(myOrderCollapsedProductMode(r, "zamowienie")).toBe("summary");
    expect(myOrderExpandHint(r, { listKind: "zamowienie", showGroupPickup: false })).toBe(
      "Rozwiń 3 produkty"
    );
  });

  it("informacja „Oczekuje na dostawę” nie powiela wyjaśnienia pod nagłówkiem", () => {
    const r = row({
      kind: "informacja",
      requestKind: "informacja",
      statusTitle: "Oczekuje na dostawę",
      subline: null,
      headline: "Powiadomimy, gdy towar przyjedzie",
      headlineTone: "neutral",
      statusDetail:
        "Nie składamy zamówienia u dostawcy. Wyślemy e-mail, gdy towar pojawi się na magazynie.",
    });
    expect(myOrderCollapsedSubline(r)).toBeNull();
    expect(
      myOrderNeedsExpand(r, { listKind: "informacja", showGroupPickup: false })
    ).toBe(false);
  });
});
