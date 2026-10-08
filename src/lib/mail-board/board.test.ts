import { describe, expect, it } from "vitest";
import { addBusinessDaysKey, deriveColumn, type BoardRow } from "./board";

const row = (r: Partial<BoardRow>): BoardRow => ({
  column: null,
  columnSetAt: "2026-10-05T10:00:00.000Z",
  note: "",
  waitingOn: "",
  remindOn: null,
  assigneeId: null,
  ...r,
});
const today = "2026-10-08";

describe("addBusinessDaysKey", () => {
  it("pomija weekend i święta", () => {
    expect(addBusinessDaysKey("2026-10-08", 3)).toBe("2026-10-13"); // czw → wt
    expect(addBusinessDaysKey("2026-11-09", 3)).toBe("2026-11-13"); // 11.11 święto
  });
});

describe("deriveColumn", () => {
  const auto = { column: "todo" as const, remindOn: null };

  it("bez wpisu: kolumna z poczty", () => {
    expect(deriveColumn({ auto, lastIncomingAt: null, repliedAt: null, row: null, today }).column).toBe("todo");
  });

  it("ręczna kolumna wygrywa", () => {
    expect(deriveColumn({ auto, lastIncomingAt: "2026-10-05T09:00:00Z", repliedAt: null, row: row({ column: "doing" }), today }).column).toBe("doing");
  });

  it("nowa wiadomość w czekam / zakończone wraca do Do zrobienia", () => {
    for (const column of ["waiting", "done"] as const) {
      const d = deriveColumn({ auto, lastIncomingAt: "2026-10-06T09:00:00Z", repliedAt: null, row: row({ column, remindOn: "2026-10-20" }), today });
      expect(d).toMatchObject({ column: "todo", reason: "Nowa wiadomość" });
    }
  });

  it("nowa wiadomość w W trakcie zostaje, z oznaczeniem", () => {
    const d = deriveColumn({ auto, lastIncomingAt: "2026-10-06T09:00:00Z", repliedAt: null, row: row({ column: "doing" }), today });
    expect(d).toMatchObject({ column: "doing", fresh: true });
  });

  it("moja odpowiedź po ustawieniu → Czekam na 3 dni robocze", () => {
    const d = deriveColumn({ auto, lastIncomingAt: "2026-10-05T09:00:00Z", repliedAt: "2026-10-07T12:00:00Z", row: row({ column: "doing" }), today });
    expect(d).toMatchObject({ column: "waiting", remindOn: "2026-10-12" });
  });

  it("minięty termin czekania wraca do Do zrobienia", () => {
    const d = deriveColumn({ auto, lastIncomingAt: null, repliedAt: null, row: row({ column: "waiting", remindOn: "2026-10-08" }), today });
    expect(d.column).toBe("todo");
    expect(d.reason).toMatch(/08\.10/);
    expect(deriveColumn({ auto: { column: "waiting", remindOn: "2026-10-07" }, lastIncomingAt: null, repliedAt: null, row: null, today }).column).toBe("todo");
  });
});
