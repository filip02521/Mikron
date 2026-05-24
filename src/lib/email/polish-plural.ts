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
