import { describe, expect, it, vi } from "vitest";
import {
  repairIncompleteIndividualOrders,
  repairTeethOrdersFromVerification,
} from "./repair-incomplete-orders";

/** Łańcuch odczytu stronami: select → filtry → order → range (pierwsza strona = całość). */
function readChain(rows: Record<string, unknown>[]) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const m of ["select", "eq", "in", "order"]) chain[m] = vi.fn(() => chain);
  chain.range = vi.fn().mockResolvedValue({ data: rows, error: null });
  return chain;
}

function mockSupabase(rows: Record<string, unknown>[]) {
  const inMock = vi.fn().mockResolvedValue({ error: null });
  const updateMock = vi.fn().mockReturnValue({ in: inMock });
  return {
    from: vi.fn(() => ({ ...readChain(rows), update: updateMock })),
    updateMock,
    inMock,
  };
}

describe("repairIncompleteIndividualOrders", () => {
  it("nie przenosi zębów do Weryfikacja", async () => {
    const supabase = mockSupabase([
      {
        id: "teeth-1",
        supplier_id: null,
        symbol: "Z",
        products: "Ząb",
        mikran_code: null,
        quantity: "1",
        request_kind: "zamowienie",
        status: "Nowe",
        is_teeth: true,
      },
      {
        id: "regular-1",
        supplier_id: null,
        symbol: "A",
        products: "Wkręt",
        mikran_code: null,
        quantity: "1",
        request_kind: "zamowienie",
        status: "Nowe",
        is_teeth: false,
      },
    ]);

    const fixed = await repairIncompleteIndividualOrders(supabase as never);
    expect(fixed).toBe(1);
    expect(supabase.updateMock).toHaveBeenCalledWith({ status: "Weryfikacja" });
    expect(supabase.inMock).toHaveBeenCalledWith("id", ["regular-1"]);
  });

  it("zwraca 0 gdy wszystkie prośby są kompletne", async () => {
    const supabase = mockSupabase([
      {
        id: "ok-1",
        supplier_id: "s1",
        symbol: "A",
        products: "Wkręt",
        mikran_code: "123",
        quantity: "2",
        request_kind: "zamowienie",
        status: "Nowe",
        is_teeth: false,
      },
    ]);

    const fixed = await repairIncompleteIndividualOrders(supabase as never);
    expect(fixed).toBe(0);
    expect(supabase.updateMock).not.toHaveBeenCalled();
  });
});

describe("repairTeethOrdersFromVerification", () => {
  it("przywraca zęby ze statusu Weryfikacja do Nowe (pomija OCR pending)", async () => {
    const inMock = vi.fn().mockResolvedValue({ error: null });
    const updateMock = vi.fn().mockReturnValue({ in: inMock });
    const selectChain = readChain([{ id: "teeth-v1" }]);
    const supabase = {
      from: vi.fn(() => ({ ...selectChain, update: updateMock })),
      updateMock,
      inMock,
    };

    const fixed = await repairTeethOrdersFromVerification(supabase as never);
    expect(fixed).toBe(1);
    expect(updateMock).toHaveBeenCalledWith({ status: "Nowe" });
    expect(inMock).toHaveBeenCalledWith("id", ["teeth-v1"]);
    expect(selectChain.eq).toHaveBeenCalledWith("teeth_ocr_pending", false);
  });
});
