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
        "palletLabels",
        "sortOrder",
        "subiektDokId",
        "zkNumber",
      ].sort()
    );
  });
});
