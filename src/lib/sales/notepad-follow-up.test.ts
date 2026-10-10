import { describe, expect, it } from "vitest";
import {
  followUpQuickDates,
  buildMojeClientLink,
  isFollowUpDue,
  todayIso,
  todayStart,
} from "./notepad-follow-up";

describe("notepad-follow-up", () => {
  it("traktuje follow-up na dziś jako due", () => {
    const iso = todayIso();
    expect(isFollowUpDue(iso, todayStart())).toBe(true);
  });

  it("buduje link do moje z filtrem klienta", () => {
    expect(buildMojeClientLink("sp-1", "Walczak Jacek · Raszków", { preview: true })).toBe(
      "/moje?dla=sp-1&klient=Walczak+Jacek"
    );
  });

  it("dodaje kh do linku moje", () => {
    expect(
      buildMojeClientLink("sp-1", "Klinika Smile", { clientKhId: 42 })
    ).toBe("/moje?klient=Klinika+Smile&kh=42");
  });

  it("dodaje zkWatch i numer ZK do linku moje", () => {
    expect(
      buildMojeClientLink("sp-1", "Klinika Smile", {
        clientKhId: 42,
        zkWatchId: "w1",
        zkNumber: "ZK/2026/0142",
      })
    ).toBe(
      "/moje?zkWatch=w1&zk=ZK%2F2026%2F0142&klient=Klinika+Smile&kh=42"
    );
  });
});

describe("followUpQuickDates — dzień roboczy", () => {
  it("w piątek drugi skrót to poniedziałek, nie sobota", () => {
    const friday = new Date("2026-10-09T10:00:00+02:00").getTime();
    const [, next] = followUpQuickDates(friday);
    expect(next?.value).toBe("2026-10-12");
    expect(next?.label).not.toBe("Jutro");
  });

  it("w środę zostaje „Jutro”", () => {
    const wednesday = new Date("2026-10-07T10:00:00+02:00").getTime();
    expect(followUpQuickDates(wednesday)[1]).toEqual({ label: "Jutro", value: "2026-10-08" });
  });
});
