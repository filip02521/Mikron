import { describe, expect, it } from "vitest";
import { classifyLoginFormError } from "./login-form-errors";
import { loginSessionLostMessage } from "./login-messages";
import { loginServerResponseErrorMessage } from "./login-messages";

describe("classifyLoginFormError", () => {
  it("błędy danych logowania trafiają pod hasło", () => {
    expect(classifyLoginFormError("Nieprawidłowy e-mail lub hasło")).toBe("password");
    expect(classifyLoginFormError("Podaj hasło.")).toBe("password");
    expect(
      classifyLoginFormError(
        "Nie udało się zalogować. Sprawdź dane i spróbuj ponownie."
      )
    ).toBe("password");
  });

  it("błędy systemowe trafiają do banera", () => {
    expect(classifyLoginFormError("Brak połączenia z aplikacją. Sprawdź Wi‑Fi.")).toBe(
      "banner"
    );
    expect(
      classifyLoginFormError("Brak profilu użytkownika — skontaktuj się z administratorem.")
    ).toBe("banner");
    expect(classifyLoginFormError(loginServerResponseErrorMessage())).toBe("banner");
    expect(classifyLoginFormError(loginSessionLostMessage())).toBe("banner");
    expect(classifyLoginFormError("Zbyt wiele prób — spróbuj za chwilę")).toBe("banner");
  });
});
