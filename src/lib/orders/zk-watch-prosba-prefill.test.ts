import { describe, expect, it } from "vitest";
import {
  buildProsbaPrefillFromUrlParams,
  collectZkWatchAllowedTwIds,
  enrichZkProsbaPrefillWithStock,
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

  it("filtruje linie po lineKeys zgodnie z buildZkWatchLineViews gdy jest koszt przesyłki", () => {
    const watchWithShipping = {
      ...baseWatch,
      subiekt_snapshot: {
        dok_Pozycja: [
          { tw_Nazwa: "Szczotka", tw_Symbol: "SZ-1", ob_Ilosc: 1 },
          {
            tw_Nazwa: "pakowanie przesyłki/koszty dostawy",
            tw_Symbol: "KOSZTY/2",
            ob_Ilosc: 1,
          },
          { tw_Nazwa: "Uszczelka", tw_Symbol: "US-1", ob_Ilosc: 2 },
        ],
      },
    };
    const lines = extractProsbaLinesFromZkWatch(watchWithShipping, { lineKeys: ["idx:1"] });
    expect(lines).toHaveLength(1);
    expect(lines[0]?.product).toBe("Uszczelka");
  });

  it("zkProsbaPrefillFromWatch nie zwraca undefined w payloadzie serwera", () => {
    const prefill = zkProsbaPrefillFromWatch(baseWatch);
    expect(JSON.stringify(prefill)).not.toContain("undefined");
    expect(prefill).not.toHaveProperty("supplementLineCount");
    expect(prefill).not.toHaveProperty("lineKeys");
  });

  it("collectZkWatchAllowedTwIds zbiera tw_Id z całego ZK (nie zawęża lineKeys)", () => {
    const watchWithTwo = {
      ...baseWatch,
      subiekt_snapshot: {
        dok_Pozycja: [
          { tw_Nazwa: "Filtr", tw_Symbol: "FP-100", ob_Ilosc: 2, ob_TowId: 99, ob_Id: 1 },
          { tw_Nazwa: "Uszczelka", tw_Symbol: "US-1", ob_Ilosc: 1, ob_TowId: 55, ob_Id: 2 },
          {
            tw_Nazwa: "pakowanie przesyłki/koszty dostawy",
            tw_Symbol: "KOSZTY/2",
            ob_Ilosc: 1,
            ob_TowId: 1,
          },
        ],
      },
    };
    expect(collectZkWatchAllowedTwIds(watchWithTwo)).toEqual([55, 99]);
    const prefill = zkProsbaPrefillFromWatch(watchWithTwo, { lineKeys: ["ob:2"] });
    expect(prefill.lines).toHaveLength(1);
    expect(prefill.allowedTwIds).toEqual([55, 99]);
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

  it("enrichZkProsbaPrefillWithStock uzupełnia linie o stan magazynowy", () => {
    const prefill = zkProsbaPrefillFromWatch(baseWatch);
    const enriched = enrichZkProsbaPrefillWithStock(prefill, {
      99: { onHand: 10, reserved: 2, available: 8, source: "subiekt" },
    });
    expect(enriched.lines[0]?.stockSource).toBe("subiekt");
    expect(enriched.lines[0]?.available).toBe(8);
    expect(enriched.lines[0]?.onHand).toBe(10);
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

  it("dołącza notatkę sprawy do linii gdy include_note_in_prosba", () => {
    const prefill = zkProsbaPrefillFromWatch({
      ...baseWatch,
      note: "Klient prosi o ekspres",
      include_note_in_prosba: true,
    });
    expect(prefill.includeCaseNote).toBe(true);
    expect(prefill.caseNote).toBe("Klient prosi o ekspres");
    expect(prefill.lines.every((l) => l.requestNote === "Klient prosi o ekspres")).toBe(
      true
    );
  });

  it("nie dołącza notatki gdy flaga wyłączona", () => {
    const prefill = zkProsbaPrefillFromWatch({
      ...baseWatch,
      note: "prywatne",
      include_note_in_prosba: false,
    });
    expect(prefill.includeCaseNote).toBeUndefined();
    expect(prefill.lines.every((l) => !l.requestNote)).toBe(true);
  });

  it("przenosi teethDetails ze szkicu ZK do prefill", () => {
    const watchWithTeeth: SalesZkWatch = {
      ...baseWatch,
      subiekt_snapshot: {
        dok_Pozycja: [
          {
            tw_Nazwa: "Phonares przednie",
            tw_Symbol: "PH-A",
            ob_Ilosc: 2,
            ob_TowId: 101,
            ob_Id: 1,
          },
        ],
      },
      teeth_drafts: {
        "ob:1": {
          lineKey: "ob:1",
          subiektTwId: 101,
          teethManufacturer: "ivoclar",
          teethProductLine: "ivoclar_phonares_ii",
          teethKind: "anterior",
          expectedQuantity: 2,
          teethDetails: [
            { position: 1, color: "A2", mould: "S42", kind: "anterior" },
            { position: 2, color: "A2", mould: "S42", kind: "anterior" },
          ],
          updatedAt: "2026-01-01T00:00:00Z",
        },
      },
    };
    const prefill = zkProsbaPrefillFromWatch(watchWithTeeth);
    expect(prefill.lines).toHaveLength(1);
    expect(prefill.lines[0]?.teethKind).toBe("anterior");
    expect(prefill.lines[0]?.teethProductLine).toBe("ivoclar_phonares_ii");
    expect(prefill.lines[0]?.teethDetails).toHaveLength(2);
    expect(prefill.lines[0]?.quantity).toBe("2");
  });

  it("stashZkProsbaPrefill blokuje gdy teethDraftsIncomplete", () => {
    const teethWatch: SalesZkWatch = {
      ...baseWatch,
      subiekt_snapshot: {
        dok_Pozycja: [
          {
            tw_Nazwa: "Phonares przednie",
            tw_Symbol: "PH-A",
            ob_Ilosc: 2,
            ob_TowId: 101,
            ob_Id: 1,
          },
        ],
      },
      line_checks: [{ key: "ob:1", needs_prosba: true }],
    };
    const registry = {
      twIds: new Set([101]),
      manufacturerByTwId: new Map([[101, "ivoclar" as const]]),
      productLineByTwId: new Map([[101, "ivoclar_phonares_ii" as const]]),
      kindByTwId: new Map([[101, "anterior" as const]]),
    };
    expect(stashZkProsbaPrefill(teethWatch, { teethRegistry: registry })).toBe(false);

    const incompletePrefill = zkProsbaPrefillFromWatch(teethWatch, { teethRegistry: registry });
    expect(incompletePrefill.teethDraftsIncomplete).toBe(true);
    expect(incompletePrefill.lines).toHaveLength(0);

    const withDraft: SalesZkWatch = {
      ...teethWatch,
      teeth_drafts: {
        "ob:1": {
          lineKey: "ob:1",
          subiektTwId: 101,
          teethManufacturer: "ivoclar",
          teethProductLine: "ivoclar_phonares_ii",
          teethKind: "anterior",
          expectedQuantity: 2,
          teethDetails: [
            { position: 1, color: "A2", mould: "S42", kind: "anterior" },
            { position: 2, color: "A2", mould: "S42", kind: "anterior" },
          ],
          updatedAt: "2026-01-01T00:00:00Z",
        },
      },
    };

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
      expect(stashZkProsbaPrefill(withDraft, { teethRegistry: registry })).toBe(true);
      expect(storage.size).toBe(1);
    } finally {
      Object.defineProperty(globalThis, "sessionStorage", {
        configurable: true,
        value: original,
      });
    }
  });
});
