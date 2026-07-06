import { describe, expect, it } from "vitest";
import { isSubiektVerifiedOrder, mapOrderToForSomeoneLine } from "./product-source";
import type { IndividualOrder } from "@/types/database";

const base: IndividualOrder = {
  id: "1",
  supplier_id: "s",
  sales_person_id: "sp",
  symbol: "A",
  products: "Wkręt",
  quantity: "1",
  delivered_quantity: "-",
  order_type: "None",
  request_kind: "zamowienie",
  status: "Nowe",
  action_at: "2026-05-01",
  ordered_at: null,
  delivery_at: null,
};

describe("product source", () => {
  it("rozpoznaje Subiekt po tw_Id", () => {
    expect(isSubiektVerifiedOrder({ ...base, subiekt_tw_id: 42 })).toBe(true);
    expect(isSubiektVerifiedOrder(base)).toBe(false);
    expect(isSubiektVerifiedOrder({ ...base, subiekt_tw_id: 0 })).toBe(false);
  });

  it("mapuje linię panelu dziennego", () => {
    const line = mapOrderToForSomeoneLine({ ...base, subiekt_tw_id: 7 });
    expect(line.fromSubiekt).toBe(true);
    expect(line.subiektTwId).toBe(7);
    expect(line.submittedAt).toBe("2026-05-01");
  });

  it("informacja → etykieta informacja", () => {
    const line = mapOrderToForSomeoneLine({
      ...base,
      quantity: "-",
      request_kind: "informacja",
    });
    expect(line.quantity).toBe("—");
    expect(line.requestKind).toBe("informacja");
  });

  it("mapuje klienta handlowca", () => {
    const line = mapOrderToForSomeoneLine({
      ...base,
      sales_client_name: "  Klinika Smile  ",
      sales_client_kh_id: 42,
    });
    expect(line.clientName).toBe("Klinika Smile");
    expect(line.clientKhId).toBe(42);
  });
});
