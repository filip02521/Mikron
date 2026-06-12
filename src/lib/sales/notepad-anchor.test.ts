import { describe, expect, it } from "vitest";
import {
  NOTEPAD_ANCHOR_FLASH_CLASSES,
  parseNotepadHashAnchor,
  resolveNotepadWatchFocusId,
  watchIdFromNotepadAnchor,
} from "./notepad-anchor";

describe("notepad-anchor", () => {
  it("parsuje kotwice ZK i notatek", () => {
    expect(parseNotepadHashAnchor("#watch-abc")).toBe("watch-abc");
    expect(parseNotepadHashAnchor("note-n1")).toBe("note-n1");
    expect(parseNotepadHashAnchor("#other")).toBeNull();
  });

  it("wyciąga id ZK z kotwicy", () => {
    expect(watchIdFromNotepadAnchor("watch-abc")).toBe("abc");
    expect(watchIdFromNotepadAnchor("note-abc")).toBeNull();
  });

  it("preferuje focusWatch z query przed hashem", () => {
    expect(resolveNotepadWatchFocusId("#watch-from-hash", "from-query")).toBe("from-query");
    expect(resolveNotepadWatchFocusId("#watch-from-hash", null)).toBe("from-hash");
  });

  it("podświetlenie kotwicy jest wewnętrzne (ring-inset, bez offsetu)", () => {
    expect(NOTEPAD_ANCHOR_FLASH_CLASSES).toContain("ring-inset");
    expect(NOTEPAD_ANCHOR_FLASH_CLASSES).not.toContain("ring-offset-2");
  });
});
