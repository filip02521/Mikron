import { describe, expect, it } from "vitest";
import {
  buildSupplierKhIdsBySupplierId,
  collectKhIdsForSupplierRef,
} from "./supplier-subiekt-kh";
import type { AppSupplierRef } from "@/lib/subiekt/match-supplier";

describe("collectKhIdsForSupplierRef", () => {
  it("łączy główny kh_Id z dodatkowymi", () => {
    const s: AppSupplierRef = {
      id: "a",
      name: "Renfert",
      subiektKhId: 100,
      additionalSubiektKhIds: [200, 100],
    };
    expect(collectKhIdsForSupplierRef(s).sort()).toEqual([100, 200]);
  });
});

describe("buildSupplierKhIdsBySupplierId", () => {
  it("mapuje supplier_id na kh_Id z aliasami", () => {
    expect(
      buildSupplierKhIdsBySupplierId([
        { id: "s1", name: "A", subiektKhId: null, additionalSubiektKhIds: [200] },
        { id: "s2", name: "B", subiektKhId: 100 },
      ])
    ).toEqual({
      s1: [200],
      s2: [100],
    });
  });
});
