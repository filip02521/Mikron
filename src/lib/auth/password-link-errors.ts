import { isProductionRuntime } from "@/lib/env/app-config";

const LINK_MAP: [RegExp | string, string][] = [
  ["Email link is invalid or has expired", "Link wygasł lub został już użyty — poproś o nowy."],
  ["otp_expired", "Link wygasł — wygeneruj nowy link zaproszenia."],
  ["Invalid login credentials", "Link jest nieprawidłowy — poproś o nowy."],
  ["missing_session", "Otwórz pełny link od administratora (skopiuj cały adres URL)."],
];

const UPDATE_MAP: [RegExp | string, string][] = [
  ["Password should be at least", "Hasło jest zbyt krótkie — sprawdź wymagania poniżej."],
  ["New password should be different", "Nowe hasło musi różnić się od poprzedniego."],
  ["Auth session missing", "Sesja wygasła — otwórz link ponownie lub zaloguj się."],
  ["Too many requests", "Zbyt wiele prób — odczekaj chwilę i spróbuj ponownie."],
];

function translateMapped(message: string, map: [RegExp | string, string][]): string {
  for (const [pattern, pl] of map) {
    if (typeof pattern === "string") {
      if (message.includes(pattern)) return pl;
    } else if (pattern.test(message)) {
      return pl;
    }
  }
  return message;
}

export function translatePasswordLinkError(message: string): string {
  return translateMapped(message, LINK_MAP);
}

export function translatePasswordUpdateError(message: string): string {
  const translated = translateMapped(message, UPDATE_MAP);
  if (translated !== message) return translated;
  if (isProductionRuntime()) {
    return "Nie udało się zapisać hasła. Sprawdź wymagania i spróbuj ponownie.";
  }
  return message;
}
