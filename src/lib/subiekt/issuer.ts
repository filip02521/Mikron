/**
 * Kto wystawia ZD w Subiekcie: konto OnTime (e-mail imie.nazwisko@…) → użytkownik Subiekta (uz_Id).
 * Czysta logika — pobranie listy użytkowników: `resolveSubiektIssuerId` w `subiekt/api.ts`.
 */

export type SubiektUser = { uz_Id: number; uz_Imie?: string | null; uz_Nazwisko?: string | null };

function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ł/g, "l")
    .replace(/Ł/g, "L")
    .toLowerCase()
    .replace(/[^a-z]+/g, " ")
    .trim();
}

/**
 * Dopasowanie po imieniu i nazwisku z adresu (bez ogonków i wielkości liter); gdy imię się różni
 * („ola” / „Aleksandra”) — po samym nazwisku, ale tylko jednoznacznym. Brak pewności → null.
 */
export function matchSubiektUserByEmail(email: string | null | undefined, users: readonly SubiektUser[]): SubiektUser | null {
  const local = String(email ?? "").split("@")[0] ?? "";
  const parts = fold(local.replace(/[._-]+/g, " ")).split(" ").filter(Boolean);
  if (parts.length < 2) return null;
  const first = parts[0]!;
  const last = parts[parts.length - 1]!;
  const named = users.map((u) => ({ u, first: fold(u.uz_Imie ?? ""), last: fold(u.uz_Nazwisko ?? "") }));
  const exact = named.filter((n) => n.first === first && n.last === last);
  if (exact.length === 1) return exact[0]!.u;
  if (exact.length > 1) return null;
  const bySurname = named.filter((n) => n.last === last);
  return bySurname.length === 1 ? bySurname[0]!.u : null;
}
