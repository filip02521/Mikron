import { describe, expect, it } from "vitest";
import {
  WAREHOUSE_CARRIERS,
  isWarehouseCarrier,
  parseWarehouseCarrier,
  parseWarehouseShipmentForm,
  warehouseCarrierLabel,
} from "./delivery-carriers";

describe("WAREHOUSE_CARRIERS", () => {
  it("ma unikalne wartości enum", () => {
    const values = WAREHOUSE_CARRIERS.map((c) => c.value);
    expect(new Set(values).size).toBe(values.length);
  });

  it("zawiera kurierów z dotychczasowej ewidencji", () => {
    for (const value of [
      "dpd",
      "dhl",
      "ups",
      "inpost",
      "kuehne_nagel",
      "mikran_bartek",
      "inne",
    ] as const) {
      expect(isWarehouseCarrier(value)).toBe(true);
      expect(warehouseCarrierLabel(value)).not.toBe(value);
    }
  });

  it("zwraca etykietę lub surową wartość", () => {
    expect(warehouseCarrierLabel("dpd")).toBe("DPD");
    expect(warehouseCarrierLabel("nieznany")).toBe("nieznany");
  });
});

describe("parseWarehouseCarrier", () => {
  it("akceptuje wartość z listy", () => {
    expect(parseWarehouseCarrier("dhl_express")).toBe("dhl_express");
  });

  it("rzuca czytelny błąd", () => {
    expect(() => parseWarehouseCarrier("kurier_xyz")).toThrow(/Nieprawidłowy kurier/);
  });
});

describe("parseWarehouseShipmentForm", () => {
  it("akceptuje paczki", () => {
    expect(parseWarehouseShipmentForm("paczki")).toBe("paczki");
  });

  it("rzuca czytelny błąd", () => {
    expect(() => parseWarehouseShipmentForm("kontener")).toThrow(
      /Nieprawidłowa forma dostawy/
    );
  });
});
