import { describe, expect, it } from "vitest";
import { matchesIndividualSearch } from "./history-search";
import type { IndividualOrder } from "@/types/database";

const base = {
  id: "1",
  supplier_id: "s",
  sales_person_id: "p",
  symbol: "ABC-123",
  products: "Implant titanowy 4.2",
  quantity: "2",
  delivered_quantity: "-",
  order_type: "Glowne" as const,
  status: "Zrealizowane" as const,
  action_at: "2026-01-01",
  ordered_at: null,
  delivery_at: null,
} satisfies IndividualOrder;

describe("matchesIndividualSearch", () => {
  it("dopasowuje po nazwie produktu", () => {
    expect(matchesIndividualSearch(base, "implant")).toBe(true);
  });

  it("dopasowuje po symbolu", () => {
    expect(matchesIndividualSearch(base, "abc-123")).toBe(true);
  });

  it("zwraca wszystko przy pustym zapytaniu", () => {
    expect(matchesIndividualSearch(base, "")).toBe(true);
    expect(matchesIndividualSearch(base, "   ")).toBe(true);
  });

  it("nie dopasowuje nieistniejącego towaru", () => {
    expect(matchesIndividualSearch(base, "xyz brak")).toBe(false);
  });
});
