import { describe, expect, it } from "vitest";
import { lineStockStatus, presentMyOrder, presentMyOrders } from "./my-order-presenter";
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

describe("presentMyOrder", () => {
  it("preferuje termin z ZD Subiekta nad historią", () => {
    const row = presentMyOrders(
      [baseOrder],
      [
        {
          supplier_id: "sup1",
          main_avg: 5,
          main_count: 10,
          main_sum: 50,
          side_avg: null,
          side_count: null,
          side_sum: null,
        },
      ],
      {
        "1": {
          realizationDate: "2026-06-18",
          documentNumber: "ZD/99",
          matchedBy: "symbol",
        },
      }
    ).zamowienia[0];
    expect(row.timingLabel).toContain("Termin ZD ZD/99");
    expect(row.timingLabel).toContain("18.06.2026");
    expect(row.statusDetail).toContain("W Subiekcie jest ZD");
  });

  it("pokazuje szacowany termin dla zamówienia u dostawcy", () => {
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
    expect(row.statusTitle).toBe("Zamówione");
    expect(row.progressLabel).toBe("0 z 3 szt.");
    expect(row.timingLabel).toMatch(/ok\./);
    expect(row.timingLabel).toContain("dni rob");
    expect(row.headline).toBeTruthy();
  });

  it("wyjaśnia osobne domówienie (Poboczne) po polsku", () => {
    const row = presentMyOrder({ ...baseOrder, order_type: "Poboczne" }, {});
    expect(row.statusDetail).toContain("Osobne domówienie");
    expect(row.statusDetail).not.toContain("Uzupełnienie");
  });

  it("pokazuje postęp przy częściowej dostawie", () => {
    const row = presentMyOrders(
      [
        {
          ...baseOrder,
          status: "Czesciowo_zrealizowane",
          delivered_quantity: "2",
        },
      ],
      []
    ).zamowienia[0];
    expect(row.progressLabel).toBe("2 z 3 szt.");
    expect(row.statusTitle).toBe("Częściowo na magazynie");
    expect(row.headlineTone).toBe("warning");
  });

  it("upraszcza status informacji", () => {
    const row = presentMyOrders(
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
    expect(row.kind).toBe("informacja");
    expect(row.statusTitle).toBe("Oczekuje na dostawę");
    expect(row.badgeVariant).toBe("purple");
    expect(row.timingLabel).toBeNull();
  });

  it("informacja na magazynie ma tryb potwierdzenia powiadomienia", () => {
    const row = presentMyOrders(
      [
        {
          ...baseOrder,
          request_kind: "informacja",
          status: "Zrealizowane",
          quantity: "-",
          delivery_at: "2026-05-10",
        },
      ],
      []
    ).informacje[0];
    expect(row.statusTitle).toBe("Dostępne");
    expect(row.acknowledgeMode).toBe("availability");
    expect(row.pickupPendingCount).toBe(1);
    expect(row.headlineTone).toBe("action");
  });

  it("pokazuje osobny status gdy trwa dopasowanie dostawcy", () => {
    const row = presentMyOrders(
      [
        {
          ...baseOrder,
          status: "Weryfikacja",
          supplier_id: null,
          supplier: undefined,
          supplier_resolve_pending: true,
        },
      ],
      []
    ).zamowienia[0];
    expect(row.statusTitle).toBe("Dopasowujemy dostawcę");
    expect(row.supplierName).toContain("Dopasowywanie");
    expect(row.statusDetail).toContain("System dopasowuje dostawcę");
  });

  it("rozróżnia badge przed zamówieniem i zamówione", () => {
    const przed = presentMyOrders(
      [{ ...baseOrder, status: "Nowe", ordered_at: null, action_at: "2026-05-01" }],
      []
    ).zamowienia[0];
    const zamowione = presentMyOrders([baseOrder], []).zamowienia[0];
    expect(przed.statusTitle).toBe("Przed zamówieniem");
    expect(przed.badgeVariant).toBe("purple");
    expect(zamowione.statusTitle).toBe("Zamówione");
    expect(zamowione.badgeVariant).toBe("info");
  });

  it("grupuje kilka produktów z jednej dostawy w jeden wiersz", () => {
    const second = {
      ...baseOrder,
      id: "2",
      products: "Podkładka",
      ordered_at: baseOrder.ordered_at,
    };
    const row = presentMyOrders([baseOrder, second], [
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
    expect(row.lineCount).toBe(2);
    expect(row.timingLabel).toMatch(/ok\./);
    expect(row.lines).toHaveLength(2);
    expect(row.product).toContain("2 produkty");
  });

  it("oznacza pozycję na magazynie przy częściowej dostawie grupy", () => {
    const arrived = {
      ...baseOrder,
      id: "a",
      products: "Blacha",
      quantity: "2",
      delivered_quantity: "2",
      status: "Czesciowo_zrealizowane" as const,
    };
    const waiting = {
      ...baseOrder,
      id: "b",
      products: "Kartki",
      delivered_quantity: "0",
      status: "Czesciowo_zrealizowane" as const,
    };
    expect(lineStockStatus(arrived)).toBe("on_stock");
    expect(lineStockStatus(waiting)).toBe("waiting");

    const row = presentMyOrders([arrived, waiting], []).zamowienia[0];
    expect(row.lines.find((l) => l.id === "a")?.stockStatus).toBe("on_stock");
    expect(row.lines.find((l) => l.id === "b")?.stockStatus).toBe("waiting");
  });

  it("nadaje nagłówek akcji przy gotowości do odbioru", () => {
    const row = presentMyOrders(
      [{ ...baseOrder, status: "Zrealizowane" }],
      []
    ).zamowienia[0];
    expect(row.headline).toContain("Odbierz");
    expect(row.headlineTone).toBe("action");
    expect(row.sortPriority).toBe(1);
  });
});
