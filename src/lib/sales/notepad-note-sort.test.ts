import { describe, expect, it } from "vitest";
import {
  filterSalesNotesByQuery,
  notesInSamePinBand,
  reorderNoteIds,
  sortSalesNotes,
} from "./notepad-note-sort";
import type { SalesNote } from "@/types/database";

function note(id: string, sort_order: number, pinned = false): SalesNote {
  return {
    id,
    sales_person_id: "sp1",
    title: null,
    body: id,
    color: "default",
    pinned,
    sort_order,
    archived_at: null,
    follow_up_at: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}

describe("notepad-note-sort", () => {
  it("sortuje pinned przed resztą, potem sort_order", () => {
    const sorted = sortSalesNotes([note("b", 1), note("a", 0, true), note("c", 2)]);
    expect(sorted.map((n) => n.id)).toEqual(["a", "b", "c"]);
  });

  it("przesuwa element w obrębie sekcji pinned", () => {
    const notes = [note("a", 0, true), note("b", 1, true), note("c", 2)];
    expect(reorderNoteIds(notes, "b", "a")).toEqual(["b", "a", "c"]);
  });

  it("blokuje przeniesienie między sekcjami pinned", () => {
    const notes = [note("a", 0, true), note("b", 1)];
    expect(reorderNoteIds(notes, "a", "b")).toBeNull();
    expect(notesInSamePinBand(note("a", 0, true), note("b", 1))).toBe(false);
  });

  it("filtruje notatki po tytule i treści", () => {
    const notes = [
      { ...note("a", 0), title: "Faktura", body: "xyz" },
      { ...note("b", 1), title: null, body: "Oddzwonić do klienta" },
    ];
    expect(filterSalesNotesByQuery(notes, "faktura").map((n) => n.id)).toEqual(["a"]);
    expect(filterSalesNotesByQuery(notes, "klient").map((n) => n.id)).toEqual(["b"]);
    expect(filterSalesNotesByQuery(notes, "")).toHaveLength(2);
  });
});
