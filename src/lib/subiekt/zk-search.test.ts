import { describe, expect, it } from "vitest";
import {
  collectMatchingZkDocuments,
  extractZkSearchToken,
  resolveZkSearchScope,
  validateZkQueryForSubmit,
  zkMonthRangeFromFullNumber,
  zkRecentDaysRange,
  ZK_RECENT_SEARCH_DAYS,
} from "./zk-search";
import type { SubiektDocument } from "@/lib/subiekt/types";

const DOC_A: SubiektDocument = {
  dok_Id: 1,
  dok_NrPelny: "ZK 234/M/03/2026",
  dok_DataWyst: "2026-03-10T00:00:00",
  dok_OdbiorcaId: 10,
  kh__Kontrahent_Odbiorca: { kh_Id: 10, adr_Nazwa: "Klinika A" },
};

const DOC_B: SubiektDocument = {
  dok_Id: 2,
  dok_NrPelny: "ZK 234/M/04/2026",
  dok_DataWyst: "2026-04-05T00:00:00",
  dok_OdbiorcaId: 11,
  kh__Kontrahent_Odbiorca: { kh_Id: 11, adr_Nazwa: "Klinika B" },
};

describe("validateZkQueryForSubmit", () => {
  it("wymaga min. 2 znaki", () => {
    expect(validateZkQueryForSubmit("5").ok).toBe(false);
    expect(validateZkQueryForSubmit("23").ok).toBe(true);
    expect(validateZkQueryForSubmit("234/M/03/2026").ok).toBe(true);
  });
});

describe("resolveZkSearchScope", () => {
  const at = new Date(2026, 4, 28);

  it("pełny numer → tylko miesiąc z kodu", () => {
    const scope = resolveZkSearchScope("234/M/03/2026", at);
    expect(scope.mode).toBe("month");
    if (scope.mode === "month") {
      expect(scope.dataOd).toBe("2026-03-01");
      expect(scope.dataDo).toBe("2026-03-31");
      expect(scope.monthLabel).toBe("marzec 2026");
    }
  });

  it("krótki numer → ostatnie 30 dni", () => {
    const scope = resolveZkSearchScope("23", at);
    expect(scope.mode).toBe("recent");
    if (scope.mode === "recent") {
      expect(scope.days).toBe(ZK_RECENT_SEARCH_DAYS);
      expect(scope.dataDo).toBe("2026-05-28");
      expect(scope.dataOd).toBe("2026-04-28");
    }
  });

  it("dok_Id → tryb document_id", () => {
    expect(resolveZkSearchScope("1782110", at).mode).toBe("document_id");
  });
});

describe("zkMonthRangeFromFullNumber", () => {
  it("parsuje marzec 2026", () => {
    expect(zkMonthRangeFromFullNumber("234/M/03/2026")).toEqual({
      dataOd: "2026-03-01",
      dataDo: "2026-03-31",
      month: 3,
      year: 2026,
    });
  });
});

describe("collectMatchingZkDocuments", () => {
  it("pełny numer wybiera dokładne ZK w miesiącu", () => {
    const hits = collectMatchingZkDocuments([DOC_A, DOC_B], "234/M/03/2026");
    expect(hits.map((d) => d.dok_Id)).toEqual([1]);
  });

  it("krótki prefiks może zwrócić wiele wyników", () => {
    const hits = collectMatchingZkDocuments([DOC_A, DOC_B], "23");
    expect(hits.map((d) => d.dok_Id)).toEqual([1, 2]);
  });

  it("nie traktuje cyfr z miesiąca/roku jako trafienia (np. 04, 20)", () => {
    const hits = collectMatchingZkDocuments([DOC_A, DOC_B], "04");
    expect(hits).toHaveLength(0);
    expect(collectMatchingZkDocuments([DOC_A, DOC_B], "20")).toHaveLength(0);
  });

  it("dopasowuje po prefiksie seryjnego, nie podciągu w środku", () => {
    const doc = { ...DOC_A, dok_Id: 3, dok_NrPelny: "ZK 1234/M/03/2026" };
    expect(collectMatchingZkDocuments([doc], "23")).toHaveLength(0);
    expect(collectMatchingZkDocuments([doc], "123")).toHaveLength(1);
  });
});

describe("extractZkSearchToken", () => {
  it("dla pełnego numeru bierze seryjny", () => {
    expect(extractZkSearchToken("234/M/03/2026")).toBe("234");
  });

  it("dla krótkiego wpisu zostawia cyfry", () => {
    expect(extractZkSearchToken("5667")).toBe("5667");
  });
});

describe("zkRecentDaysRange", () => {
  it("zakres 30 dni wstecz", () => {
    const at = new Date(2026, 4, 28);
    expect(zkRecentDaysRange(30, at)).toEqual({
      dataOd: "2026-04-28",
      dataDo: "2026-05-28",
    });
  });
});
