import { describe, expect, it } from "vitest";
import { mapZkDocument, normalizeZkQuery } from "./resolve-zk-document";
import type { SubiektDocument } from "@/lib/subiekt/types";

describe("normalizeZkQuery", () => {
  it("usuwa prefiks ZK", () => {
    expect(normalizeZkQuery("ZK 145/2026")).toBe("145/2026");
    expect(normalizeZkQuery("zk: 12/2025")).toBe("12/2025");
  });
});

describe("mapZkDocument", () => {
  it("mapuje numer, klienta i kwoty", () => {
    const doc: SubiektDocument = {
      dok_Id: 9001,
      dok_NrPelny: "145/2026",
      dok_OdbiorcaId: 44,
      dok_WartNetto: 1000,
      dok_WartBrutto: 1230,
      dok_DataWyst: "2026-05-10",
      kh__Kontrahent_Odbiorca: {
        kh_Id: 44,
        adr_Nazwa: "Kowalski Sp. z o.o.",
      },
      dok_Pozycja: [{ tw_Nazwa: "Szczotka" }, { tw_Nazwa: " Pasta" }],
    };
    const r = mapZkDocument(doc);
    expect(r.zkNumber).toBe("145/2026");
    expect(r.clientLabel).toContain("Kowalski");
    expect(r.amountGross).toBe(1230);
    expect(r.lineSummary).toContain("Szczotka");
  });
});
