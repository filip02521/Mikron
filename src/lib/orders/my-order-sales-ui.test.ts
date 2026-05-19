import { describe, expect, it } from "vitest";
import { presentMyOrder, presentMyOrders } from "./my-order-presenter";
import {
  enrichMyOrderSalesUi,
  myOrderMetaFields,
  sortMyOrderRows,
  summarizeMyOrdersInbox,
} from "./my-order-sales-ui";
import type { IndividualOrder } from "@/types/database";

const baseOrder: IndividualOrder = {
  id: "1",
  supplier_id: "sup1",
  sales_person_id: "sp1",
  symbol: "ABC",
  products: "Wkręt",
  quantity: "3",
  delivered_quantity: "-",
  order_type: "Glowne",
  request_kind: "zamowienie",
  status: "Zamowione",
  action_at: "2026-04-28",
  ordered_at: "2026-05-01",
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
  },
};

describe("enrichMyOrderSalesUi", () => {
  it("priorytetyzuje odbiór z magazynu", () => {
    const row = presentMyOrders(
      [{ ...baseOrder, status: "Zrealizowane" }],
      []
    ).zamowienia[0];
    const ui = enrichMyOrderSalesUi(row);
    expect(ui.headline).toContain("Odbierz");
    expect(ui.headlineTone).toBe("action");
    expect(ui.sortPriority).toBe(1);
  });

  it("oznacza opóźnienie po terminie", () => {
    const row = presentMyOrder(baseOrder, {
      sup1: {
        supplier_id: "sup1",
        main_avg: 1,
        main_count: 5,
        main_sum: 5,
        side_avg: null,
        side_count: null,
        side_sum: null,
      },
    });
    const withUi = { ...row, ...enrichMyOrderSalesUi(row) };
    expect(withUi.headline).toBe("Po przewidywanym terminie");
    expect(withUi.headlineTone).toBe("warning");
  });
});

describe("sortMyOrderRows", () => {
  it("kładzie odbiór przed czekające zamówienie", () => {
    const ready = presentMyOrders(
      [{ ...baseOrder, id: "a", status: "Zrealizowane" }],
      []
    ).zamowienia[0];
    const waiting = presentMyOrders([{ ...baseOrder, id: "b" }], []).zamowienia[0];
    const sorted = sortMyOrderRows([waiting, ready]);
    expect(sorted[0].acknowledgeMode).toBe("pickup");
  });
});

describe("summarizeMyOrdersInbox", () => {
  it("liczy karty do odbioru", () => {
    const row = presentMyOrders(
      [{ ...baseOrder, status: "Zrealizowane" }],
      []
    ).zamowienia[0];
    const s = summarizeMyOrdersInbox([row]);
    expect(s.pickupCount).toBe(1);
  });

  it("nie liczy prośby o dostępność jako zamówienie w toku", () => {
    const informacja = presentMyOrders(
      [
        {
          ...baseOrder,
          request_kind: "informacja",
          status: "Nowe",
          quantity: "-",
        },
      ],
      []
    ).informacje[0];
    const zamowienie = presentMyOrders([baseOrder], []).zamowienia[0];
    const s = summarizeMyOrdersInbox([informacja, zamowienie, zamowienie]);
    expect(s.zamowioneCount).toBe(2);
    expect(s.przedZamowieniemCount).toBe(0);
    expect(s.availabilityPendingCount).toBe(1);
  });
});

describe("enrichMyOrderSalesUi — termin", () => {
  it("nie powtarza komunikatu o braku terminu, gdy jest szacunek", () => {
    const row = presentMyOrders([baseOrder], [
      {
        supplier_id: "sup1",
        main_avg: 5,
        main_count: 10,
        main_sum: 50,
        side_avg: null,
        side_count: null,
        side_sum: null,
      },
    ]).zamowienia[0];
    const ui = enrichMyOrderSalesUi(row);
    expect(row.timingLabel).toBeTruthy();
    expect(ui.subline ?? "").not.toContain("Termin pojawi się");
    expect(ui.subline ?? "").not.toContain("historię realizacji");
  });
});

describe("myOrderMetaFields", () => {
  it("ma czytelne etykiety magazyn i szacunek", () => {
    const row = presentMyOrders([baseOrder], [
      {
        supplier_id: "sup1",
        main_avg: 5,
        main_count: 10,
        main_sum: 50,
        side_avg: null,
        side_count: null,
        side_sum: null,
      },
    ]).zamowienia[0];
    const fields = myOrderMetaFields(row, true);
    expect(fields.some((f) => f.label === "Magazyn")).toBe(true);
    expect(fields.some((f) => f.label === "Szacunek" || f.label === "Termin")).toBe(
      true
    );
  });
});
