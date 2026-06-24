import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SubiektDocument } from "./types";

const searchSubiektZdCachedForEta = vi.fn();

vi.mock("@/lib/subiekt/subiekt-runtime-cache", () => ({
  searchSubiektZdCachedForEta: (...args: unknown[]) => searchSubiektZdCachedForEta(...args),
}));

import { browseZdDocumentsForKhIds } from "./zd-eta-browse";

function doc(id: number, date: string, status?: number): SubiektDocument {
  return {
    dok_Id: id,
    dok_DataWyst: date,
    dok_NrPelny: `ZD/${id}`,
    dok_Status: status,
    dok_Pozycja: [],
  };
}

describe("browseZdDocumentsForKhIds", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchSubiektZdCachedForEta.mockReset();
  });

  it("przegląda ZD po każdym kh_Id dostawcy", async () => {
    searchSubiektZdCachedForEta.mockImplementation((params: { status?: number }) => {
      if (params.status != null) return Promise.resolve({ data: [] });
      return Promise.resolve({
        data: [
          { dok_Id: 1, dok_DataWyst: "2026-06-10", dok_OdbiorcaId: 2114, dok_Status: 6 },
          { dok_Id: 2, dok_DataWyst: "2026-06-08", dok_OdbiorcaId: 9999, dok_Status: 6 },
          { dok_Id: 3, dok_DataWyst: "2026-06-07", dok_OdbiorcaId: 7777, dok_Status: 6 },
        ],
      });
    });

    const loadDoc = vi.fn(async (id: number) => doc(id, "2026-06-10", 6));

    const result = await browseZdDocumentsForKhIds({
      khIds: [2114, 9999],
      dataOd: "2026-05-01",
      maxPagesPerKh: 1,
      maxDocsToFetch: 10,
      loadDoc,
    });

    expect(searchSubiektZdCachedForEta).toHaveBeenCalledWith(
      expect.objectContaining({ status: 5 })
    );
    expect(
      searchSubiektZdCachedForEta.mock.calls.some(
        ([params]) => params.status == null && params.khId == null
      )
    ).toBe(true);
    expect(result.docs.map((d) => d.dok_Id)).toEqual([1, 2]);
    expect(loadDoc).toHaveBeenCalledTimes(2);
  });

  it("pomija już znane dok_Id i respektuje budżet", async () => {
    searchSubiektZdCachedForEta.mockImplementation((params: { status?: number }) => {
      if (params.status != null) return Promise.resolve({ data: [] });
      return Promise.resolve({
        data: [
          { dok_Id: 1, dok_DataWyst: "2026-06-10", dok_OdbiorcaId: 2114, dok_Status: 6 },
          { dok_Id: 2, dok_DataWyst: "2026-06-09", dok_OdbiorcaId: 2114, dok_Status: 6 },
          { dok_Id: 3, dok_DataWyst: "2026-06-08", dok_OdbiorcaId: 2114, dok_Status: 6 },
        ],
      });
    });

    const loadDoc = vi.fn(async (id: number) => doc(id, "2026-06-10"));

    const result = await browseZdDocumentsForKhIds({
      khIds: [2114],
      dataOd: "2026-05-01",
      maxDocsToFetch: 1,
      skipDocIds: new Set([1]),
      maxPagesPerKh: 1,
      loadDoc,
    });

    expect(result.docs.map((d) => d.dok_Id)).toEqual([2]);
    expect(result.stoppedEarly).toBe(true);
  });

  it("najpierw ładuje ZD ze statusem niezrealizowanym, potem resztę", async () => {
    searchSubiektZdCachedForEta.mockImplementation((params: { status?: number }) => {
      if (params.status === 6) {
        return Promise.resolve({
          data: [
            {
              dok_Id: 62,
              dok_DataWyst: "2026-06-09",
              dok_Status: 6,
              dok_OdbiorcaId: 2114,
            },
          ],
        });
      }
      if (params.status != null) return Promise.resolve({ data: [] });
      return Promise.resolve({
        data: [
          {
            dok_Id: 100,
            dok_DataWyst: "2026-06-20",
            dok_Status: null,
            dok_OdbiorcaId: 2114,
          },
        ],
      });
    });

    const loadDoc = vi.fn(async (id: number) =>
      doc(id, id === 62 ? "2026-06-09" : "2026-06-20", id === 62 ? 6 : undefined)
    );
    const matchDoc = vi.fn((d: SubiektDocument) => d.dok_Id === 62);

    const result = await browseZdDocumentsForKhIds({
      khIds: [2114],
      dataOd: "2026-06-01",
      pageSize: 25,
      maxPagesPerKh: 1,
      maxDocsToFetch: 5,
      preferIssueDateNear: "2026-06-08",
      matchDoc,
      loadDoc,
    });

    expect(result.matched?.dok_Id).toBe(62);
    expect(loadDoc.mock.calls[0]?.[0]).toBe(62);
    expect(matchDoc).toHaveBeenCalled();
  });

  it("monthChunks — przegląda kolejne miesiące i zatrzymuje się na matchDoc", async () => {
    searchSubiektZdCachedForEta.mockImplementation(
      (params: { dataOd?: string; status?: number }) => {
        if (params.status != null) return Promise.resolve({ data: [] });
        if (params.dataOd === "2026-06-01") {
          return Promise.resolve({
            data: [{ dok_Id: 200, dok_DataWyst: "2026-06-20", dok_OdbiorcaId: 3119 }],
          });
        }
        if (params.dataOd === "2026-02-01") {
          return Promise.resolve({
            data: [{ dok_Id: 62, dok_DataWyst: "2026-02-09", dok_OdbiorcaId: 3119 }],
          });
        }
        return Promise.resolve({ data: [] });
      }
    );

    const loadDoc = vi.fn(async (id: number) => doc(id, "2026-02-09"));
    const matchDoc = vi.fn((d: SubiektDocument) => d.dok_Id === 62);

    const result = await browseZdDocumentsForKhIds({
      khIds: [3119],
      dataOd: "2026-02-01",
      monthChunks: [
        { dataOd: "2026-06-01", dataDo: "2026-07-01" },
        { dataOd: "2026-02-01", dataDo: "2026-03-01" },
      ],
      pageSize: 25,
      maxPagesPerKh: 1,
      maxDocsToFetch: 5,
      preferIssueDateNear: "2026-02-08",
      matchDoc,
      loadDoc,
    });

    expect(result.matched?.dok_Id).toBe(62);
    expect(searchSubiektZdCachedForEta).toHaveBeenCalledWith(
      expect.objectContaining({ dataOd: "2026-06-01", dataDo: "2026-07-01", status: 5 })
    );
    expect(searchSubiektZdCachedForEta).toHaveBeenCalledWith(
      expect.objectContaining({ dataOd: "2026-02-01", dataDo: "2026-03-01" })
    );
  });
});
