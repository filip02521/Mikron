/** Komunikaty związane z danymi logowania — pod polem hasła. */
const PASSWORD_FIELD_ERROR_FRAGMENTS = [
  "Nieprawidłowy e-mail lub hasło",
  "Nie udało się zalogować. Sprawdź dane",
  "Nie znaleziono użytkownika",
  "Potwierdź adres e-mail",
] as const;

export type LoginFormErrorPlacement = "password" | "banner";

export function classifyLoginFormError(message: string): LoginFormErrorPlacement {
  const normalized = message.trim();
  if (!normalized) return "banner";
  if (normalized === "Podaj hasło.") return "password";

  return PASSWORD_FIELD_ERROR_FRAGMENTS.some((fragment) => normalized.includes(fragment))
    ? "password"
    : "banner";
}

export function applyLoginFormError(
  message: string,
  setters: {
    setPasswordError: (value: string) => void;
    setBannerError: (value: string) => void;
  }
): LoginFormErrorPlacement {
  const placement = classifyLoginFormError(message);
  if (placement === "password") {
    setters.setPasswordError(message);
    setters.setBannerError("");
  } else {
    setters.setBannerError(message);
    setters.setPasswordError("");
  }
  return placement;
}
