const MOJE_SECTION_FLASH_CLASSES = [
  "ring-2",
  "ring-indigo-400/70",
  "ring-offset-2",
  "rounded-md",
] as const;

const MOJE_CARD_FLASH_CLASSES = [
  "ring-2",
  "ring-indigo-400/70",
  "ring-offset-2",
  "rounded-md",
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
