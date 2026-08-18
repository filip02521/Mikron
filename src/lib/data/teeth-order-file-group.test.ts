import { describe, expect, it } from "vitest";
import { TEETH_GROUP_ORDER_FILE_FALLBACK_NAME } from "@/lib/teeth/teeth-mark-ordered";
import {
  firstTeethOrderFileInGroup,
  mergeTeethFileGroupSiblingsIntoOrders,
  uncoveredTeethOrderIdsMissingGroupFile,
  unionTeethFileGroupOrderIds,
} from "./teeth-order-file-group";

describe("mergeTeethFileGroupSiblingsIntoOrders", () => {
  it("dokłada rodzeństwo bez nadpisywania pełnego rekordu", () => {
    const map = new Map([
      [
        "a",
        {
          supplier_id: "ivoclar",
          teeth_details: [],
          teeth_order_file_path: "old/a.xlsx",
        },
      ],
    ]);
    mergeTeethFileGroupSiblingsIntoOrders(map, [
      {
        id: "a",
        supplier_id: "ivoclar",
        teeth_order_file_path: "new/a.xlsx",
        teeth_order_file_name: "a.xlsx",
      },
      {
        id: "b",
        supplier_id: "ivoclar",
        teeth_order_file_path: "new/a.xlsx",
        teeth_order_file_name: "a.xlsx",
      },
    ]);
    expect(map.get("a")?.teeth_order_file_path).toBe("old/a.xlsx");
    expect(map.get("b")?.teeth_order_file_path).toBe("new/a.xlsx");
    expect(map.size).toBe(2);
  });
});

describe("unionTeethFileGroupOrderIds", () => {
  it("zawsze dołącza bieżące id, nawet gdy rodzeństwo go nie zwraca", () => {
    expect(unionTeethFileGroupOrderIds("current", [{ id: "b" }, { id: "c" }])).toEqual([
      "current",
      "b",
      "c",
    ]);
    expect(unionTeethFileGroupOrderIds("current", [])).toEqual(["current"]);
  });
});

describe("uncoveredTeethOrderIdsMissingGroupFile", () => {
  it("kopiuje plik na całe rodzeństwo bez pliku, nie tylko na oznaczane id", () => {
    const map = new Map([
      [
        "a",
        {
          supplier_id: "ivoclar",
          teeth_order_file_path: "teeth-orders/g/a.xlsx",
          teeth_order_file_name: "ivoclar.xlsx",
        },
      ],
      ["b", { supplier_id: "ivoclar" }],
      ["c", { supplier_id: "ivoclar" }],
      ["d", { supplier_id: "vita" }],
    ]);
    expect(uncoveredTeethOrderIdsMissingGroupFile(map).sort()).toEqual(["b", "c"]);
  });
});

describe("firstTeethOrderFileInGroup", () => {
  it("gdy brak nazwy, wstawia etykietę zastępczą do kopii metadanych", () => {
    expect(
      firstTeethOrderFileInGroup(
        [{ supplier_id: "ivoclar", teeth_order_file_path: "teeth-orders/g/a.xlsx" }],
        "ivoclar"
      )
    ).toEqual({
      path: "teeth-orders/g/a.xlsx",
      name: TEETH_GROUP_ORDER_FILE_FALLBACK_NAME,
    });
  });
});
