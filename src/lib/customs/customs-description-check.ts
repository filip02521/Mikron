/**
 * Kontrole opisu PL karty względem nazwy pozycji z faktury — tylko ostrzeżenia, decyduje człowiek.
 * Wyłapują błędy znalezione w historycznych tłumaczeniach dla agencji:
 * - jeden opis z listą kilku pozycji („5 podkładka; 6 zacisk wiertła; …”),
 * - inny rozmiar niż na fakturze („BeeBee 120mm” przy „Beebe … 110mm”),
 * - inny materiał niż na fakturze („ceramika hybrydowa” przy „Lithium Disilicate Glass Ceramic”).
 * Czysta logika — bez bazy i sieci.
 */

/** Materiał z nazwy faktury (EN) → rdzeń, który powinien być w opisie PL. */
const MATERIALS: readonly { invoice: RegExp; pl: RegExp; label: string }[] = [
  { invoice: /zirconi|zirkon/i, pl: /cyrkon/i, label: "cyrkon" },
  { invoice: /lithium\s+disilicate|disilicate/i, pl: /dwukrzemian|krzemian\w*\s+litu/i, label: "dwukrzemian litu" },
  { invoice: /\bpmma\b/i, pl: /pmma|polimetakrylan/i, label: "PMMA" },
  { invoice: /\bwax\b/i, pl: /wosk/i, label: "wosk" },
  // Samo „Hybrid” to też nazwa krążków cyrkonowych (Explore Hybrid) — tylko jednoznaczne nazwy.
  { invoice: /hyramic|hybrid\s+ceramic|polymer[\s-]+based/i, pl: /hybryd/i, label: "ceramika hybrydowa" },
  { invoice: /titanium/i, pl: /tytan/i, label: "tytan" },
];

/** „5 podkładka; 6 zacisk” / „9-10 podkładka” — numer pozycji wewnątrz opisu. */
const INNER_ITEM_RE = /(?:^|[:;,]\s*)\d{1,3}(?:\s*-\s*\d{1,3})?\s+\p{Ll}/gu;
const SIZE_RE = /(\d+(?:[.,]\d+)?)\s*(mm|cm)\b/gi;

function sizes(text: string): Set<string> {
  const out = new Set<string>();
  for (const m of text.matchAll(SIZE_RE)) {
    const mm = Number(m[1]!.replace(",", ".")) * (m[2]!.toLowerCase() === "cm" ? 10 : 1);
    out.add(`${mm} mm`);
  }
  return out;
}

export function customsDescriptionWarning(descriptionPl: string, invoiceName: string): string | null {
  const desc = descriptionPl.trim();
  if (!desc) return null;
  const notes: string[] = [];

  if ([...desc.matchAll(INNER_ITEM_RE)].length >= 2) {
    notes.push("Opis zawiera listę kilku pozycji - zostaw tylko część dotyczącą tej pozycji.");
  }

  const descSizes = sizes(desc);
  const invoiceSizes = sizes(invoiceName);
  if (descSizes.size && invoiceSizes.size && ![...descSizes].some((s) => invoiceSizes.has(s))) {
    notes.push(`Rozmiar w opisie (${[...descSizes].join(", ")}) inny niż na fakturze (${[...invoiceSizes].join(", ")}).`);
  }

  const expected = MATERIALS.filter((m) => m.invoice.test(invoiceName));
  const other = MATERIALS.filter((m) => m.pl.test(desc) && !expected.includes(m));
  // Ostrzegamy tylko przy sprzeczności: faktura mówi X, opis wprost mówi Y — ogólny opis bez materiału przechodzi.
  if (expected.length && !expected.some((m) => m.pl.test(desc)) && other.length) {
    notes.push(
      `Materiał w opisie (${other.map((m) => m.label).join(", ")}) nie zgadza się z fakturą (${expected.map((m) => m.label).join(", ")}).`
    );
  }

  return notes.length ? notes.join(" ") : null;
}
