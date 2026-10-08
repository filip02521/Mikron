/** Słowa, po których na karcie stoją dane logowania do portalu dostawcy, a nie adres do zamówień. */
const LOGIN_LABEL = /(login|user|u[zż]ytkownik|konto|has[lł]o|password)\s*[:=]?\s*$/i;
/** Nasza własna domena — taki adres na karcie dostawcy to nie dostawca. */
const OWN_DOMAIN = /@mikran\.com$/;

/**
 * Adresy dostawcy z tekstu karty (małe litery, bez duplikatów). Pomija loginy do portali
 * („login:jan@firma.pl”) i adresy Mikranu — inaczej zamówienie mogłoby pójść do nas samych.
 */
export function emailsInText(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/[^\s@,;<>()"']+@[^\s@,;<>()"']+\.[a-z]{2,}/gi)) {
    let email = m[0].toLowerCase();
    // „login:jan@firma.pl” — etykieta przyklejona do adresu.
    const glued = email.match(/^([a-ząćęłńóśźż]+)[:=](.+)$/);
    if (glued && LOGIN_LABEL.test(glued[1]!)) continue;
    if (glued) email = glued[2]!;
    const before = text.slice(Math.max(0, (m.index ?? 0) - 24), m.index ?? 0);
    if (LOGIN_LABEL.test(before)) continue;
    if (OWN_DOMAIN.test(email)) continue;
    if (!out.includes(email)) out.push(email);
  }
  return out;
}
