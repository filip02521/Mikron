import { describe, expect, it } from "vitest";
import { collectKhIdsForSupplierRef } from "./supplier-subiekt-kh";
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
