import { describe, expect, it } from "vitest";
import { subiektLeadTimesDue } from "./subiekt-lead-times-catchup";

describe("subiektLeadTimesDue", () => {
  it("bez stanu albo po błędzie — do zrobienia", () => {
    expect(subiektLeadTimesDue(null, "2026-10-25")).toBe(true);
    expect(subiektLeadTimesDue({ at: "2026-10-25T00:10:00Z", ok: false }, "2026-10-25")).toBe(true);
    expect(subiektLeadTimesDue({ at: "nie-data", ok: true }, "2026-10-25")).toBe(true);
  });

  it("udana synchronizacja dziś (także ręczna) — nie powtarza", () => {
    expect(subiektLeadTimesDue({ at: "2026-10-25T00:10:00Z", ok: true }, "2026-10-25")).toBe(false);
  });

  it("dzień liczony po Warszawie, nie UTC", () => {
    // 23:30 UTC 24.10 = 01:30 25.10 w Warszawie (CEST)
    expect(subiektLeadTimesDue({ at: "2026-10-24T23:30:00Z", ok: true }, "2026-10-25")).toBe(false);
    // 21:30 UTC 24.10 = 23:30 24.10 w Warszawie — wczorajsza
    expect(subiektLeadTimesDue({ at: "2026-10-24T21:30:00Z", ok: true }, "2026-10-25")).toBe(true);
  });
});
