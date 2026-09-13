import { describe, expect, it } from "vitest";
import { applyAdminFormToSupplierRow } from "./admin-form";
import {
  normalizeMinOrderCurrency,
  normalizeMinOrderValue,
} from "./min-order-currency";
import { testSupplierWithSchedule } from "@/test-utils/fixtures";

describe("applyAdminFormToSupplierRow", () => {
  it("aktualizuje pola karty z formularza", () => {
    const row = testSupplierWithSchedule({
      id: "1",
      name: "Stary",
      notes: "tel",
      subiekt_kh_id: null,
    });
    const next = applyAdminFormToSupplierRow(row, {
      id: "1",
      name: "Nowy",
      location: "ZAGRANICA",
      pickup_mikran: true,
      pickup_pallet: false,
      notes: "mail",
      mails: "a@b.c",
      extra_info: "info",
      interval_raw: "3 tyg",
      stock_raw: "1 mies",
      stats_mode: "LACZNIE",
      order_on_demand: true,
      is_active: true,
      subiekt_kh_id: 42,
      default_delivery_carrier: "DHL",
      default_delivery_shipment_form: "paleta",
      min_order_value: 500,
      min_order_currency: "PLN",
    });
    expect(next.name).toBe("Nowy");
    expect(next.location).toBe("ZAGRANICA");
    expect(next.notes).toBe("mail");
    expect(next.subiekt_kh_id).toBe(42);
    expect(next.min_order_value).toBe(500);
    expect(next.min_order_currency).toBe("PLN");
    expect(next.schedule).toEqual(row.schedule);
  });

  it("normalizuje min_order_value=0 do null i czyści walutę", () => {
    const row = testSupplierWithSchedule({ id: "1", name: "X" });
    const next = applyAdminFormToSupplierRow(row, {
      id: "1",
      name: "X",
      location: "POLSKA",
      pickup_mikran: false,
      pickup_pallet: false,
      notes: "",
      mails: "",
      extra_info: "",
      interval_raw: "",
      stock_raw: "",
      stats_mode: "LACZNIE",
      order_on_demand: false,
      is_active: true,
      subiekt_kh_id: null,
      default_delivery_carrier: "",
      default_delivery_shipment_form: "",
      min_order_value: 0,
      min_order_currency: "PLN",
    });
    expect(next.min_order_value).toBeNull();
    expect(next.min_order_currency).toBeNull();
  });

  it("defaultuje walutę do PLN gdy wartość ustawiona, a waluta pusta", () => {
    const row = testSupplierWithSchedule({ id: "1", name: "X" });
    const next = applyAdminFormToSupplierRow(row, {
      id: "1",
      name: "X",
      location: "POLSKA",
      pickup_mikran: false,
      pickup_pallet: false,
      notes: "",
      mails: "",
      extra_info: "",
      interval_raw: "",
      stock_raw: "",
      stats_mode: "LACZNIE",
      order_on_demand: false,
      is_active: true,
      subiekt_kh_id: null,
      default_delivery_carrier: "",
      default_delivery_shipment_form: "",
      min_order_value: 300,
      min_order_currency: "",
    });
    expect(next.min_order_value).toBe(300);
    expect(next.min_order_currency).toBe("PLN");
  });
});

describe("normalizeMinOrderValue", () => {
  it("zwraca null dla null/0/ujemnych/NaN", () => {
    expect(normalizeMinOrderValue(null)).toBeNull();
    expect(normalizeMinOrderValue(undefined)).toBeNull();
    expect(normalizeMinOrderValue(0)).toBeNull();
    expect(normalizeMinOrderValue(-1)).toBeNull();
    expect(normalizeMinOrderValue(NaN)).toBeNull();
    expect(normalizeMinOrderValue(Infinity)).toBeNull();
  });

  it("zaokrągla do 2 miejsc po przecinku", () => {
    expect(normalizeMinOrderValue(500.005)).toBe(500.01);
    expect(normalizeMinOrderValue(500.004)).toBe(500);
  });

  it("capuje do MAX_MIN_ORDER_VALUE", () => {
    expect(normalizeMinOrderValue(999999999)).toBe(999999.99);
  });

  it("akceptuje string z bazy (NUMERIC)", () => {
    expect(normalizeMinOrderValue("500.00" as unknown as number)).toBe(500);
    expect(normalizeMinOrderValue("0" as unknown as number)).toBeNull();
  });
});

describe("normalizeMinOrderCurrency", () => {
  it("zwraca null gdy brak wartości minimum", () => {
    expect(normalizeMinOrderCurrency("PLN", null)).toBeNull();
    expect(normalizeMinOrderCurrency("EUR", null)).toBeNull();
  });

  it("defaultuje do PLN gdy pusta waluta", () => {
    expect(normalizeMinOrderCurrency("", 500)).toBe("PLN");
    expect(normalizeMinOrderCurrency(null, 500)).toBe("PLN");
  });

  it("akceptuje znane kody i uppercase", () => {
    expect(normalizeMinOrderCurrency("eur", 500)).toBe("EUR");
    expect(normalizeMinOrderCurrency("PLN", 500)).toBe("PLN");
  });

  it("odrzuca nieznane kody na korzyść PLN", () => {
    expect(normalizeMinOrderCurrency("XYZ", 500)).toBe("PLN");
    expect(normalizeMinOrderCurrency("BITCOIN", 500)).toBe("PLN");
  });
});
