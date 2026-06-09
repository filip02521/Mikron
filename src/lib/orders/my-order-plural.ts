/** Poprawna odmiana „prośba / prośby / prośb” po liczbie. */
export function formatProsbaCount(n: number): string {
  if (n === 1) return "1 prośba";
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} prośby`;
  return `${n} prośb`;
}

export function formatPickupBarLabel(count: number): string {
  if (count === 1) return "1 prośba do odbioru";
  return `${formatProsbaCount(count)} do odbioru`;
}

/** Odmiana „pozycja / pozycje / pozycji” — liczba linii do odbioru. */
export function formatPickupLineCount(n: number): string {
  if (n === 1) return "1 pozycja";
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} pozycje`;
  return `${n} pozycji`;
}
