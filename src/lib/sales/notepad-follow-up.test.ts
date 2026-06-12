import { describe, expect, it } from "vitest";
import {
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
