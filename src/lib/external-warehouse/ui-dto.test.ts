import { describe, expect, it } from "vitest";
import type { GadkiZkLinkView } from "@/lib/data/external-warehouse-gadki";

describe("Gadki UI DTO contract", () => {
  it("link view nie zawiera last_snapshot / raw JSON", () => {
    const sample: GadkiZkLinkView = {
      id: "11111111-1111-4111-8111-111111111111",
      subiektDokId: 1,
      zkNumber: "ZK-1",
      clientLabel: "Klient",
      label: null,
      lineSummary: null,
      lastSyncedAt: null,
      syncError: null,
      syncErrorAt: null,
      subiektStatusLabel: "Aktywne",
      realized: false,
      overAllocatedCount: 0,
      sortOrder: 0,
      lines: [],
      orphanLines: [],
      palletLabels: [],
    };
    expect(sample).not.toHaveProperty("last_snapshot");
    expect(sample).not.toHaveProperty("snapshot_hash");
    expect(Object.keys(sample).sort()).toEqual(
      [
        "clientLabel",
        "id",
        "label",
        "lastSyncedAt",
        "lineSummary",
        "lines",
        "orphanLines",
        "overAllocatedCount",
        "palletLabels",
        "realized",
        "sortOrder",
        "subiektDokId",
        "subiektStatusLabel",
        "syncError",
        "syncErrorAt",
        "zkNumber",
      ].sort()
    );
  });
});
