import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SubiektDocument } from "./types";

const searchSubiektZdCached = vi.fn();

vi.mock("@/lib/subiekt/subiekt-runtime-cache", () => ({
  searchSubiektZdCached: (...args: unknown[]) => searchSubiektZdCached(...args),
}));

import { browseZdDocumentsForKhIds } from "./zd-eta-browse";

function doc(id: number, date: string): SubiektDocument {
  return {
    dok_Id: id,
    dok_DataWyst: date,
    dok_NrPelny: `ZD/${id}`,
    dok_Pozycja: [],
  };
}

describe("browseZdDocumentsForKhIds", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchSubiektZdCached.mockReset();
  });

  it("przegląda ZD po każdym kh_Id dostawcy", async () => {
    searchSubiektZdCached
      .mockResolvedValueOnce({ data: [{ dok_Id: 1, dok_DataWyst: "2026-06-10" }] })
      .mockResolvedValueOnce({ data: [{ dok_Id: 2, dok_DataWyst: "2026-06-08" }] });

    const loadDoc = vi.fn(async (id: number) => doc(id, "2026-06-10"));

    const result = await browseZdDocumentsForKhIds({
      khIds: [2114, 9999],
      dataOd: "2026-05-01",
      maxDocsToFetch: 10,
      loadDoc,
    });

    expect(searchSubiektZdCached).toHaveBeenCalledTimes(2);
    expect(result.docs.map((d) => d.dok_Id)).toEqual([1, 2]);
    expect(loadDoc).toHaveBeenCalledTimes(2);
  });

  it("pomija już znane dok_Id i respektuje budżet", async () => {
    searchSubiektZdCached.mockResolvedValue({
      data: [
        { dok_Id: 1, dok_DataWyst: "2026-06-10" },
        { dok_Id: 2, dok_DataWyst: "2026-06-09" },
        { dok_Id: 3, dok_DataWyst: "2026-06-08" },
      ],
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

  it("przy matchDoc najpierw listuje strony, potem ładuje wg bliskości daty", async () => {
    searchSubiektZdCached
      .mockResolvedValueOnce({
        data: [
          { dok_Id: 100, dok_DataWyst: "2026-06-20" },
          { dok_Id: 101, dok_DataWyst: "2026-06-19" },
        ],
      })
      .mockResolvedValueOnce({
        data: [{ dok_Id: 62, dok_DataWyst: "2026-06-09" }],
      });

    const loadDoc = vi.fn(async (id: number) => doc(id, "2026-06-09"));
    const matchDoc = vi.fn((d: SubiektDocument) => d.dok_Id === 62);

    const result = await browseZdDocumentsForKhIds({
      khIds: [2114],
      dataOd: "2026-06-01",
      pageSize: 2,
      maxPagesPerKh: 2,
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
    searchSubiektZdCached
      .mockResolvedValueOnce({
        data: [{ dok_Id: 200, dok_DataWyst: "2026-06-20" }],
      })
      .mockResolvedValueOnce({
        data: [{ dok_Id: 62, dok_DataWyst: "2026-02-09" }],
      });

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
      maxPagesPerKh: 2,
      maxDocsToFetch: 5,
      preferIssueDateNear: "2026-02-08",
      matchDoc,
      loadDoc,
    });

    expect(result.matched?.dok_Id).toBe(62);
    expect(searchSubiektZdCached).toHaveBeenCalledWith(
      expect.objectContaining({ dataOd: "2026-06-01", dataDo: "2026-07-01" })
    );
    expect(searchSubiektZdCached).toHaveBeenCalledWith(
      expect.objectContaining({ dataOd: "2026-02-01", dataDo: "2026-03-01" })
    );
  });
});
