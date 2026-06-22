import { describe, expect, it } from "vitest";
import { summarizeZkWatchList } from "./zk-list-stats";
import type { SalesZkWatch } from "@/types/database";

function watch(overrides: Partial<SalesZkWatch> = {}): SalesZkWatch {
  return {
    id: "w1",
    sales_person_id: "sp1",
    zk_number: "1",
    client_label: "Klient",
    subiekt_dok_id: 1,
    subiekt_snapshot: {
      dok_Pozycja: [
        { tw_Nazwa: "A", tw_Symbol: null, ob_Ilosc: 1, tw_Id: 1 },
        { tw_Nazwa: "B", tw_Symbol: null, ob_Ilosc: 2, tw_Id: 2 },
      ],
    },
    line_checks: [],
    follow_up_at: null,
    note: null,
    created_at: "2026-01-01",
    updated_at: "2026-01-01",
    closed_at: null,
    ...overrides,
  } as SalesZkWatch;
}

describe("summarizeZkWatchList", () => {
  it("liczy ZK i pozycje", () => {
    const result = summarizeZkWatchList([watch(), watch({ id: "w2" })]);
    expect(result.watchCount).toBe(2);
    expect(result.lineCount).toBe(4);
  });

  it("sumuje pozycje na regale z podpowiedzi", () => {
    const hints = new Map([
      ["w1", { regalWaitingLineKeys: ["a", "b"], prosbaScopeConfigured: true } as never],
    ]);
    const result = summarizeZkWatchList([watch()], hints);
    expect(result.regalLineCount).toBe(2);
  });

  it("sumuje pozycje dostępne (informacja) z podpowiedzi", () => {
    const hints = new Map([
      [
        "w1",
        {
          regalWaitingLineKeys: [],
          informacjaReadyLineKeys: ["a", "b"],
          prosbaScopeConfigured: true,
        } as never,
      ],
    ]);
    const result = summarizeZkWatchList([watch()], hints);
    expect(result.informacjaReadyLineCount).toBe(2);
  });

  it("liczy tylko pozycje z wybranego zakresu gdy skonfigurowany", () => {
    const scoped = watch({
      id: "w-scoped",
      subiekt_snapshot: {
        dok_Pozycja: [
          { tw_Nazwa: "A", tw_Symbol: null, ob_Ilosc: 1, tw_Id: 1, ob_Id: 1 },
          { tw_Nazwa: "B", tw_Symbol: null, ob_Ilosc: 2, tw_Id: 2, ob_Id: 2 },
        ],
      },
      line_checks: [
        { key: "ob:1", arrived: false, needs_prosba: true },
        { key: "ob:2", arrived: false, needs_prosba: false },
      ],
    });
    const result = summarizeZkWatchList([scoped]);
    expect(result.lineCount).toBe(2);
  });

  it("pomija pozycje spoza zapisanego zakresu", () => {
    const scoped = watch({
      id: "w-partial",
      subiekt_snapshot: {
        dok_Pozycja: [
          { tw_Nazwa: "A", tw_Symbol: null, ob_Ilosc: 1, tw_Id: 1, ob_Id: 1 },
          { tw_Nazwa: "B", tw_Symbol: null, ob_Ilosc: 2, tw_Id: 2, ob_Id: 2 },
        ],
      },
      line_checks: [{ key: "ob:1", arrived: false, needs_prosba: true }],
    });
    const result = summarizeZkWatchList([scoped]);
    expect(result.lineCount).toBe(1);
  });
});
