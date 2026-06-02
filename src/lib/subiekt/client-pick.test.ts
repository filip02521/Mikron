import { describe, expect, it } from "vitest";
import {
  formatClientSearchResultCount,
  formatSubiektKontrahentOption,
  mergeKontrahenciUnique,
} from "./client-pick";
import type { SubiektKontrahent } from "./types";

describe("formatClientSearchResultCount", () => {
  it("odmienia liczbę wyników po polsku", () => {
    expect(formatClientSearchResultCount(1)).toBe("1 wynik");
    expect(formatClientSearchResultCount(2)).toBe("2 wyniki");
    expect(formatClientSearchResultCount(5)).toBe("5 wyników");
  });
});

describe("mergeKontrahenciUnique", () => {
  it("usuwa duplikaty po kh_Id", () => {
    const target: SubiektKontrahent[] = [];
    const seenKh = new Set<number>();
    const seenLabels = new Set<string>();
    const row = { kh_Id: 10, adr_Nazwa: "A" } satisfies SubiektKontrahent;
    mergeKontrahenciUnique(target, seenKh, seenLabels, [row, row], 12);
    expect(target).toHaveLength(1);
  });
});

describe("formatSubiektKontrahentOption", () => {
  it("składa tytuł i podtytuł z NIP i miejscowości", () => {
    const k: SubiektKontrahent = {
      kh_Id: 1,
      kh_Symbol: "KLIN01",
      adr_NazwaPelna: "Klinika Uśmiechu",
      adr_NIP: "1234567890",
      adr_Miejscowosc: "Warszawa",
    };
    const opt = formatSubiektKontrahentOption(k);
    expect(opt.title).toContain("Klinika");
    expect(opt.subtitle).toContain("NIP:");
    expect(opt.subtitle).toContain("Warszawa");
  });
});
