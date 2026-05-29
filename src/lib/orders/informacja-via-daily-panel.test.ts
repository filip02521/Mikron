import { describe, expect, it } from "vitest";
import {
  canShowInForSomeoneLeft,
  isInformacjaDeferredFromWarehouse,
  isInformacjaQueueViaDailyPanel,
} from "./informacja-via-daily-panel";
import type { IndividualOrder } from "@/types/database";

const base = {
  id: "1",
  supplier_id: "s1",
  sales_person_id: "sp1",
  symbol: "ABC",
  products: "Produkt test",
  quantity: "-",
  status: "Nowe" as const,
  order_type: "None" as const,
  request_kind: "informacja" as const,
  informacja_queue_via_daily_panel: true,
};

describe("informacja via daily panel", () => {
  it("rozpoznaje flagę", () => {
    expect(isInformacjaQueueViaDailyPanel(base)).toBe(true);
    expect(isInformacjaDeferredFromWarehouse(base)).toBe(true);
  });

  it("pokazuje w ForSomeone gdy kompletne", () => {
    expect(canShowInForSomeoneLeft(base as IndividualOrder)).toBe(true);
  });

  it("nie pokazuje bez dostawcy", () => {
    expect(
      canShowInForSomeoneLeft({ ...base, supplier_id: null } as IndividualOrder)
    ).toBe(false);
  });

  it("po zwolnieniu flagi nie blokuje magazynu", () => {
    expect(
      isInformacjaDeferredFromWarehouse({
        ...base,
        informacja_queue_via_daily_panel: false,
      } as IndividualOrder)
    ).toBe(false);
  });
});
