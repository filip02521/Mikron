import { describe, expect, it } from "vitest";
import {
  canEditIndividualRequestGroup,
  isIndividualOrderEditable,
} from "./individual-request-edit";
import type { IndividualOrder } from "@/types/database";

function order(status: IndividualOrder["status"]): IndividualOrder {
  return {
    id: "o1",
    supplier_id: "s1",
    sales_person_id: "sp1",
    symbol: "A",
    products: "Produkt",
    quantity: "1",
    delivered_quantity: "-",
    order_type: "None",
    request_kind: "zamowienie",
    status,
    action_at: "",
    ordered_at: null,
  } as IndividualOrder;
}

describe("individual-request-edit", () => {
  it("pozwala edytować Nowe i Weryfikacja", () => {
    expect(isIndividualOrderEditable(order("Nowe"))).toBe(true);
    expect(isIndividualOrderEditable(order("Weryfikacja"))).toBe(true);
    expect(isIndividualOrderEditable(order("Zamowione"))).toBe(false);
  });

  it("blokuje edycję po wycofaniu przez handlowca", () => {
    expect(
      isIndividualOrderEditable({
        ...order("Nowe"),
        sales_cancelled_at: new Date().toISOString(),
      })
    ).toBe(false);
  });

  it("blokuje edycję po złożeniu u dostawcy (ordered_at)", () => {
    expect(
      isIndividualOrderEditable({
        ...order("Nowe"),
        ordered_at: "2026-05-15T10:00:00Z",
      })
    ).toBe(false);
  });

  it("grupa edytowalna tylko gdy wszystkie pozycje edytowalne", () => {
    expect(canEditIndividualRequestGroup([order("Nowe"), order("Nowe")])).toBe(true);
    expect(canEditIndividualRequestGroup([order("Nowe"), order("Zamowione")])).toBe(
      false
    );
  });
});
