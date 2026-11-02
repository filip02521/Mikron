import { describe, expect, it } from "vitest";
import { ROL_PDF_CLAIM_MS, rolPdfState } from "./pdfs";

const now = Date.parse("2026-10-29T12:00:00Z");
const ago = (ms: number) => new Date(now - ms).toISOString();

describe("rolPdfState", () => {
  it("brak wiersza — czeka na pierwszą próbę", () => {
    expect(rolPdfState(undefined, now)).toBe("czeka");
  });

  it("gotowy wygrywa nad starym błędem", () => {
    expect(rolPdfState({ hasPdf: true, attempts: 2, lastError: "", lastAttemptAt: ago(1000) }, now)).toBe("gotowy");
  });

  it("próba w toku, potem przerwana próba wraca do kolejki", () => {
    expect(rolPdfState({ hasPdf: false, attempts: 1, lastError: "", lastAttemptAt: ago(30_000) }, now)).toBe("pobieram");
    expect(rolPdfState({ hasPdf: false, attempts: 1, lastError: "", lastAttemptAt: ago(ROL_PDF_CLAIM_MS + 1) }, now)).toBe("czeka");
  });

  it("błąd wydruku widać od razu", () => {
    expect(rolPdfState({ hasPdf: false, attempts: 1, lastError: "HTTP 504", lastAttemptAt: ago(1000) }, now)).toBe("blad");
  });
});
