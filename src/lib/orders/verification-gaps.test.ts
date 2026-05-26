import { describe, expect, it } from "vitest";
import { describeVerificationGaps } from "./verification-gaps";
import type { IndividualOrder } from "@/types/database";

const base: IndividualOrder = {
  id: "1",
  supplier_id: null,
  sales_person_id: "sp",
  symbol: "-",
  products: "",
  quantity: "-",
  delivered_quantity: "-",
  order_type: "Glowne",
  request_kind: "zamowienie",
  status: "Weryfikacja",
  action_at: "2026-05-01",
  ordered_at: null,
  delivery_at: null,
};

describe("describeVerificationGaps", () => {
  it("opisuje pracę działu dostaw bez „Brakuje”", () => {
    const text = describeVerificationGaps(base);
    expect(text).toContain("Dział dostaw uzupełni:");
    expect(text).toContain("dostawcę");
    expect(text).toContain("nie musisz");
    expect(text).not.toContain("Brakuje:");
  });

  it("tylko dostawca — krótszy komunikat", () => {
    const text = describeVerificationGaps({
      ...base,
      symbol: "ABC",
      products: "Test",
      quantity: "1",
    });
    expect(text).toContain("Dział dostaw dopasuje dostawcę");
    expect(text).not.toContain("Brakuje:");
  });

  it("pending supplier — komunikat o dopasowaniu w tle", () => {
    const text = describeVerificationGaps({
      ...base,
      supplier_resolve_pending: true,
      symbol: "ABC",
      products: "Test",
      quantity: "1",
    });
    expect(text).toContain("Szukamy dostawcy");
    expect(text).not.toContain("Brakuje:");
  });

  it("nie wymaga ilości dla informacji", () => {
    const text = describeVerificationGaps({
      ...base,
      request_kind: "informacja",
      quantity: "-",
    });
    expect(text).not.toContain("ilość");
  });
});
