import { describe, expect, it, vi } from "vitest";
import { isFulfilledZdDocumentStatus } from "@/lib/subiekt/zd-fulfillment-date";
import type { SubiektDocument } from "@/lib/subiekt/types";
import {
  resolveDocAfterZdCreate,
  zdCreateResponseCoversCreateLines,
  zdCreateResponseCoversCreateTwIds,
} from "./zd-estimate-create-doc";

function doc(partial: Partial<SubiektDocument> & { dok_Id: number }): SubiektDocument {
  return partial as SubiektDocument;
}

describe("zdCreateResponseCoversCreateLines", () => {
  it("false przy pustych createLines", () => {
    expect(
      zdCreateResponseCoversCreateLines(
        doc({
          dok_Id: 1,
          dok_Pozycja: [{ ob_TowId: 10, ob_Ilosc: 1 }],
        }),
        []
      )
    ).toBe(false);
  });

  it("true gdy tw + qty ≥ wysłane (nadmiar OK)", () => {
    expect(
      zdCreateResponseCoversCreateLines(
        doc({
          dok_Id: 1,
          dok_Pozycja: [
            { ob_TowId: 10, ob_Ilosc: 2 },
            { ob_TowId: 20, ob_Ilosc: 5 },
          ],
        }),
        [
          { twId: 10, ilosc: 2 },
          { twId: 20, ilosc: 3 },
        ]
      )
    ).toBe(true);
  });

  it("false gdy tw jest, ale qty za niska", () => {
    expect(
      zdCreateResponseCoversCreateLines(
        doc({
          dok_Id: 1,
          dok_Pozycja: [{ ob_TowId: 10, ob_Ilosc: 1 }],
        }),
        [{ twId: 10, ilosc: 2 }]
      )
    ).toBe(false);
  });

  it("false gdy ta sama liczba tw, inny zestaw", () => {
    expect(
      zdCreateResponseCoversCreateLines(
        doc({
          dok_Id: 1,
          dok_Pozycja: [
            { ob_TowId: 10, ob_Ilosc: 1 },
            { ob_TowId: 20, ob_Ilosc: 1 },
            { ob_TowId: 40, ob_Ilosc: 1 },
          ],
        }),
        [
          { twId: 10, ilosc: 1 },
          { twId: 20, ilosc: 1 },
          { twId: 30, ilosc: 1 },
        ]
      )
    ).toBe(false);
  });

  it("sumuje zduplikowane linie tego samego tw", () => {
    expect(
      zdCreateResponseCoversCreateLines(
        doc({
          dok_Id: 1,
          dok_Pozycja: [
            { ob_TowId: 10, ob_Ilosc: 1 },
            { ob_TowId: 10, ob_Ilosc: 2 },
          ],
        }),
        [{ twId: 10, ilosc: 3 }]
      )
    ).toBe(true);
  });

  it("legacy coversCreateTwIds — tylko obecność", () => {
    expect(
      zdCreateResponseCoversCreateTwIds(
        doc({
          dok_Id: 1,
          dok_Pozycja: [{ ob_TowId: 10, ob_Ilosc: 1 }],
        }),
        new Set([10])
      )
    ).toBe(true);
  });
});

