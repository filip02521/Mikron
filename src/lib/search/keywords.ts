/**
 * Wyszukiwanie po słowach: każde wpisane słowo musi wystąpić w tekście, w dowolnej kolejności, bez względu na
 * wielkość liter i polskie znaki — „eco gips” znajdzie „Gips ECO 25 kg”, „zab” znajdzie „Ząb”.
 * Wspólne dla wszystkich pól wyszukiwania (listy, filtry, podpowiedzi z Subiekta). Czyste funkcje — serwer i klient.
 */

const POLISH_FOLD: Record<string, string> = { ą: "a", ć: "c", ę: "e", ł: "l", ń: "n", ó: "o", ś: "s", ź: "z", ż: "z" };

/** Małe litery bez polskich znaków i akcentów. */
export function foldSearchText(raw: string | null | undefined): string {
  return String(raw ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[ąćęłńóśźż]/g, (ch) => POLISH_FOLD[ch] ?? ch);
}

/** Słowa zapytania (bez powtórzeń); puste zapytanie = brak słów = wszystko pasuje. */
export function searchWords(query: string | null | undefined): string[] {
  return [...new Set(foldSearchText(query).split(/\s+/).filter(Boolean))];
}

/** Czy tekst (albo pola razem) zawiera każde słowo zapytania. */
export function matchesSearchWords(
  haystack: string | null | undefined | ReadonlyArray<string | number | null | undefined>,
  query: string | null | undefined
): boolean {
  const words = searchWords(query);
  if (!words.length) return true;
  const text = foldSearchText(Array.isArray(haystack) ? haystack.filter((v) => v != null).join(" ") : (haystack as string | null | undefined));
  return words.every((w) => text.includes(w));
}
