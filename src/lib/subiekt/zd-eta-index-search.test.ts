import { describe, expect, it, vi } from "vitest";
import type { SubiektDocument } from "./types";

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

import {
  fetchZdDocsByDokIds,
  filterZdIndexRowsForPlacement,
  filterZdIndexRowsForPlacements,
  zdIndexRowsToCandidates,
} from "./zd-eta-index-search";
import { sortZdCandidatesByPlacementDate } from "./zd-placement-sort";

function doc(id: number): SubiektDocument {
  return { dok_Id: id, dok_Pozycja: [] };
}

describe("filterZdIndexRowsForPlacement", () => {
  const rows = [
    { dok_id: 1, dok_nr_pelny: "ZD 1", dok_data_wyst: "2026-01-15" },
    { dok_id: 2, dok_nr_pelny: "ZD 2", dok_data_wyst: "2026-02-20" },
    { dok_id: 3, dok_nr_pelny: "ZD 3", dok_data_wyst: "2026-06-01" },
    { dok_id: 4, dok_nr_pelny: "ZD 4", dok_data_wyst: "2026-07-01" },
  ];

  it("zostawia ZD z okna wokół lutowego zgłoszenia", () => {
    const filtered = filterZdIndexRowsForPlacement(rows, "2026-02-10");
    expect(filtered.map((r) => r.dok_id)).toEqual([1, 2]);
  });

  it("filterZdIndexRowsForPlacements — suma okien wielu dat", () => {
    const filtered = filterZdIndexRowsForPlacements(rows, ["2026-02-10", "2026-06-15"]);
    expect(filtered.map((r) => r.dok_id)).toEqual([1, 2, 3]);
  });
});
describe("zdIndexRowsToCandidates", () => {
  it("deduplikuje dok_id", () => {
    expect(
      zdIndexRowsToCandidates([
        { dok_id: 1, dok_nr_pelny: "A", dok_data_wyst: "2026-06-10" },
        { dok_id: 1, dok_nr_pelny: "A", dok_data_wyst: "2026-06-10" },
        { dok_id: 2, dok_nr_pelny: "B", dok_data_wyst: "2026-06-09" },
      ])
    ).toEqual([
      { id: 1, issueDate: "2026-06-10" },
      { id: 2, issueDate: "2026-06-09" },
    ]);
  });
});

describe("sortZdCandidatesByPlacementDate", () => {
  it("preferuje ZD po dacie zamówienia", () => {
    const sorted = sortZdCandidatesByPlacementDate(
      [
        { id: 100, issueDate: "2026-06-20" },
        { id: 62, issueDate: "2026-06-09" },
      ],
      "2026-06-08"
    );
    expect(sorted[0]?.id).toBe(62);
  });
});

describe("fetchZdDocsByDokIds", () => {
  it("pobiera dokumenty po dok_Id i zatrzymuje się na matchDoc", async () => {
    const loadDoc = vi.fn(async (id: number) => doc(id));
    const matchDoc = vi.fn((d: SubiektDocument) => d.dok_Id === 62);

    const result = await fetchZdDocsByDokIds({
      candidates: [
        { id: 100, issueDate: "2026-06-20" },
        { id: 62, issueDate: "2026-06-09" },
      ],
      preferIssueDateNear: "2026-06-08",
      maxDocsToFetch: 5,
      loadDoc,
      matchDoc,
    });

    expect(result.matched?.dok_Id).toBe(62);
    expect(loadDoc.mock.calls[0]?.[0]).toBe(62);
    expect(loadDoc).toHaveBeenCalledTimes(1);
  });

  it("selectBestFromDocs zatrzymuje wcześniej przy pewnym trafieniu", async () => {
    const loadDoc = vi.fn(async (id: number) =>
      id === 62
        ? ({
            dok_Id: 62,
            dok_TerminRealizacji: "2026-08-01",
            dok_Pozycja: [{ ob_TowId: 1, tw_Symbol: "ABC", ob_Ilosc: 10 }],
          } as SubiektDocument)
        : doc(id)
    );

    const result = await fetchZdDocsByDokIds({
      candidates: [
        { id: 62, issueDate: "2026-06-09" },
        { id: 100, issueDate: "2026-06-20" },
      ],
      maxDocsToFetch: 5,
      loadDoc,
      selectBestFromDocs: (docs) => docs.find((d) => d.dok_Id === 62) ?? null,
      shouldStopAfterBest: () => true,
    });

    expect(result.matched?.dok_Id).toBe(62);
    expect(loadDoc).toHaveBeenCalledTimes(1);
  });
});
