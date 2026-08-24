import { describe, expect, it, vi, beforeEach } from "vitest";
import { searchZkForAdd } from "./resolve-zk-document";
import type { SubiektDocument } from "@/lib/subiekt/types";

const DOC_MARCH: SubiektDocument = {
  dok_Id: 101,
  dok_NrPelny: "ZK 234/M/03/2026",
  dok_DataWyst: "2026-03-12T00:00:00",
  dok_OdbiorcaId: 1,
  kh__Kontrahent_Odbiorca: { kh_Id: 1, adr_Nazwa: "Klient A" },
};

const DOC_APRIL: SubiektDocument = {
  dok_Id: 102,
  dok_NrPelny: "ZK 234/M/04/2026",
  dok_DataWyst: "2026-04-02T00:00:00",
  dok_OdbiorcaId: 2,
  kh__Kontrahent_Odbiorca: { kh_Id: 2, adr_Nazwa: "Klient B" },
};

const searchSubiektZk = vi.fn();
const getSubiektZk = vi.fn();

vi.mock("@/lib/subiekt/api", () => ({
  searchSubiektZk: (...args: unknown[]) => searchSubiektZk(...args),
  getSubiektZk: (...args: unknown[]) => getSubiektZk(...args),
}));

describe("searchZkForAdd", () => {
  beforeEach(() => {
    searchSubiektZk.mockReset();
    getSubiektZk.mockReset();
    getSubiektZk.mockImplementation(async (id: number) =>
      id === 101 ? DOC_MARCH : DOC_APRIL
    );
  });

  it("pełny numer szuka w zakresie miesiąca z kodu", async () => {
    searchSubiektZk.mockResolvedValue({ data: [DOC_MARCH, DOC_APRIL] });

    const result = await searchZkForAdd("234/M/03/2026", new Date(2026, 4, 28));

    expect(searchSubiektZk).toHaveBeenCalledWith(
      expect.objectContaining({
        search: "234",
        dataOd: "2026-03-01",
        dataDo: "2026-03-31",
      })
    );
    expect(result.kind).toBe("single");
    if (result.kind === "single") {
      expect(result.resolved.subiektDokId).toBe(101);
    }
  });

  it("krótki numer szuka w ostatnich 30 dniach", async () => {
    searchSubiektZk.mockResolvedValue({ data: [DOC_MARCH, DOC_APRIL] });

    const result = await searchZkForAdd("23", new Date(2026, 4, 28));

    expect(searchSubiektZk).toHaveBeenCalledWith(
      expect.objectContaining({
        search: "23",
        dataOd: "2026-04-28",
        dataDo: "2026-05-28",
      })
    );
    expect(result.kind).toBe("choose");
    if (result.kind === "choose") {
      expect(result.candidates).toHaveLength(2);
    }
  });

  it("jeden wynik w 30 dniach dodaje od razu", async () => {
    searchSubiektZk.mockResolvedValue({ data: [DOC_APRIL] });

    const result = await searchZkForAdd("234", new Date(2026, 4, 28));

    expect(result.kind).toBe("single");
    if (result.kind === "single") {
      expect(result.resolved.subiektDokId).toBe(102);
    }
  });

  it("gdy brak w 30 dniach, szuka w oknie 90 dni", async () => {
    const older: SubiektDocument = {
      dok_Id: 1825028,
      dok_NrPelny: "ZK 5779/M/07/2026",
      dok_DataWyst: "2026-07-14T00:00:00",
      dok_OdbiorcaId: 3,
      kh__Kontrahent_Odbiorca: { kh_Id: 3, adr_Nazwa: "Klient C" },
    };
    searchSubiektZk
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [older] });
    getSubiektZk.mockResolvedValue(older);

    const at = new Date(2026, 7, 20); // 20.08.2026 — ZK z 14.07 jest poza 30 dniami
    const result = await searchZkForAdd("5779", at);

    expect(searchSubiektZk).toHaveBeenCalledTimes(2);
    expect(searchSubiektZk).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        search: "5779",
        dataOd: "2026-07-21",
        dataDo: "2026-08-20",
      })
    );
    expect(searchSubiektZk).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        search: "5779",
        dataOd: "2026-05-22",
        dataDo: "2026-08-20",
      })
    );
    expect(result.kind).toBe("single");
    if (result.kind === "single") {
      expect(result.resolved.subiektDokId).toBe(1825028);
      expect(result.resolved.zkNumber).toBe("ZK 5779/M/07/2026");
    }
  });

  it("po rozszerzeniu do 90 dni nadal brak — komunikat z podpowiedzią pełnego numeru", async () => {
    searchSubiektZk.mockResolvedValue({ data: [] });

    const result = await searchZkForAdd("5779", new Date(2026, 7, 20));

    expect(searchSubiektZk).toHaveBeenCalledTimes(2);
    expect(result.kind).toBe("error");
    if (result.kind === "error") {
      expect(result.message).toContain("ostatnich 90 dni");
      expect(result.message).toContain("5779/M/08/2026");
    }
  });

  it("odrzuca wpis krótszy niż 2 znaki", async () => {
    const result = await searchZkForAdd("5");
    expect(result.kind).toBe("error");
    expect(searchSubiektZk).not.toHaveBeenCalled();
  });
});
