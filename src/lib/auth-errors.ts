import { isProductionRuntime } from "@/lib/env/app-config";

const MAP: [RegExp | string, string][] = [
  ["Invalid login credentials", "Nieprawidłowy e-mail lub hasło"],
  ["Email not confirmed", "Potwierdź adres e-mail przed logowaniem"],
  ["User not found", "Nieprawidłowy e-mail lub hasło"],
  ["Too many requests", "Zbyt wiele prób — spróbuj za chwilę"],
];

export function translateAuthError(message: string): string {
  for (const [pattern, pl] of MAP) {
    if (typeof pattern === "string") {
      if (message.includes(pattern)) return pl;
    } else if (pattern.test(message)) {
      return pl;
    }
  }
  if (isProductionRuntime()) {
    return "Nie udało się zalogować. Sprawdź dane i spróbuj ponownie.";
  }
  return message;
}
