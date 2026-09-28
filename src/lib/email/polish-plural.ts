/** „1 pozycja”, „2 pozycje”, „5 pozycji” itd. */
export function polishPozycjeLabel(count: number): string {
  if (count === 1) return "1 pozycja";
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `${count} pozycje`;
  }
  return `${count} pozycji`;
}

/** Krótka forma do tematu maila: „(3 pozycje)”. */
export function polishPozycjeSubjectSuffix(count: number): string {
  return `(${polishPozycjeLabel(count)})`;
}

/**
 * Ogólna odmiana: `polishPlural(n, "pozycja", "pozycje", "pozycji")`
 * → „1 pozycja”, „3 pozycje”, „5 pozycji”, „22 pozycje”, „12 pozycji”.
 */
export function polishPluralWord(
  count: number,
  one: string,
  few: string,
  many: string
): string {
  const n = Math.abs(Math.trunc(count));
  if (n === 1) return one;
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

export function polishPlural(
  count: number,
  one: string,
  few: string,
  many: string
): string {
  return `${count} ${polishPluralWord(count, one, few, many)}`;
}
