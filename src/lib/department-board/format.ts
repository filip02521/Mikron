import type { UserRole } from "@/types/database";

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

export function formatBoardDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
