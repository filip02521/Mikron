import { describe, expect, it } from "vitest";
import { formStateForNextEntry } from "@/lib/warehouse/delivery-journal-form";

describe("formStateForNextEntry", () => {
  it("czyści dostawcę i notatkę, zostawia kurier i liczby", () => {
    const previous = {
      supplierId: "sup-1",
      supplierOther: "Kurier X",
      carrier: "dpd" as const,
      shipmentForm: "paczki" as const,
      packageCount: "3",
      palletCount: "0",
      note: "rampa 2",
    };

    expect(formStateForNextEntry(previous)).toEqual({
      supplierId: "",
      supplierOther: "",
      carrier: "dpd",
      shipmentForm: "paczki",
      packageCount: "3",
      palletCount: "0",
      note: "",
    });
  });
});
