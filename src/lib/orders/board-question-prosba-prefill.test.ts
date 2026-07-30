import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import {
  buildBoardQuestionProsbaPrefill,
  clearBoardQuestionProsbaPrefill,
  readBoardQuestionProsbaPrefill,
  writeBoardQuestionProsbaPrefill,
  BOARD_QUESTION_PROSBA_PREFILL_STORAGE_KEY,
} from "./board-question-prosba-prefill";

describe("board-question-prosba-prefill", () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    vi.stubGlobal("window", {
      sessionStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => {
          store.set(k, v);
        },
        removeItem: (k: string) => {
          store.delete(k);
        },
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("buduje linię prośby z produktu pytania", () => {
    const prefill = buildBoardQuestionProsbaPrefill(
      {
        product_symbol: "UP3DP53DC",
        product_name: "Up3D frezarka P53DC",
        subiekt_tw_id: 12345,
        mikran_code: "M123",
      },
      { threadId: "thread-1" }
    );
    expect(prefill?.threadId).toBe("thread-1");
    expect(prefill?.lines).toHaveLength(1);
    expect(prefill?.lines[0]).toMatchObject({
      symbol: "UP3DP53DC",
      product: "Up3D frezarka P53DC",
      mikranCode: "M123",
      subiektTwId: 12345,
      quantity: "",
      source: "subiekt",
    });
  });

  it("zwraca null bez produktu", () => {
    expect(
      buildBoardQuestionProsbaPrefill({
        product_symbol: null,
        product_name: null,
        subiekt_tw_id: null,
        mikran_code: null,
      })
    ).toBeNull();
  });

  it("zapisuje i odczytuje sessionStorage", () => {
    const built = buildBoardQuestionProsbaPrefill({
      product_symbol: "A",
      product_name: "Produkt A",
      subiekt_tw_id: 9,
      mikran_code: null,
    });
    expect(built).not.toBeNull();
    writeBoardQuestionProsbaPrefill(built!);
    expect(store.has(BOARD_QUESTION_PROSBA_PREFILL_STORAGE_KEY)).toBe(true);
    const read = readBoardQuestionProsbaPrefill();
    expect(read?.lines[0]?.product).toBe("Produkt A");
    expect(read?.lines[0]?.subiektTwId).toBe(9);
    clearBoardQuestionProsbaPrefill();
    expect(readBoardQuestionProsbaPrefill()).toBeNull();
  });
});
