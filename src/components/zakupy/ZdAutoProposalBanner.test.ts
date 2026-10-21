import { describe, expect, it } from "vitest";
import { zdAutoProposalDiff } from "./ZdAutoProposalBanner";
import { zdSupplierPolicyLabel } from "./ZdSupplierOrderPolicyDialog";

const line = (twId: number, zdUnits: number) => ({
  twId, symbol: "", nazwa: "", zdUnits, pieces: zdUnits, unitLabel: "szt.", priceNet: null, prosbaPieces: 0, floor: false,
});

describe("zdAutoProposalDiff", () => {
  it("liczy linie bez zmian, zmienione, usunięte i dodane względem ZD", () => {
    expect(
      zdAutoProposalDiff({
        lines: [line(1, 5), line(2, 3), line(3, 1)],
        finalLines: { "1": 5, "2": 4, "9": 2 },
      })
    ).toEqual({ same: 1, changed: 1, removed: 1, added: 1 });
  });
});

describe("zdSupplierPolicyLabel", () => {
  it("opisuje strategię dostawcy w chipie", () => {
    expect(zdSupplierPolicyLabel(null)).toBe("Strategia: jak dotąd");
    expect(
      zdSupplierPolicyLabel({ strategy: "max30_90", targetDays: 25, cycleDays: 3, autoProposals: true })
    ).toBe("Strategia testowa · 25 dni zapasu · co 3 dni · propozycje");
  });
});
