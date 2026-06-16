import { describe, expect, it } from "vitest";
import {
  createEmptyDeliveryJournalForm,
  formStateForNextEntry,
} from "./delivery-journal-form";

describe("createEmptyDeliveryJournalForm", () => {
  it("ustawia domyślny kurier z katalogu", () => {
    expect(createEmptyDeliveryJournalForm("dpd").carrier).toBe("dpd");
  });
});

describe("formStateForNextEntry", () => {
  it("czyści dostawcę i notatkę, zachowuje kurier i liczniki", () => {
    const next = formStateForNextEntry({
      supplierId: "abc",
      supplierOther: "",
      carrier: "dhl",
      shipmentForm: "palety",
      packageCount: "0",
      palletCount: "2",
      note: "list 123",
    });

    expect(next.supplierId).toBe("");
    expect(next.carrier).toBe("dhl");
    expect(next.palletCount).toBe("2");
    expect(next.note).toBe("");
  });
});
