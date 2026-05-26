import { describe, expect, it } from "vitest";
import {
  dedupeAppSuppliersByKhId,
  findSupplierBySubiektKhIdPreferCanonical,
} from "./dedupe-suppliers-by-kh";
import type { AppSupplierRef } from "./match-supplier";

const refs: AppSupplierRef[] = [
  { id: "a", name: "MOTYL-Pro Sp. z o.o.", subiektKhId: 10 },
  { id: "b", name: "MOTYL-Pro", subiektKhId: 10 },
  { id: "c", name: "Inny", subiektKhId: null },
];

describe("dedupeAppSuppliersByKhId", () => {
  it("zostawia jedną kartę na kh_Id (krótsza nazwa)", () => {
    const out = dedupeAppSuppliersByKhId(refs);
    const motyl = out.filter((s) => s.subiektKhId === 10);
    expect(motyl).toHaveLength(1);
    expect(motyl[0]?.id).toBe("b");
    expect(out).toHaveLength(2);
  });
});

describe("findSupplierBySubiektKhIdPreferCanonical", () => {
  it("preferuje krótszą nazwę", () => {
    const hit = findSupplierBySubiektKhIdPreferCanonical(10, refs);
    expect(hit?.id).toBe("b");
  });
});
