import { describe, expect, it } from "vitest";
import {
  classifyUserFacingError,
  extractRawErrorMessage,
  looksLikeTechnicalErrorDump,
  sanitizeUserFacingErrorMessage,
  userFacingErrorFromUnknown,
  userFacingErrorText,
} from "./user-facing-error";

describe("sanitizeUserFacingErrorMessage", () => {
  it("usuwa stack i prefiks Error:", () => {
    const raw = `Error: Brak uprawnień do operacji zakupowych
    at requireOperations (auth.ts:126:11)
    at actionFetch (carrier-phones.ts:29:3)`;
    expect(sanitizeUserFacingErrorMessage(raw)).toBe(
      "Brak uprawnień do operacji zakupowych"
    );
  });

  it("usuwa digest Next.js", () => {
    expect(
      sanitizeUserFacingErrorMessage(
        "Brak uprawnień magazynu [digest: abc123]"
      )
    ).toBe("Brak uprawnień magazynu");
  });

  it("przycina bardzo długi tekst", () => {
    const long = `Błąd: ${"x".repeat(300)}`;
    const out = sanitizeUserFacingErrorMessage(long);
    expect(out.length).toBeLessThanOrEqual(170);
    expect(out.endsWith("…")).toBe(true);
  });
});

describe("looksLikeTechnicalErrorDump", () => {
  it("wykrywa stack / TypeError / errno", () => {
    expect(looksLikeTechnicalErrorDump("Cannot read properties of undefined")).toBe(
      true
    );
    expect(looksLikeTechnicalErrorDump("ECONNREFUSED 127.0.0.1")).toBe(true);
    expect(looksLikeTechnicalErrorDump("at Object.foo (file.js:1:1)")).toBe(true);
  });

  it("nie oznacza zwykłych komunikatów PL", () => {
    expect(looksLikeTechnicalErrorDump("Nie znaleziono ZK w Subiekcie.")).toBe(
      false
    );
    expect(looksLikeTechnicalErrorDump("Podaj numer ZK")).toBe(false);
    expect(looksLikeTechnicalErrorDump("Dostawca nieaktywny")).toBe(false);
  });
});

describe("classifyUserFacingError", () => {
  it("mapuje brak uprawnień na ładny nagłówek", () => {
    const c = classifyUserFacingError(
      "Error: Brak uprawnień do numerów kurierów\n    at requireCarrierPhonesRead"
    );
    expect(c.kind).toBe("unauthorized");
    expect(c.title).toBe("Brak uprawnień");
    expect(c.description).toMatch(/numerów telefonów kurierów/i);
    expect(c.description).not.toMatch(/\bat\s/);
  });

  it("mapuje operacje zakupowe", () => {
    const c = classifyUserFacingError("Brak uprawnień do operacji zakupowych");
    expect(c.title).toBe("Brak uprawnień");
    expect(c.description).toMatch(/zakupów/i);
  });

  it("zachowuje konkretny komunikat uprawnień PL", () => {
    const c = classifyUserFacingError("Brak uprawnień do grupy.");
    expect(c.kind).toBe("unauthorized");
    expect(c.description).toBe("Brak uprawnień do grupy.");
  });

  it("Forbidden → ogólny PL", () => {
    const c = classifyUserFacingError("Forbidden");
    expect(c.kind).toBe("unauthorized");
    expect(c.description).toBe("Brak uprawnień do tej operacji.");
  });

  it("mapuje sesję", () => {
    const c = classifyUserFacingError("Brak sesji — zaloguj się ponownie.");
    expect(c.kind).toBe("session");
    expect(c.title).toBe("Sesja wygasła");
  });

  it("mapuje konkretny brak dostępu do prośby innego handlowca", () => {
    const c = classifyUserFacingError(
      "Brak uprawnień do prośby tego handlowca."
    );
    expect(c.kind).toBe("unauthorized");
    expect(c.description).toMatch(/w imieniu tej osoby/i);
    expect(c.description).not.toMatch(/^Ta operacja wymaga konta handlowca/);
  });

  it("mapuje Brak uprawnień handlowca na wymaga konta handlowca", () => {
    const c = classifyUserFacingError("Brak uprawnień handlowca");
    expect(c.description).toBe("Ta operacja wymaga konta handlowca.");
  });

  it("mapuje sieć", () => {
    const c = classifyUserFacingError("Failed to fetch");
    expect(c.kind).toBe("network");
    expect(c.title).toBe("Problem z połączeniem");
  });

  it("nie pokazuje surowego stacka jako opisu", () => {
    const c = classifyUserFacingError(
      "Something blew up\n    at Object.foo (file.js:1:1)"
    );
    expect(c.description).not.toMatch(/\bat\s/);
  });

  it("zachowuje konkretne komunikaty biznesowe bez polskich znaków", () => {
    expect(classifyUserFacingError("Nie znaleziono ZK w Subiekcie.").description).toBe(
      "Nie znaleziono ZK w Subiekcie."
    );
    expect(classifyUserFacingError("Podaj numer ZK").description).toBe(
      "Podaj numer ZK"
    );
    expect(classifyUserFacingError("Dostawca nieaktywny").description).toBe(
      "Dostawca nieaktywny"
    );
  });
});

describe("extractRawErrorMessage / userFacingErrorFromUnknown", () => {
  it("bierze message z Error", () => {
    expect(extractRawErrorMessage(new Error("Brak uprawnień"))).toBe(
      "Brak uprawnień"
    );
  });

  it("fallback gdy brak treści", () => {
    const c = userFacingErrorFromUnknown(null, "Nie udało się wczytać numerów.");
    expect(c.description).toBe("Nie udało się wczytać numerów.");
  });

  it("fallback gdy techniczny dump EN", () => {
    const c = userFacingErrorFromUnknown(
      new Error("Cannot read properties of undefined (reading 'id')"),
      "Nie udało się wczytać ZD."
    );
    expect(c.description).toBe("Nie udało się wczytać ZD.");
  });

  it("nie nadpisuje sensownego PL fallbackiem", () => {
    const c = userFacingErrorFromUnknown(
      new Error("Nie znaleziono ZK w Subiekcie."),
      "Nie udało się wyszukać."
    );
    expect(c.description).toBe("Nie znaleziono ZK w Subiekcie.");
  });

  it("userFacingErrorText łączy tytuł dla uprawnień", () => {
    const text = userFacingErrorText(
      new Error("Brak uprawnień do numerów kurierów")
    );
    expect(text).toMatch(/^Brak uprawnień —/);
    expect(text).toMatch(/kurierów/i);
  });
});
