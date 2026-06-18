/**
 * Podświetlenie sekcji Start dnia — obwódka na ::after nad treścią (wiersze, meta ZD,
 * nagłówki), bo ring-inset na rodzicu chowa się pod nieprzezroczystymi dziećmi.
 * z-20 wynosi całą sekcję ponad sąsiednie karty (expanded row ma z-[1]/z-[2]).
 */
const MOJE_SECTION_FLASH_OVERLAY_CLASSES = [
  "after:pointer-events-none",
  "after:absolute",
  "after:inset-0",
  "after:z-[5]",
  "after:rounded-[inherit]",
  "after:ring-2",
  "after:ring-inset",
  "after:ring-indigo-400/70",
  "after:content-['']",
] as const;

const MOJE_SECTION_FLASH_CLASSES = [
  "relative",
  "z-20",
  "isolate",
  ...MOJE_SECTION_FLASH_OVERLAY_CLASSES,
] as const;

export const MOJE_CARD_FLASH_CLASSES = [
  ...MOJE_SECTION_FLASH_CLASSES,
  "after:bg-indigo-50/50",
] as const;

export function flashMojeElement(
  el: HTMLElement | null,
  classNames: readonly string[] = MOJE_SECTION_FLASH_CLASSES,
  durationMs = 3200
) {
  if (!el) return;
  el.classList.add(...classNames);
  window.setTimeout(() => el.classList.remove(...classNames), durationMs);
}

export function flashMojeSection(sectionId: string, durationMs = 3200) {
  flashMojeElement(document.getElementById(sectionId), MOJE_SECTION_FLASH_CLASSES, durationMs);
}

export function flashMojeCard(card: HTMLElement | null, durationMs = 3200) {
  flashMojeElement(card, MOJE_CARD_FLASH_CLASSES, durationMs);
}

export function scrollToMojeSection(
  sectionId: string,
  opts?: { flash?: boolean; behavior?: ScrollBehavior }
): boolean {
  const el = document.getElementById(sectionId);
  if (!el) return false;
  el.scrollIntoView({ behavior: opts?.behavior ?? "smooth", block: "start" });
  if (opts?.flash !== false) flashMojeSection(sectionId);
  return true;
}

/** Próba scrollu z krótkim opóźnieniem — na mount / po nawigacji. */
export function scrollToMojeSectionWhenReady(
  sectionId: string,
  onGiveUp?: () => void,
  delayMs = 120
): void {
  const attempt = () => scrollToMojeSection(sectionId);
  if (attempt()) return;
  window.setTimeout(() => {
    if (!attempt()) onGiveUp?.();
  }, delayMs);
}

export function parseMojeSectionHash(hash: string): string | null {
  const id = hash.replace(/^#/, "").trim();
  return id.startsWith("moje-section-") ? id : null;
}

export function mojeSectionDomId(sectionIcon: string): string {
  return `moje-section-${sectionIcon}`;
}

export function mojeSectionHeadingDomId(sectionIcon: string): string {
  return `${mojeSectionDomId(sectionIcon)}-heading`;
}
