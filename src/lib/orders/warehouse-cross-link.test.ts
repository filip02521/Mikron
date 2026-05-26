import { describe, expect, it } from "vitest";
import { partialReceiveCrossLabel, partialShelfCrossLabel } from "./warehouse-cross-link";
import type { IndividualOrder } from "@/types/database";

const partial: IndividualOrder = {
  id: "1",
  supplier_id: "s1",
  sales_person_id: "sp1",
  symbol: "-",
  products: "P",
  quantity: "10",
  delivered_quantity: "3",
  order_type: "None",
  request_kind: "zamowienie",
  status: "Czesciowo_zrealizowane",
  action_at: "",
  ordered_at: null,
  delivery_at: null,
};

describe("warehouse cross-link labels", () => {
  it("receive label łączy regał i brak u dostawcy", () => {
    expect(partialReceiveCrossLabel(partial)).toBe(
      "3 szt. na regale · brakuje 7 u dostawcy"
    );
  });

  it("shelf label pokazuje resztę u dostawcy", () => {
    expect(partialShelfCrossLabel(partial)).toBe("U dostawcy jeszcze 7 szt.");
  });
});
