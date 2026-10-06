import { describe, expect, it } from "vitest";
import { assistantReports } from "./reports";

describe("assistantReports", () => {
  it("bez env zwraca oba raporty bez linków", () => {
    const reports = assistantReports({});
    expect(reports.map((r) => r.key)).toEqual(["inbox", "orderConfirmations"]);
    expect(reports.every((r) => r.url === null)).toBe(true);
  });

  it("czyta link https z env", () => {
    const [inbox] = assistantReports({
      ASSISTANT_INBOX_REPORT_URL: " https://claude.ai/artifact/abc ",
    });
    expect(inbox?.url).toBe("https://claude.ai/artifact/abc");
  });

  it("odrzuca http, javascript: i śmieci", () => {
    for (const value of ["http://claude.ai/artifact/abc", "javascript:alert(1)", "nie-url"]) {
      const [, oc] = assistantReports({ ASSISTANT_OC_REPORT_URL: value });
      expect(oc?.url).toBeNull();
    }
  });
});
