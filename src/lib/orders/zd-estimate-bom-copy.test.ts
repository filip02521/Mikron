import { describe, expect, it } from "vitest";
import {
  formatZdBomCountLabel,
  formatZdBomVisibleCountLabel,
} from "@/lib/orders/zd-estimate-bom-copy";

describe("formatZdBomCountLabel", () => {
  it("odmienia poprawnie", () => {
    expect(formatZdBomCountLabel(0)).toBe("Brak zapisanych składów");
    expect(formatZdBomCountLabel(1)).toBe("1 skład");
    expect(formatZdBomCountLabel(2)).toBe("2 składy");
    expect(formatZdBomCountLabel(4)).toBe("4 składy");
    expect(formatZdBomCountLabel(5)).toBe("5 składów");
    expect(formatZdBomCountLabel(12)).toBe("12 składów");
    expect(formatZdBomCountLabel(22)).toBe("22 składy");
    expect(formatZdBomCountLabel(25)).toBe("25 składów");
  });

  it("filtr widocznych", () => {
    expect(formatZdBomVisibleCountLabel(2, 10)).toBe("Widoczne 2 z 10");
  });
});
