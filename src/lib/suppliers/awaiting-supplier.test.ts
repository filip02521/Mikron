import { describe, expect, it } from "vitest";
import {
  awaitingReplyTiming,
  businessDaysLabel,
  businessDaysSince,
  awaitingReplyStatus,
} from "@/lib/suppliers/awaiting-supplier";

// Środek dnia w Warszawie (UTC+2 w październiku).
const at = (key: string) => new Date(`${key}T10:00:00Z`);

describe("czeka na dostawcę — dni robocze i termin", () => {
  it("liczy dni robocze po dniu wysyłki, bez weekendu i świąt", () => {
    expect(businessDaysSince(at("2026-10-07"), at("2026-10-07"))).toBe(0); // ten sam dzień
    expect(businessDaysSince(at("2026-10-07"), at("2026-10-08"))).toBe(1);
    expect(businessDaysSince(at("2026-10-09"), at("2026-10-12"))).toBe(1); // pt → pon
    expect(businessDaysSince(at("2026-10-30"), at("2026-11-02"))).toBe(1); // pt → pon (1.11 niedziela)
    expect(businessDaysSince(at("2026-11-10"), at("2026-11-12"))).toBe(1); // 11.11 święto
  });

  it("wysyłka późnym wieczorem liczy się według daty w Warszawie", () => {
    // 22:30 UTC 7.10 = 00:30 8.10 w Warszawie
    expect(businessDaysSince(new Date("2026-10-07T22:30:00Z"), at("2026-10-08"))).toBe(0);
  });

  it("Polska: po terminie od 2. dnia roboczego; zagranica i import: od 3.", () => {
    expect(awaitingReplyTiming(at("2026-10-05"), "POLSKA", at("2026-10-06"))).toEqual({
      dueDays: 1,
      businessDays: 1,
      overdue: false,
    });
    expect(awaitingReplyTiming(at("2026-10-05"), "POLSKA", at("2026-10-07")).overdue).toBe(true);
    expect(awaitingReplyTiming(at("2026-10-05"), "ZAGRANICA", at("2026-10-07")).overdue).toBe(false);
    expect(awaitingReplyTiming(at("2026-10-05"), "IMPORT", at("2026-10-08")).overdue).toBe(true);
    expect(awaitingReplyTiming(at("2026-10-05"), null, at("2026-10-07")).overdue).toBe(true);
  });

  it("etykieta", () => {
    expect(businessDaysLabel(0)).toBe("dziś");
    expect(businessDaysLabel(1)).toBe("1 dzień rob.");
    expect(businessDaysLabel(4)).toBe("4 dni rob.");
  });
});

describe("czeka na dostawcę — status", () => {
  it("status: odpowiedź dostawcy wygrywa; zwrot; autoodpowiedź i Mikran nie zamykają", () => {
    expect(awaitingReplyStatus([])).toBe("waiting");
    expect(awaitingReplyStatus([{ kind: "auto" }, { kind: "internal" }])).toBe("waiting");
    expect(awaitingReplyStatus([{ kind: "bounce" }])).toBe("bounced");
    expect(awaitingReplyStatus([{ kind: "bounce" }, { kind: "supplier" }])).toBe("replied");
  });
});
