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

import { fetchProsbaLineStock } from "@/lib/orders/fetch-prosba-line-stock";

const mockFetch = vi.mocked(fetchProsbaLineStock);

describe("assertProsbaSubmitStockAllowed", () => {
  beforeEach(() => {
    mockFetch.mockReset();
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
});
