import { describe, expect, it } from "vitest";
import { summarizeSyncResults } from "./copy";

const noDiff = { addedLineKeys: [], removedLineKeys: [], quantityChanged: [] };

describe("summarizeSyncResults", () => {
  it("brak zmian — potwierdzenie, że wszystko aktualne", () => {
    expect(summarizeSyncResults([{ zkNumber: "ZK 1", status: "unchanged", diff: null }])).toEqual({
      tone: "success",
      title: "Wszystkie ZK są aktualne",
      items: ["Sprawdzono 1 ZK — bez zmian w Subiekcie."],
    });
  });

  it("zmiany ilości, korekta palet i podmiana ZK", () => {
    const out = summarizeSyncResults([
      {
        zkNumber: "ZK 7942",
        status: "synced",
        diff: { ...noDiff, quantityChanged: [{ key: "ob:1", from: 1008, to: 504 }] },
        rebalanced: 1,
      },
      { zkNumber: "ZK 115523", status: "synced", diff: null, replacedDokId: 99 },
    ]);
    expect(out.tone).toBe("info");
    expect(out.items).toEqual([
      "ZK 7942: palety 1 pozycji dopasowano do nowej ilości, zmieniono ilość: 1",
      "ZK 115523: podpięto nowy dokument ZK o tym samym numerze",
    ]);
  });

  it("ZK usunięte w Subiekcie i konflikt w innym oknie", () => {
    const out = summarizeSyncResults([
      { zkNumber: "ZK 115523", status: "missing", diff: null, error: "Tego ZK nie ma już w Subiekcie" },
      { zkNumber: "ZK 8520", status: "locked", diff: null },
    ]);
    expect(out.tone).toBe("warning");
    expect(out.items).toEqual([
      "ZK 115523: Tego ZK nie ma już w Subiekcie",
      "1 ZK odświeża się w innym oknie — wynik pojawi się za chwilę.",
    ]);
  });
});
