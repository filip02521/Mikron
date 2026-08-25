import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  assertProsbaSubmitStockAllowed,
  findProsbaLinesWithSufficientStock,
  ProsbaSufficientStockError,
  PROSBA_STOCK_ACK_REQUIRED_CODE,
} from "./prosba-stock-server";

vi.mock("@/lib/orders/fetch-prosba-line-stock", () => ({
  fetchProsbaLineStock: vi.fn(),
}));

vi.mock("@/lib/data/teeth-products", () => ({
  fetchTeethProductTwIdSet: vi.fn().mockResolvedValue(new Set<number>()),
}));

import { fetchProsbaLineStock } from "@/lib/orders/fetch-prosba-line-stock";
import { fetchTeethProductTwIdSet } from "@/lib/data/teeth-products";

const mockFetch = vi.mocked(fetchProsbaLineStock);
const mockTeethTwIds = vi.mocked(fetchTeethProductTwIdSet);

describe("assertProsbaSubmitStockAllowed", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockTeethTwIds.mockReset();
    mockTeethTwIds.mockResolvedValue(new Set<number>());
  });

  it("pomija informację", async () => {
    await expect(
      assertProsbaSubmitStockAllowed({
        lines: [{ subiektTwId: 1, quantity: "1", available: 100, stockSource: "subiekt" }],
        requestKind: "informacja",
      })
    ).resolves.toBeUndefined();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("nie blokuje gdy brak danych magazynowych", async () => {
    mockFetch.mockResolvedValue({});
    await expect(
      assertProsbaSubmitStockAllowed({
        lines: [{ subiektTwId: 1, quantity: "2", product: "Śruba" }],
        requestKind: "zamowienie",
      })
    ).resolves.toBeUndefined();
  });

  it("blokuje przy pełnym stanie bez ack", async () => {
    mockFetch.mockResolvedValue({
      1: { onHand: 10, reserved: 0, available: 10, source: "subiekt" },
    });
    await expect(
      assertProsbaSubmitStockAllowed({
        lines: [{ subiektTwId: 1, quantity: "2", product: "Śruba" }],
        requestKind: "zamowienie",
      })
    ).rejects.toMatchObject({
      code: PROSBA_STOCK_ACK_REQUIRED_CODE,
    });
  });

  it("przepuszcza z acknowledgeSufficientStock", async () => {
    mockFetch.mockResolvedValue({
      1: { onHand: 10, reserved: 0, available: 10, source: "subiekt" },
    });
    await expect(
      assertProsbaSubmitStockAllowed({
        lines: [{ subiektTwId: 1, quantity: "2", product: "Śruba" }],
        requestKind: "zamowienie",
        acknowledgeSufficientStock: true,
      })
    ).resolves.toBeUndefined();
  });

  it("ProsbaSufficientStockError ma czytelny komunikat", async () => {
    mockFetch.mockResolvedValue({
      1: { onHand: 5, reserved: 0, available: 5, source: "subiekt" },
    });
    try {
      await assertProsbaSubmitStockAllowed({
        lines: [{ subiektTwId: 1, quantity: "1", product: "Implant" }],
        requestKind: "zamowienie",
      });
      expect.fail("expected throw");
    } catch (e) {
      expect(e).toBeInstanceOf(ProsbaSufficientStockError);
      expect((e as ProsbaSufficientStockError).message).toContain("Implant");
    }
  });

  it("pomija produkty z listy zębów", async () => {
    mockFetch.mockResolvedValue({
      42: { onHand: 10, reserved: 0, available: 10, source: "subiekt" },
    });
    const sufficient = await findProsbaLinesWithSufficientStock({
      lines: [{ subiektTwId: 42, quantity: "1", product: "Implant" }],
      requestKind: "zamowienie",
      stockExemptTwIds: new Set([42]),
    });
    expect(sufficient).toEqual([]);
  });

  it("stockByTwId z klienta — bez fetchProsbaLineStock", async () => {
    const snapshot = {
      7: { onHand: 3, reserved: 0, available: 3, source: "subiekt" as const },
    };
    await expect(
      assertProsbaSubmitStockAllowed({
        lines: [{ subiektTwId: 7, quantity: "1", product: "Filtr" }],
        requestKind: "zamowienie",
        stockByTwId: snapshot,
      })
    ).rejects.toMatchObject({ code: PROSBA_STOCK_ACK_REQUIRED_CODE });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("pusty stockByTwId w find — nadal fetchuje Subiekt", async () => {
    mockFetch.mockResolvedValue({
      3: { onHand: 1, reserved: 0, available: 1, source: "subiekt" },
    });
    const sufficient = await findProsbaLinesWithSufficientStock({
      lines: [{ subiektTwId: 3, quantity: "1", product: "X" }],
      requestKind: "zamowienie",
    });
    expect(mockFetch).toHaveBeenCalledWith([3]);
    expect(sufficient).toHaveLength(1);
  });

  it("ack przepuszcza przy tym samym snapshot co klient", async () => {
    const snapshot = {
      8: { onHand: 10, reserved: 0, available: 10, source: "subiekt" as const },
    };
    await expect(
      assertProsbaSubmitStockAllowed({
        lines: [{ subiektTwId: 8, quantity: "2", product: "Śruba" }],
        requestKind: "zamowienie",
        acknowledgeSufficientStock: true,
        stockByTwId: snapshot,
      })
    ).resolves.toBeUndefined();
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
