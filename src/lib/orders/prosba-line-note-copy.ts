import type { ProductLineDraft } from "@/components/orders/request-product-lines";

/** Pierwsza niepusta notatka w grupie pozycji. */
export function firstProsbaLineNote(
  lines: readonly Pick<ProductLineDraft, "requestNote">[]
): string | null {
  for (const line of lines) {
    const trimmed = line.requestNote?.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

/** Czy wszystkie pozycje mają tę samą notatkę co `source`. */
export function allProsbaLinesShareNote(
  lines: readonly Pick<ProductLineDraft, "requestNote">[],
  source: string
): boolean {
  return lines.every((line) => (line.requestNote?.trim() || "") === source);
}

/** Skopiuj pierwszą notatkę na wszystkie pozycje — null gdy brak sensu (1 linia / brak notatki / już wszędzie). */
export function copyProsbaLineNoteToAllLines(
  lines: ProductLineDraft[]
): ProductLineDraft[] | null {
  if (lines.length < 2) return null;
  const source = firstProsbaLineNote(lines);
  if (!source || allProsbaLinesShareNote(lines, source)) return null;
  return lines.map((line) => ({ ...line, requestNote: source }));
}
