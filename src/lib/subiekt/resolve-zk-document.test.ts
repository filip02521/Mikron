import { describe, expect, it } from "vitest";
import { mapZkDocument, normalizeZkQuery } from "./resolve-zk-document";
import type { SubiektDocument } from "@/lib/subiekt/types";

const SAMPLE_ZK: SubiektDocument = {
  dok_Id: 1782110,
  dok_NrPelny: "ZK 153157/M/04/2026",
  dok_NrPelnyOryg: "czeka",
  dok_OdbiorcaId: 6769,
  dok_WartNetto: 4065.04,
  dok_WartBrutto: 5000,
  dok_DataWyst: "2026-04-24T00:00:00",
  dok_Status: 7,
  kh__Kontrahent_Odbiorca: {
    kh_Id: 6769,
    kh_Symbol: "WALCZAK JACEK",
    adr_Nazwa: "Walczak Jacek",
    adr_Miejscowosc: "Raszków",
  },
  dok_Pozycja: [{ tw_Nazwa: "Szczotka" }, { tw_Nazwa: "Pasta" }],
};

describe("normalizeZkQuery", () => {
  it("usuwa prefiks ZK", () => {
    expect(normalizeZkQuery("ZK 153157/M/04/2026")).toBe("153157/M/04/2026");
  });
});

describe("mapZkDocument", () => {
  it("mapuje pełny numer Mikron, klienta, kwoty i uwagę", () => {
    const r = mapZkDocument(SAMPLE_ZK);
    expect(r.zkNumber).toBe("ZK 153157/M/04/2026");
    expect(r.clientLabel).toContain("Walczak Jacek");
    expect(r.amountGross).toBe(5000);
    expect(r.lineSummary).toContain("Szczotka");
    expect(r.origNote).toBe("czeka");
    expect(r.statusLabel).toBe("Aktywne");
    expect(r.issuedAt).toBe("2026-04-24");
  });

  it("używa dok_NrPelnyOryg gdy brak pozycji", () => {
    const doc: SubiektDocument = {
      ...SAMPLE_ZK,
      dok_Pozycja: [],
      dok_NrPelnyOryg: "wz trasa 27.04",
    };
    const r = mapZkDocument(doc);
    expect(r.lineSummary).toBe("wz trasa 27.04");
  });
});
