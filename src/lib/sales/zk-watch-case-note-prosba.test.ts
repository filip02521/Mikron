import { describe, expect, it } from "vitest";
import {
  applyZkCaseNoteToProsbaLines,
  deriveZkCaseNotePendingAttachKind,
  deriveZkCaseNoteProsbaStatus,
  resolveZkCaseNoteSyncOrderIds,
  shouldIncludeZkCaseNoteInPrefill,
  zkCaseNoteAttachActionLabel,
  zkCaseNoteMatchesRequestNote,
  zkCaseNoteProsbaStatusCopy,
  zkCaseNoteWithoutNoteCountLabel,
} from "./zk-watch-case-note-prosba";

describe("zk-watch-case-note-prosba", () => {
  it("dopasowuje notatkę sprawy i prośby po trim", () => {
    expect(zkCaseNoteMatchesRequestNote("  pilne  ", "pilne")).toBe(true);
    expect(zkCaseNoteMatchesRequestNote("a", "b")).toBe(false);
    expect(zkCaseNoteMatchesRequestNote("", "x")).toBe(false);
  });

  it("status: brak / prywatna / planowana / w prośbie", () => {
    expect(
      deriveZkCaseNoteProsbaStatus({
        note: null,
        includeNoteInProsba: false,
        openOrderCount: 0,
        openOrdersWithMatchingNoteCount: 0,
      })
    ).toBe("none");

    expect(
      deriveZkCaseNoteProsbaStatus({
        note: "pilne",
        includeNoteInProsba: false,
        openOrderCount: 0,
        openOrdersWithMatchingNoteCount: 0,
      })
    ).toBe("private");

    expect(
      deriveZkCaseNoteProsbaStatus({
        note: "pilne",
        includeNoteInProsba: true,
        openOrderCount: 0,
        openOrdersWithMatchingNoteCount: 0,
      })
    ).toBe("planned");

    expect(
      deriveZkCaseNoteProsbaStatus({
        note: "pilne",
        includeNoteInProsba: true,
        openOrderCount: 2,
        openOrdersWithMatchingNoteCount: 1,
      })
    ).toBe("planned_pending_attach");

    expect(
      deriveZkCaseNoteProsbaStatus({
        note: "pilne",
        includeNoteInProsba: false,
        openOrderCount: 1,
        openOrdersWithMatchingNoteCount: 1,
      })
    ).toBe("in_prosba");

    expect(
      deriveZkCaseNoteProsbaStatus({
        note: "pilne",
        includeNoteInProsba: false,
        openOrderCount: 2,
        openOrdersWithMatchingNoteCount: 1,
      })
    ).toBe("private");
  });

  it("copy statusów rozróżnia brak i nieaktualną treść", () => {
    expect(zkCaseNoteProsbaStatusCopy("private").label).toMatch(/Ciebie/i);
    expect(zkCaseNoteProsbaStatusCopy("in_prosba").label).toMatch(/prośbie/i);
    expect(zkCaseNoteProsbaStatusCopy("planned").label).toMatch(/prośby/i);
    expect(zkCaseNoteProsbaStatusCopy("planned_pending_attach", "stale").label).toMatch(
      /aktualiz/i
    );
    expect(zkCaseNoteAttachActionLabel("stale")).toMatch(/Zaktualizuj/i);
    expect(zkCaseNoteWithoutNoteCountLabel(2)).toBe("2 pozycje bez aktualnej notatki");
  });

  it("aplikuje notatkę na wszystkie linie prefill", () => {
    const next = applyZkCaseNoteToProsbaLines(
      [
        { requestNote: undefined },
        { requestNote: "stara" },
      ],
      "  z ZK  "
    );
    expect(next.every((l) => l.requestNote === "z ZK")).toBe(true);
  });

  it("shouldIncludeZkCaseNoteInPrefill wymaga flagi i treści", () => {
    expect(
      shouldIncludeZkCaseNoteInPrefill({ note: "x", include_note_in_prosba: true })
    ).toBe(true);
    expect(
      shouldIncludeZkCaseNoteInPrefill({ note: "x", include_note_in_prosba: false })
    ).toBe(false);
    expect(
      shouldIncludeZkCaseNoteInPrefill({ note: "", include_note_in_prosba: true })
    ).toBe(false);
  });

  it("safe sync aktualizuje puste i poprzednią treść ZK, bez obcej notatki", () => {
    const orders = [
      { id: "a", sales_request_note: "stara" },
      { id: "b", sales_request_note: null },
      { id: "c", sales_request_note: "obca od zakupów" },
      { id: "d", sales_request_note: "nowa" },
    ];
    expect(
      resolveZkCaseNoteSyncOrderIds({
        openOrders: orders as never,
        previousCaseNote: "stara",
        nextCaseNote: "nowa",
        mode: "safe_from_previous",
      })
    ).toEqual(["a", "b"]);
  });

  it("force sync nadpisuje wszystkie niedopasowane", () => {
    expect(
      resolveZkCaseNoteSyncOrderIds({
        openOrders: [
          { id: "a", sales_request_note: "stara" },
          { id: "b", sales_request_note: "nowa" },
        ] as never,
        previousCaseNote: "stara",
        nextCaseNote: "nowa",
        mode: "force_mismatched",
      })
    ).toEqual(["a"]);
  });

  it("safe sync przy kasowaniu czyści tylko poprzednią treść ZK", () => {
    expect(
      resolveZkCaseNoteSyncOrderIds({
        openOrders: [
          { id: "a", sales_request_note: "stara" },
          { id: "b", sales_request_note: "inna" },
        ] as never,
        previousCaseNote: "stara",
        nextCaseNote: null,
        mode: "safe_from_previous",
      })
    ).toEqual(["a"]);
  });

  it("pending kind: missing / stale / mixed", () => {
    expect(deriveZkCaseNotePendingAttachKind([{ sales_request_note: null }])).toBe(
      "missing"
    );
    expect(deriveZkCaseNotePendingAttachKind([{ sales_request_note: "x" }])).toBe(
      "stale"
    );
    expect(
      deriveZkCaseNotePendingAttachKind([
        { sales_request_note: null },
        { sales_request_note: "x" },
      ])
    ).toBe("mixed");
  });
});
