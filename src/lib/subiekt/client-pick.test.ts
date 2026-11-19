import { describe, expect, it } from "vitest";
import {
  clientSearchPhrases,
  formatClientSearchResultCount,
  formatSubiektKontrahentOption,
  mergeKontrahenciUnique,
  shouldRunSubiektClientSearch,
} from "./client-pick";
import type { SubiektKontrahent } from "./types";

describe("shouldRunSubiektClientSearch", () => {
  it("nie szuka ponownie po wyborze z listy (kh_Id)", () => {
    expect(
      shouldRunSubiektClientSearch("BASSEM ALI DENTALART - Bassem Ali Dentalart", 42)
    ).toBe(false);
  });

  it("szuka przy ręcznym wpisie bez kh_Id", () => {
    expect(shouldRunSubiektClientSearch("bassem", null)).toBe(true);
    expect(shouldRunSubiektClientSearch("b", null)).toBe(false);
  });
});

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

describe("clientSearchPhrases", () => {
  it("NIP cyframi, z myślnikami, spacjami lub prefiksem kraju → każdy zapis z kartotek", () => {
    const all = ["1234563218", "123-456-32-18", "123-45-63-218"];
    expect(clientSearchPhrases("1234563218")).toEqual(all);
    expect(clientSearchPhrases(" 123-456-32-18 ")).toEqual(all);
    expect(clientSearchPhrases("123 456 32 18")).toEqual(all);
    expect(clientSearchPhrases("PL 1234563218")).toEqual(all);
    expect(clientSearchPhrases("pl123-45-63-218")).toEqual(all);
  });

  it("fragment NIP-u z myślnikami → same cyfry (API szuka podciągu)", () => {
    expect(clientSearchPhrases("123-456")).toEqual(["123456"]);
  });

  it("nazwa, nazwisko lub miasto bez zmian", () => {
    expect(clientSearchPhrases("Przykładowa Dental")).toEqual(["Przykładowa Dental"]);
    expect(clientSearchPhrases("Kowalski")).toEqual(["Kowalski"]);
    expect(clientSearchPhrases("3M")).toEqual(["3M"]);
    expect(clientSearchPhrases("A&B")).toEqual(["A&B", "A B", "AB", "A & B"]);
  });
});
