import { describe, expect, it } from "vitest";
import type { MyOrderRow } from "./my-order-presenter";
import {
  myOrderCollapsedMetaFields,
  myOrderCollapsedProductMode,
  myOrderCollapsedProductSummary,
  myOrderCollapsedSubline,
  myOrderExpandedNotes,
  myOrderExpandHint,
  myOrderNeedsExpand,
} from "./my-order-row-layout";
import { presentMyOrders } from "./my-order-presenter";
import type { IndividualOrder } from "@/types/database";
import { myOrderExpandedMetaFields } from "./my-order-sales-ui";

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
        subiektTwId: null,
        mikranCode: null,
        quantity: "2",
        quantityLabel: "2 szt.",
        progressLabel: null,
        stockStatus: "waiting",
        clientName: null,
        clientKhId: null,
        canAcknowledgePickup: false,
        canCancelBySales: false,
        salesCancelPhase: null,
        maxSalesCancelQuantity: null,
        defaultSalesCancelQuantity: null,
        canPartialSalesCancel: false,
        showSalesCancelRemainder: false,
        showSalesCancelSupplierQuick: false,
        salesCancelDeliveredQty: 0,
        salesCancelUndoRestore: {},
        requestNote: null,
        procurementCancelNote: null,
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
    requestNote: null,
    procurementCancelNote: null,
    ...extra,
  };
}

