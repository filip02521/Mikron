import { describe, expect, it } from "vitest";
import {
  buildWarehouseInventoryRow,
  buildWarehouseInventoryRows,
  normalizeShelfLabel,
  summarizeWarehouseInventory,
  waitingLabel,
} from "./warehouse-inventory";
import type { IndividualOrder } from "@/types/database";

const base: IndividualOrder = {
  id: "1",
  supplier_id: "s1",
  sales_person_id: "sp1",
  symbol: "ABC",
  products: "Wkręt",
  quantity: "5",
  delivered_quantity: "5",
  order_type: "Glowne",
  request_kind: "zamowienie",
  status: "Zrealizowane",
  action_at: "2026-05-01T10:00:00Z",
  ordered_at: "2026-05-02",
  delivery_at: "2026-05-10T10:00:00Z",
  warehouse_shelf: "Regał B3",
  sales_person: { id: "sp1", name: "Jan Kowalski", email: "jan@firma.pl" },
  supplier: {
    id: "s1",
    name: "Dostawca",
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
  },
};

describe("warehouse inventory", () => {
  it("normalizuje pusty regał do Odbiór", () => {
    expect(normalizeShelfLabel(null)).toBe("Odbiór");
    expect(normalizeShelfLabel("  A1  ")).toBe("A1");
  });

  it("klasyfikuje pełny odbiór", () => {
    const row = buildWarehouseInventoryRow(base);
    expect(row?.kind).toBe("pickup_full");
    expect(row?.shelfLabel).toBe("Regał B3");
  });

  it("pomija zamówione u dostawcy", () => {
    expect(buildWarehouseInventoryRow({ ...base, status: "Zamowione" })).toBeNull();
  });

  it("liczy podsumowanie", () => {
    const rows = buildWarehouseInventoryRows([base]);
    const s = summarizeWarehouseInventory(rows);
    expect(s.total).toBe(1);
    expect(s.uniqueSalesPeople).toBe(1);
  });

  it("uwzględnia częściową dostawę z delivered > 0", () => {
    const row = buildWarehouseInventoryRow({
      ...base,
      status: "Czesciowo_zrealizowane",
      delivered_quantity: "2",
      quantity: "10",
      delivery_at: "2026-05-15T10:00:00Z",
    });
    expect(row?.kind).toBe("pickup_partial");
  });

  it("pomija informację niezrealizowaną", () => {
    expect(
      buildWarehouseInventoryRow({
        ...base,
        request_kind: "informacja",
        status: "Nowe",
      })
    ).toBeNull();
  });

  it("etykieta czasu dla częściowej zawiera dopisek", () => {
    const row = buildWarehouseInventoryRow({
      ...base,
      status: "Czesciowo_zrealizowane",
      delivered_quantity: "1",
      quantity: "5",
      delivery_at: "2026-05-10T10:00:00Z",
    });
    expect(row && waitingLabel(row)).toContain("od ostatniego przyjęcia");
  });
});
