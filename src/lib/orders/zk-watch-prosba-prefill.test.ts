import { describe, expect, it } from "vitest";
import {
  buildProsbaPrefillFromUrlParams,
  extractProsbaLinesFromZkWatch,
  parseProsbaClientKhParam,
  parseProsbaZkLineKeysParam,
  prosbaHrefFromZkWatch,
  stashZkProsbaPrefill,
  zkProsbaPrefillFromWatch,
} from "./zk-watch-prosba-prefill";
import type { SalesZkWatch } from "@/types/database";

const baseWatch: SalesZkWatch = {
  id: "w1",
  sales_person_id: "sp1",
  subiekt_dok_id: 1,
  zk_number: "ZK/2026/0138",
  client_label: "Klinika Smile",
  client_kh_id: 1,
  amount_net: null,
  amount_gross: null,
  zk_issued_at: null,
  note: null,
  line_summary: "Filtr XYZ",
  subiekt_snapshot: {
    dok_Pozycja: [
      { tw_Nazwa: "Filtr powietrza XYZ", tw_Symbol: "FP-100", ob_Ilosc: 2, ob_TowId: 99 },
    ],
  },
  line_checks: [],
  follow_up_at: null,
  closed_at: null,
  archived_at: null,
  created_at: "",
  updated_at: "",
};

describe("zk-watch-prosba-prefill", () => {
  it("extractProsbaLinesFromZkWatch mapuje pozycje ZK", () => {
    const lines = extractProsbaLinesFromZkWatch(baseWatch);
    expect(lines).toHaveLength(1);
    expect(lines[0]?.product).toBe("Filtr powietrza XYZ");
    expect(lines[0]?.symbol).toBe("FP-100");
    expect(lines[0]?.quantity).toBe("2");
    expect(lines[0]?.clientName).toBe("Klinika Smile");
    expect(lines[0]?.clientKhId).toBe(1);
    expect(lines[0]?.subiektTwId).toBe(99);
  });

  it("filtruje linie prefill po lineKeys", () => {
    const watchWithTwo = {
      ...baseWatch,
      subiekt_snapshot: {
        dok_Pozycja: [
          { tw_Nazwa: "Filtr powietrza XYZ", tw_Symbol: "FP-100", ob_Ilosc: 2, ob_TowId: 99, ob_Id: 1 },
          { tw_Nazwa: "Uszczelka", tw_Symbol: "US-1", ob_Ilosc: 1, ob_TowId: 55, ob_Id: 2 },
        ],
      },
    };
    const lines = extractProsbaLinesFromZkWatch(watchWithTwo, { lineKeys: ["ob:2"] });
    expect(lines).toHaveLength(1);
    expect(lines[0]?.product).toBe("Uszczelka");
  });

  it("zwraca pustą listę gdy lineKeys nie pasują do żadnej pozycji", () => {
    const lines = extractProsbaLinesFromZkWatch(baseWatch, { lineKeys: ["ob:missing"] });
    expect(lines).toEqual([]);
  });

  it("pomija koszty przesyłki w liniach prośby", () => {
    const lines = extractProsbaLinesFromZkWatch({
      ...baseWatch,
      subiekt_snapshot: {
        dok_Pozycja: [
          { tw_Nazwa: "Szczotka", tw_Symbol: "SZ-1", ob_Ilosc: 1, ob_TowId: 1 },
          {
            tw_Nazwa: "pakowanie przesyłki/koszty dostawy",
            tw_Symbol: "KOSZTY/2",
            ob_Ilosc: 1,
            ob_TowId: 2,
          },
        ],
      },
    });
    expect(lines).toHaveLength(1);
    expect(lines[0]?.product).toBe("Szczotka");
  });

  it("prosbaHrefFromZkWatch buduje link z parametrami ZK", () => {
    const href = prosbaHrefFromZkWatch(baseWatch);
    expect(href).toContain("fromZk=1");
    expect(href).toContain("dla=sp1");
    expect(href).toContain("zkWatch=w1");
    expect(href).toContain("zk=ZK%2F2026%2F0138");
    expect(href).toContain("kh=1");
  });

  it("prosbaHrefFromZkWatch dodaje zkLines dla uzupełniającej prośby", () => {
    const href = prosbaHrefFromZkWatch(baseWatch, { lineKeys: ["ob:1", "ob:2"] });
    expect(href).toContain("zkLines=ob%3A1%2Cob%3A2");
  });

  it("buildProsbaPrefillFromUrlParams buduje minimalny prefill", () => {
    const prefill = buildProsbaPrefillFromUrlParams({
      klient: "Klinika Smile",
      kh: "42",
      zk: "ZK/1",
      zkWatch: "watch-uuid",
    });
    expect(prefill?.clientName).toBe("Klinika Smile");
    expect(prefill?.clientKhId).toBe(42);
    expect(prefill?.zkWatchId).toBe("watch-uuid");
    expect(prefill?.lines[0]?.clientKhId).toBe(42);
  });

  it("parseProsbaClientKhParam odrzuca nieprawidłowe wartości", () => {
    expect(parseProsbaClientKhParam("0")).toBeNull();
    expect(parseProsbaClientKhParam("abc")).toBeNull();
    expect(parseProsbaClientKhParam("99")).toBe(99);
  });

  it("parseProsbaZkLineKeysParam parsuje klucze linii z URL", () => {
    expect(parseProsbaZkLineKeysParam("ob:1,ob:2")).toEqual(["ob:1", "ob:2"]);
    expect(parseProsbaZkLineKeysParam("")).toBeUndefined();
  });

  it("zkProsbaPrefillFromWatch zachowuje lineKeys dla uzupełnienia", () => {
    const prefill = zkProsbaPrefillFromWatch(baseWatch, {
      lineKeys: ["ob:0"],
      mode: "supplement",
    });
    expect(prefill.lineKeys).toEqual(["ob:0"]);
    expect(prefill.mode).toBe("supplement");
  });

  it("stashZkProsbaPrefill zwraca false gdy brak linii po filtrze", () => {
    const storage = new Map<string, string>();
    const original = globalThis.sessionStorage;
    Object.defineProperty(globalThis, "sessionStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => {
          storage.set(key, value);
        },
        removeItem: (key: string) => {
          storage.delete(key);
        },
      },
    });

    try {
      expect(
        stashZkProsbaPrefill(baseWatch, { lineKeys: ["ob:missing"], mode: "supplement" })
      ).toBe(false);
      expect(storage.size).toBe(0);
    } finally {
      Object.defineProperty(globalThis, "sessionStorage", {
        configurable: true,
        value: original,
      });
    }
  });
});
