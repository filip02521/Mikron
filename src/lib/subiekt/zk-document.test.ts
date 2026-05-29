import { describe, expect, it } from "vitest";
import {
  extractZkPathSuffix,
  extractZkSerial,
  formatZkKontrahentLabel,
  normalizeZkNumberKey,
  normalizeZkQuery,
  pickBestZkMatch,
  zkDocumentStatusLabel,
  zkNumbersEquivalent,
} from "./zk-document";
import type { SubiektDocument } from "@/lib/subiekt/types";

const SAMPLE_ZK: SubiektDocument = {
  dok_Id: 1782110,
  dok_NrPelny: "ZK 153157/M/04/2026",
  dok_NrPelnyOryg: "czeka",
  dok_Typ: 16,
  dok_DataWyst: "2026-04-24T00:00:00",
  dok_OdbiorcaId: 6769,
  dok_WartNetto: 4065.04,
  dok_WartBrutto: 5000,
  dok_Status: 7,
  kh__Kontrahent_Odbiorca: {
    kh_Id: 6769,
    kh_Symbol: "WALCZAK JACEK",
    adr_Nazwa: "Walczak Jacek",
    adr_NazwaPelna: "Laboratorium Protetyki Dentystycznej\r\nJacek Walczak",
    adr_Miejscowosc: "Raszków",
  },
};

describe("normalizeZkQuery", () => {
  it("usuwa prefiks ZK", () => {
    expect(normalizeZkQuery("ZK 153157/M/04/2026")).toBe("153157/M/04/2026");
  });
});

describe("extractZkSerial", () => {
  it("wyciąga numer seryjny", () => {
    expect(extractZkSerial("ZK 153157/M/04/2026")).toBe("153157");
    expect(extractZkPathSuffix("ZK 153157/M/04/2026")).toBe("/m/04/2026");
  });
});

describe("zkNumbersEquivalent", () => {
  it("traktuje równoważne zapisy pełnego numeru", () => {
    expect(zkNumbersEquivalent("ZK 153157/M/04/2026", "153157/M/04/2026")).toBe(true);
    expect(zkNumbersEquivalent("ZK 153157/M/04/2026", "153158")).toBe(false);
  });
});

describe("formatZkKontrahentLabel", () => {
  it("preferuje krótką nazwę z miastem", () => {
    const label = formatZkKontrahentLabel(SAMPLE_ZK.kh__Kontrahent_Odbiorca!);
    expect(label).toContain("Walczak Jacek");
    expect(label).toContain("Raszków");
  });
});

describe("pickBestZkMatch", () => {
  it("znajduje po samym numerze seryjnym", () => {
    const hit = pickBestZkMatch([SAMPLE_ZK], "153157");
    expect(hit?.dok_Id).toBe(1782110);
  });

  it("wymaga pełniejszego numeru przy wielu trafieniach", () => {
    const other: SubiektDocument = {
      ...SAMPLE_ZK,
      dok_Id: 2,
      dok_NrPelny: "ZK 153157/M/03/2026",
    };
    expect(pickBestZkMatch([SAMPLE_ZK, other], "153157")).toBeNull();
    expect(
      pickBestZkMatch([SAMPLE_ZK, other], "153157/M/04/2026")?.dok_NrPelny
    ).toBe("ZK 153157/M/04/2026");
  });
});

describe("zkDocumentStatusLabel", () => {
  it("mapuje znane statusy", () => {
    expect(zkDocumentStatusLabel(7)).toBe("Aktywne");
    expect(zkDocumentStatusLabel(8)).toBe("Zrealizowane");
  });
});

describe("normalizeZkNumberKey", () => {
  it("normalizuje pełny numer", () => {
    expect(normalizeZkNumberKey("ZK 153159/M/04/2026")).toBe("153159/m/04/2026");
  });
});
