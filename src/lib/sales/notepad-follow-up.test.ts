import { describe, expect, it } from "vitest";
import {
  buildMojeClientLink,
  isFollowUpDue,
  todayStart,
} from "./notepad-follow-up";

describe("notepad-follow-up", () => {
  it("traktuje follow-up na dziś jako due", () => {
    const today = new Date();
    const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    expect(isFollowUpDue(iso, todayStart())).toBe(true);
  });

  it("buduje link do moje z filtrem klienta", () => {
    expect(buildMojeClientLink("sp-1", "Walczak Jacek · Raszków", { preview: true })).toBe(
      "/moje?dla=sp-1&klient=Walczak+Jacek"
    );
  });
});
