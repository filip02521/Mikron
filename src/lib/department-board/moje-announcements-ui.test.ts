import { describe, expect, it } from "vitest";
import {
  MOJE_ANNOUNCEMENT_FOCUS_PARAM,
  MOJE_ANNOUNCEMENTS_SECTION_ID,
  salesMojeAnnouncementHref,
  salesMojeAnnouncementsListHref,
} from "./moje-announcements-ui";

describe("moje-announcements-ui", () => {
  it("buduje deep link do konkretnego ogłoszenia", () => {
    expect(salesMojeAnnouncementHref("ann-1")).toBe("/moje?ogloszenie=ann-1");
    expect(salesMojeAnnouncementHref("ann-1", { previewDla: "sp-9" })).toBe(
      "/moje?ogloszenie=ann-1&dla=sp-9"
    );
  });

  it("buduje link do sekcji ogłoszeń", () => {
    expect(salesMojeAnnouncementsListHref()).toBe(`/moje#${MOJE_ANNOUNCEMENTS_SECTION_ID}`);
    expect(salesMojeAnnouncementsListHref({ previewDla: "sp-9" })).toBe(
      `/moje?dla=sp-9#${MOJE_ANNOUNCEMENTS_SECTION_ID}`
    );
  });

  it("używa parametru ogloszenie", () => {
    expect(MOJE_ANNOUNCEMENT_FOCUS_PARAM).toBe("ogloszenie");
    expect(MOJE_ANNOUNCEMENTS_SECTION_ID).toBe("moje-section-announcements");
  });
});
