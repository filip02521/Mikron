/**
 * Tekstowa wersja maila (text/plain od Gmaila / Outlooka) zapisuje pogrubienie jako *tekst*.
 * Dzielimy treść na kawałki, żeby UI pokazał prawdziwe pogrubienie zamiast gwiazdek.
 * Tylko *…* w jednej linii, z granicą słowa po obu stronach — „2*3*4” ani „a * b” nie są pogrubieniem.
 */

export type TextRun = { bold: boolean; text: string };

// Bez lookbehind — Safari przed 16.4 nie zna go i wywala cały moduł przy wczytaniu.
const BOLD_RE = /(^|[\s(\["'„])\*([^*\s](?:[^*\n]{0,198}?[^*\s])?)\*(?=$|[\s).,:;!?\]"'”])/gm;

export function splitEmphasis(text: string): TextRun[] {
  const runs: TextRun[] = [];
  let last = 0;
  for (const m of text.matchAll(BOLD_RE)) {
    const start = m.index + m[1].length;
    if (start > last) runs.push({ bold: false, text: text.slice(last, start) });
    runs.push({ bold: true, text: m[2] });
    last = start + m[2].length + 2;
  }
  if (last < text.length) runs.push({ bold: false, text: text.slice(last) });
  return runs;
}
