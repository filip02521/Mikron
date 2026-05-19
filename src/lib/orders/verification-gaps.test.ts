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
  it("wymienia brakujące pola", () => {
    const text = describeVerificationGaps(base);
    expect(text).toContain("dostawca");
    expect(text).toContain("opis produktu");
    expect(text).toContain("ilość");
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