describe("resolveDocAfterZdCreate", () => {
  it("!persistSnapshots — bez getById, source create", async () => {
    const getById = vi.fn();
    const created = doc({
      dok_Id: 55,
      dok_NrPelny: "ZD 1/2026",
      dok_Pozycja: [],
    });
    const r = await resolveDocAfterZdCreate({
      created,
      dokId: 55,
      createLines: [{ twId: 10, ilosc: 1 }],
      persistSnapshots: false,
      getById,
    });
    expect(getById).not.toHaveBeenCalled();
    expect(r).toMatchObject({
      source: "create",
      didReget: false,
      dokNrPelny: "ZD 1/2026",
      doc: created,
    });
  });

  it("pełne pokrycie tw+qty — bez getById", async () => {
    const getById = vi.fn();
    const created = doc({
      dok_Id: 7,
      dok_NrPelny: "ZD 7",
      dok_Pozycja: [
        { ob_TowId: 1, ob_Ilosc: 2 },
        { ob_TowId: 2, ob_Ilosc: 3 },
      ],
    });
    const r = await resolveDocAfterZdCreate({
      created,
      dokId: 7,
      createLines: [
        { twId: 1, ilosc: 2 },
        { twId: 2, ilosc: 3 },
      ],
      persistSnapshots: true,
      getById,
    });
    expect(getById).not.toHaveBeenCalled();
    expect(r.didReget).toBe(false);
    expect(r.source).toBe("create");
  });

  it("qty za niska przy tym samym tw — woła getById", async () => {
    const reget = doc({
      dok_Id: 7,
      dok_NrPelny: "ZD 7/full",
      dok_Pozycja: [{ ob_TowId: 1, ob_Ilosc: 5 }],
    });
    const getById = vi.fn().mockResolvedValue(reget);
    const created = doc({
      dok_Id: 7,
      dok_NrPelny: "ZD 7",
      dok_Pozycja: [{ ob_TowId: 1, ob_Ilosc: 1 }],
    });
    const r = await resolveDocAfterZdCreate({
      created,
      dokId: 7,
      createLines: [{ twId: 1, ilosc: 5 }],
      persistSnapshots: true,
      getById,
    });
    expect(getById).toHaveBeenCalledWith(7);
    expect(r).toMatchObject({
      source: "reget",
      didReget: true,
      dokNrPelny: "ZD 7/full",
      doc: reget,
    });
  });

  it("mismatch zestawu tw — woła getById", async () => {
    const reget = doc({
      dok_Id: 7,
      dok_NrPelny: "ZD 7/full",
      dok_Pozycja: [
        { ob_TowId: 1, ob_Ilosc: 1 },
        { ob_TowId: 2, ob_Ilosc: 1 },
        { ob_TowId: 3, ob_Ilosc: 1 },
      ],
    });
    const getById = vi.fn().mockResolvedValue(reget);
    const created = doc({
      dok_Id: 7,
      dok_NrPelny: "ZD 7",
      dok_Pozycja: [
        { ob_TowId: 1, ob_Ilosc: 1 },
        { ob_TowId: 2, ob_Ilosc: 1 },
        { ob_TowId: 9, ob_Ilosc: 1 },
      ],
    });
    const r = await resolveDocAfterZdCreate({
      created,
      dokId: 7,
      createLines: [
        { twId: 1, ilosc: 1 },
        { twId: 2, ilosc: 1 },
        { twId: 3, ilosc: 1 },
      ],
      persistSnapshots: true,
      getById,
    });
    expect(getById).toHaveBeenCalledWith(7);
    expect(r.source).toBe("reget");
  });

  it("brak dok_Status ⇒ nie fulfilled (eligible historii)", () => {
    expect(isFulfilledZdDocumentStatus({ dok_Status: undefined })).toBe(false);
    expect(isFulfilledZdDocumentStatus({})).toBe(false);
  });

  it("fallback numeru ZD/{id} gdy create bez dok_NrPelny", async () => {
    const r = await resolveDocAfterZdCreate({
      created: doc({ dok_Id: 42, dok_Pozycja: [] }),
      dokId: 42,
      createLines: [{ twId: 1, ilosc: 1 }],
      persistSnapshots: false,
      getById: vi.fn(),
    });
    expect(r.dokNrPelny).toBe("ZD/42");
  });

  it("błąd getById propaguje się (caller soft-fail z docSource null)", async () => {
    const getById = vi.fn().mockRejectedValue(new Error("ORDERS down"));
    await expect(
      resolveDocAfterZdCreate({
        created: doc({
          dok_Id: 9,
          dok_NrPelny: "ZD 9",
          dok_Pozycja: [{ ob_TowId: 1, ob_Ilosc: 1 }],
        }),
        dokId: 9,
        createLines: [{ twId: 1, ilosc: 5 }],
        persistSnapshots: true,
        getById,
      })
    ).rejects.toThrow("ORDERS down");
    expect(getById).toHaveBeenCalledWith(9);
  });
});
