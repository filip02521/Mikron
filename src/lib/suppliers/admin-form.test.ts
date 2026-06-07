import { describe, expect, it } from "vitest";
import { applyAdminFormToSupplierRow } from "./admin-form";
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
    });
    expect(next.name).toBe("Nowy");
    expect(next.location).toBe("ZAGRANICA");
    expect(next.notes).toBe("mail");
    expect(next.subiekt_kh_id).toBe(42);
    expect(next.schedule).toEqual(row.schedule);
  });
});
