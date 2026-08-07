import { describe, expect, it } from "vitest";
import {
  isZdEstimateFetchIncomplete,
  normalizeZdEstimateBulkProducts,
  normalizeZdEstimateBulkTwIds,
  pickLatestFsDateKey,
  ZD_ESTIMATE_BULK_MAX,
} from "@/lib/orders/zd-estimate-bulk";

describe("normalizeZdEstimateBulkTwIds", () => {
  it("deduplikuje i odrzuca niepoprawne id", () => {
    expect(normalizeZdEstimateBulkTwIds([10, 10, 0, -1, 20, NaN])).toEqual({
      ids: [10, 20],
      truncated: false,
    });
  });

  it("ucina do limitu i ustawia truncated", () => {
    const raw = Array.from({ length: ZD_ESTIMATE_BULK_MAX + 40 }, (_, i) => i + 1);
    const res = normalizeZdEstimateBulkTwIds(raw);
    expect(res.ids).toHaveLength(ZD_ESTIMATE_BULK_MAX);
    expect(res.truncated).toBe(true);
  });

  it("nie oznacza truncated gdy duplikaty mieszczą się w limicie", () => {
    const raw = [
      ...Array.from({ length: 50 }, (_, i) => i + 1),
      ...Array.from({ length: 50 }, (_, i) => i + 1),
    ];
    expect(normalizeZdEstimateBulkTwIds(raw)).toEqual({
      ids: Array.from({ length: 50 }, (_, i) => i + 1),
      truncated: false,
    });
  });
});

describe("normalizeZdEstimateBulkProducts", () => {
  it("zachowuje pierwszy wpis przy duplikacie tw_Id", () => {
    expect(
      normalizeZdEstimateBulkProducts([
        { subiektTwId: 1, twNazwa: "A", twSymbol: "X" },
        { subiektTwId: 1, twNazwa: "B", twSymbol: "Y" },
        { subiektTwId: 2, twNazwa: "C" },
      ])
    ).toEqual({
      products: [
        {
          subiektTwId: 1,
          twNazwa: "A",
          twSymbol: "X",
          grtId: null,
          grtNazwa: null,
        },
        {
          subiektTwId: 2,
          twNazwa: "C",
          twSymbol: null,
          grtId: null,
          grtNazwa: null,
        },
      ],
      truncated: false,
    });
  });

  it("pomija puste nazwy", () => {
    expect(
      normalizeZdEstimateBulkProducts([
        { subiektTwId: 1, twNazwa: "   " },
        { subiektTwId: 2, twNazwa: "Ok" },
      ])
    ).toEqual({
      products: [
        {
          subiektTwId: 2,
          twNazwa: "Ok",
          twSymbol: null,
          grtId: null,
          grtNazwa: null,
        },
      ],
      truncated: false,
    });
  });
});

describe("pickLatestFsDateKey", () => {
  it("bierze max datę niezależnie od kolejności API", () => {
    expect(
      pickLatestFsDateKey([
        { dok_DataWyst: "2024-01-01" },
        { dok_DataWyst: "2026-08-01T12:00:00" },
        { dok_DataWyst: "2025-12-31" },
        { dok_DataWyst: "bad" },
        {},
      ])
    ).toBe("2026-08-01");
  });

  it("zwraca null gdy brak poprawnych dat", () => {
    expect(pickLatestFsDateKey([{ dok_DataWyst: "x" }, {}])).toBeNull();
  });
});

describe("isZdEstimateFetchIncomplete", () => {
  it("true gdy totalPages > maxPages", () => {
    expect(
      isZdEstimateFetchIncomplete({
        pagesFetched: 40,
        totalPages: 50,
        maxPages: 40,
        pozycjeCount: 8000,
        totalCountApi: 10000,
        stoppedEarly: false,
      })
    ).toBe(true);
  });

  it("true gdy pętla przerwana wcześniej", () => {
    expect(
      isZdEstimateFetchIncomplete({
        pagesFetched: 2,
        totalPages: 5,
        maxPages: 40,
        pozycjeCount: 400,
        totalCountApi: 1000,
        stoppedEarly: true,
      })
    ).toBe(true);
  });

  it("false gdy dociągnięto wszystkie strony w limicie", () => {
    expect(
      isZdEstimateFetchIncomplete({
        pagesFetched: 3,
        totalPages: 3,
        maxPages: 40,
        pozycjeCount: 500,
        totalCountApi: 500,
        stoppedEarly: false,
      })
    ).toBe(false);
  });
});
