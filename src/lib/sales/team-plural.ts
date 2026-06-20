/** Poprawna odmiana „przypomnienie / przypomnienia / przypomnień”. */
export function formatPrzypomnienieCount(n: number): string {
  if (n === 1) return "1 przypomnienie";
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `${n} przypomnienia`;
  }
  return `${n} przypomnień`;
}
