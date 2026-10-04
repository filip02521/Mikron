import type { UserRole } from "@/types/database";
import { formatWarsawDateTime, warsawDateKeyFromIso, warsawNowParts } from "@/lib/time/warsaw";

type AuthorProfile = { email: string | null; role?: UserRole | string | null } | null | undefined;

type SalesPersonRef = { name: string } | null | undefined;

export function isOperationsAuthorRole(role: string | null | undefined): boolean {
  return role === "zakupy" || role === "admin";
}

export function authorLabelFromProfile(author: AuthorProfile, fallback = "Użytkownik"): string {
  if (!author) return fallback;
  if (isOperationsAuthorRole(author.role ?? null)) return "Zakupy";
  const email = author.email?.trim();
  if (!email) return fallback;
  const local = email.split("@")[0]?.trim();
  return local || fallback;
}

export function questionAuthorLabel(
  salesPerson: SalesPersonRef,
  author: AuthorProfile
): string {
  const name = salesPerson?.name?.trim();
  if (name) return name;
  return authorLabelFromProfile(author, "Handlowiec");
}

export function boardReplyCountLabel(count: number): string {
  if (count === 1) return "1 odpowiedź";
  return `${count} odpowiedzi`;
}

export function formatBoardDate(iso: string): string {
  return formatWarsawDateTime(iso);
}

const SHORT_MONTHS = ["sty", "lut", "mar", "kwi", "maj", "cze", "lip", "sie", "wrz", "paź", "lis", "gru"];

/** Krótka data w wierszu listy (jak w poczcie): dziś „14:05”, „wczoraj”, „3 paź”, „3 paź 2025”. */
export function formatBoardShortDate(iso: string, now: Date = new Date()): string {
  const key = warsawDateKeyFromIso(iso);
  const today = warsawNowParts(now).dateKey;
  if (key === today) {
    return new Intl.DateTimeFormat("pl-PL", {
      timeZone: "Europe/Warsaw",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  }
  const yesterday = warsawNowParts(new Date(now.getTime() - 86_400_000)).dateKey;
  if (key === yesterday) return "wczoraj";
  const [y, m, d] = key.split("-").map(Number);
  const short = `${d} ${SHORT_MONTHS[(m ?? 1) - 1]}`;
  return key.slice(0, 4) === today.slice(0, 4) ? short : `${short} ${y}`;
}
