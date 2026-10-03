/**
 * Znak OnTime: wskazówki zegara układają się w ptaszek — „na czas, załatwione”.
 * Jedno źródło dla AppBrandMark (aplikacja), app/icon.svg i apple-icon.
 * Siatka 64×64, kafel o promieniu 15 (≈ 23%).
 */

export const BRAND_MARK_COLOR = "#0f7380";

/** Rysunek znaku bez tła (biały na kaflu). */
export function brandMarkGlyphSvg(tileColor: string = BRAND_MARK_COLOR): string {
  return [
    '<circle cx="32" cy="32" r="21" fill="none" stroke="#fff" stroke-width="3.6"/>',
    // Kreski 12 / 3 / 6 / 9
    '<g stroke="#fff" stroke-opacity=".5" stroke-width="2.2" stroke-linecap="round">',
    '<line x1="32" y1="17.8" x2="32" y2="15.6"/><line x1="46.2" y1="32" x2="48.4" y2="32"/>',
    '<line x1="32" y1="46.2" x2="32" y2="48.4"/><line x1="17.8" y1="32" x2="15.6" y2="32"/>',
    "</g>",
    // Krótka i długa wskazówka = ptaszek; oś w wierzchołku
    '<path d="M22.6 30.4 L29.6 37.4 L43.6 21.4" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>',
    `<circle cx="29.6" cy="37.4" r="1.5" fill="${tileColor}"/>`,
  ].join("");
}

/**
 * Ikona aplikacji (kafel + znak). `fullBleed` — kwadrat bez zaokrągleń dla iOS,
 * który sam nakłada maskę (przezroczyste rogi wypełniłby na czarno).
 */
export function buildBrandAppIconSvg(options?: { fullBleed?: boolean }): string {
  const rx = options?.fullBleed ? 0 : 15;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="OnTime"><rect width="64" height="64" rx="${rx}" fill="${BRAND_MARK_COLOR}"/>${brandMarkGlyphSvg()}</svg>\n`;
}

export function brandAppIconDataUri(options?: { fullBleed?: boolean }): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(buildBrandAppIconSvg(options))}`;
}
