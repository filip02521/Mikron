/** Kapitalizacja słowa — np. stupczynska → Stupczynska */
export function capitalizeNamePart(part: string): string {
  const trimmed = part.trim();
  if (!trimmed) return "";
  const lower = trimmed.toLocaleLowerCase("pl-PL");
  return lower.charAt(0).toLocaleUpperCase("pl-PL") + lower.slice(1);
}

/**
 * Imię i nazwisko z adresu w formacie imie.nazwisko@domena (Mikran).
 * Zwraca null, gdy lokalna część nie ma co najmniej dwóch segmentów.
 */
export function displayNameFromEmail(email: string | null | undefined): string | null {
  const normalized = email?.trim().toLowerCase();
  if (!normalized) return null;

  const local = normalized.split("@")[0]?.trim();
  if (!local) return null;

  const parts = local.split(".").map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return null;

  const name = parts.map(capitalizeNamePart).join(" ").trim();
  return name || null;
}

/** Handlowiec z karty lub imię i nazwisko z maila firmowego. */
export function resolveUserDisplayName(input: {
  salesPersonName?: string | null;
  email?: string | null;
}): string | null {
  const fromCard = input.salesPersonName?.trim();
  if (fromCard) return fromCard;
  return displayNameFromEmail(input.email);
}

function titleCaseWords(value: string): string {
  return value
    .split(/\s+/)
    .map((part) => capitalizeNamePart(part))
    .filter(Boolean)
    .join(" ");
}

/** Imię/nazwa z lokalnej części e-maila (kropki, _ i -). */
export function formatPersonNameFromEmailLocal(email: string | null | undefined): string | null {
  const normalized = email?.trim().toLowerCase();
  if (!normalized) return null;

  const local = normalized.split("@")[0]?.trim();
  if (!local) return null;

  const parts = local
    .split(/[._-]+/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (!parts.length) return null;

  return parts.map(capitalizeNamePart).join(" ");
}

/** Etykieta konta na ekranie logowania. */
export function resolveLoginDisplayName(input: {
  salesPersonName?: string | null;
  email: string;
}): string {
  const fromCard = input.salesPersonName?.trim();
  if (fromCard) return titleCaseWords(fromCard);

  return formatPersonNameFromEmailLocal(input.email) ?? titleCaseWords(input.email.trim()) ?? "Konto";
}
