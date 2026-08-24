/**
 * Copy komunikatu o dostawcach na urlopie w kolejce Dziś (zaległe / na dziś).
 */

function plSupplierOnVacationWord(count: number): string {
  const n = Math.max(0, Math.trunc(count));
  if (n === 1) return "dostawca";
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return "dostawcy";
  }
  return "dostawców";
}

/** Nagłówek: „1 dostawca na urlopie w kolejce”. */
export function dailyPanelVacationNoticeTitle(count: number): string {
  const n = Math.max(0, Math.trunc(count));
  if (n <= 0) return "";
  return `${n} ${plSupplierOnVacationWord(n)} na urlopie w kolejce`;
}

/** Krótki dopisek — bez powtórzenia słowa „Urlop”. */
export function dailyPanelVacationNoticeHint(): string {
  return "W zaległych lub na dziś — widać przy kartach dostawców.";
}

export function dailyPanelVacationNoticeCtaLabel(): string {
  return "Urlopy";
}