describe("my-order-row-layout", () => {
  it("długi subline zamówienia trafia do metadanych, nie do osobnej notatki", () => {
    const r = row();
    expect(myOrderCollapsedSubline(r)).toBe(r.subline);
    expect(myOrderExpandedNotes(r)).toBeNull();
  });

  it("pokazuje subline przy opóźnieniu i częściowej dostawie", () => {
    expect(
      myOrderCollapsedSubline(
        row({
          headlineTone: "warning",
          headline: "Po przewidywanym terminie",
          subline: "ok. 10.05.2026 (~5 dni rob.)",
        })
      )
    ).toBe("ok. 10.05.2026 (~5 dni rob.)");
    expect(
      myOrderCollapsedSubline(
        row({
          statusTitle: "Częściowo na magazynie",
          subline: "Magazyn: 5/8 szt. · 2 prod.",
        })
      )
    ).toBe("Produkt A · Magazyn: 5/8 szt. · 2 prod.");
  });

  it("weryfikacja — skrót na liście bez powtórzenia w expanded", () => {
    const r = row({
      statusTitle: "W dziale dostaw",
      statusDetail:
        "Dział dostaw dopasuje dostawcę. Prośba jest zapisana — nie musisz nic uzupełniać.",
      subline: "Zakupy dopasują dostawcę — bez Twojej akcji",
    });
    expect(myOrderCollapsedSubline(r)).toContain("Zakupy dopasują dostawcę");
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

  it("informacja „Oczekuje na magazyn” — wyjaśnienie w rozwinięciu, wiersz zwijany", () => {
    const r = row({
      kind: "informacja",
      requestKind: "informacja",
      statusTitle: "Oczekuje na magazyn",
      subline: null,
      headline: "Powiadomimy, gdy towar przyjedzie",
      headlineTone: "neutral",
      statusDetail:
        "Nie składamy zamówienia u dostawcy. Wyślemy e-mail, gdy towar pojawi się na magazynie.",
    });
    expect(myOrderCollapsedSubline(r)).toBeNull();
    expect(
      myOrderNeedsExpand(r, { listKind: "informacja", showGroupPickup: false })
    ).toBe(true);
    expect(myOrderCollapsedSubline(r)).toBeNull();
  });

  it("wielu terminów ZD — podpowiedź rozwinięcia zamiast liczby produktów", () => {
    const r = row({
      zdFulfillment: {
        deadline: "2026-07-15",
        dokNr: "ZD/1",
        syncedAt: null,
        source: "zd",
        slots: [
          { deadline: "2026-07-15", dokNr: "ZD/1", count: 1 },
          { deadline: "2026-07-22", dokNr: "ZD/2", count: 1 },
        ],
      },
    });
    expect(myOrderExpandHint(r, { listKind: "zamowienie", showGroupPickup: false })).toBe(
      "Rozwiń po oba terminy"
    );
  });

  it("grupa mieszana ZD + brak terminu — podpowiedź o wszystkich terminach", () => {
    const r = row({
      zdFulfillment: {
        deadline: "2026-06-24",
        dokNr: "ZD/1",
        syncedAt: null,
        source: "zd",
      },
      lines: [
        {
          ...row().lines[0]!,
          id: "l1",
          zdEtaNoMatch: true,
          historyEstimateLabel: "ok. 22.06.2026 (~5 dni rob.)",
        },
        {
          ...row().lines[0]!,
          id: "l2",
          product: "B",
          zdFulfillment: {
            deadline: "2026-06-24",
            dokNr: "ZD/1",
            syncedAt: null,
            source: "zd",
          },
        },
      ],
      lineCount: 2,
    });
    expect(myOrderExpandHint(r, { listKind: "zamowienie", showGroupPickup: false })).toBe(
      "Rozwiń po wszystkie terminy"
    );
  });

  it("pojedyncza prośba — skrót bez nazwy produktu na liście", () => {
    const r = row({ subline: null });
    expect(myOrderCollapsedProductMode(r, "zamowienie")).toBe("summary");
    expect(myOrderCollapsedProductSummary(r, "zamowienie")).toBe("1 produkt");
    expect(myOrderExpandHint(r, { listKind: "zamowienie", showGroupPickup: false })).toBe(
      "Rozwiń produkt"
    );
  });

  it("„Zamówione” na czas — termin na zwiniętym wierszu", () => {
    const r = row({
      statusTitle: "Zamówione",
      headline: "Zamówione — czekamy na dostawę",
      headlineTone: "info",
      timingLabel: "ok. 20.06.2026 (~8 dni rob.)",
      subline: null,
    });
    expect(myOrderCollapsedSubline(r)).toBe("Produkt A");
  });

  it("zamowione z ostrzezeniem o historii — subline ma pierwszenstwo przed terminem", () => {
    const r = row({
      statusTitle: "Zamówione",
      headlineTone: "info",
      timingLabel: "ok. 20.06.2026 (~8 dni rob.) · mało historii",
      subline: "Mało dostaw w historii — termin jest orientacyjny",
    });
    expect(myOrderCollapsedSubline(r)).toBe(
      "Mało dostaw w historii — termin jest orientacyjny"
    );
  });

  it("po terminie — towar na zwiniętym wierszu zamiast terminu", () => {
    const r = row({
      lineCount: 4,
      lines: Array.from({ length: 4 }, (_, i) => ({
        ...row().lines[0],
        id: `l${i}`,
        product: `P${i}`,
      })),
      headlineTone: "warning",
      timingLabel: "ok. 10.05.2026 (~5 dni rob.) · po terminie",
      subline: null,
    });
    expect(myOrderCollapsedSubline(r)).toBe("P0");
    const collapsed = myOrderCollapsedMetaFields(r, true);
    expect(collapsed.some((f) => f.label === "Termin")).toBe(false);
    expect(collapsed.some((f) => f.label === "Szacunek")).toBe(false);
  });

  it("typ i zamówienie ze statusDetail trafiają do metadanych bez powtórzenia w notatce", () => {
    const baseOrder: IndividualOrder = {
      id: "1",
      supplier_id: "sup1",
      sales_person_id: "sp1",
      symbol: "ABC",
      products: "Wkręt",
      quantity: "3",
      delivered_quantity: "-",
      order_type: "Poboczne",
      request_kind: "zamowienie",
      status: "Zamowione",
      action_at: "2026-04-28",
      ordered_at: "2026-05-06",
      delivery_at: null,
      supplier: {
        id: "sup1",
        name: "Dostawca X",
        location: "POLSKA",
        pickup_mikran: false,
        pickup_pallet: false,
        notes: "",
        mails: "",
        extra_info: "",
        interval_raw: null,
        interval_weeks: null,
        stock_raw: null,
        stock: null,
        stats_mode: "LACZNIE",
        order_on_demand: false,
        is_active: true,
      },
    };
    const r = presentMyOrders([baseOrder], [
      {
        supplier_id: "sup1",
        main_avg: 13,
        main_count: 10,
        main_sum: 130,
        side_avg: 13,
        side_count: 5,
        side_sum: 65,
      },
    ]).zamowienia[0];

    const meta = myOrderExpandedMetaFields(r, true);
    expect(meta.some((f) => f.label === "Typ" && f.value === "Poza planem")).toBe(true);
    expect(meta.some((f) => f.label === "Zamówiono" && f.value === "06.05.2026")).toBe(true);
    expect(myOrderExpandedNotes(r)).toBeNull();
  });
});
