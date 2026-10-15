/** Bez zależności — importowany też w komponentach klienta (nie wciąga @google/genai). */

// Nie \b: w JS granica słowa nie widzi „ę” czy „ą”, więc „proszę” i „się” nigdy by nie pasowały.
const POLISH_HINTS = /(?:^|[^\p{L}])(się|nie|jest|oraz|proszę|dzień dobry|dziękuję|pozdrawiam|zamówienie|faktura|dostawa|termin|które|został[ao]?)(?![\p{L}])/giu;

/** Mail wygląda na polski — tłumaczenie nie ma sensu (próg: 2 typowo polskie słowa albo polskie znaki). */
export function looksPolish(text: string): boolean {
  const sample = text.slice(0, 1500);
  if ((sample.match(POLISH_HINTS)?.length ?? 0) >= 2) return true;
  return (sample.match(/[ąćęłńóśźż]/gi)?.length ?? 0) >= 3;
}
