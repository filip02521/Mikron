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

/** Podświetlenie karty — tylko obwódka, bez półprzezroczystego tła na treści. */
export const MOJE_CARD_OUTLINE_FLASH_CLASSES = [
  "relative",
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

export function flashMojeCardOutline(card: HTMLElement | null, durationMs = 3200) {
  flashMojeElement(card, MOJE_CARD_OUTLINE_FLASH_CLASSES, durationMs);
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
  opts?: { delayMs?: number; maxAttempts?: number; initialDelayMs?: number }
): void {
  const delayMs = opts?.delayMs ?? 120;
  const maxAttempts = opts?.maxAttempts ?? 3;
  const initialDelayMs = opts?.initialDelayMs ?? 0;
  let attempt = 0;

  const run = () => {
    attempt += 1;
    if (scrollToMojeSection(sectionId)) return;
    if (attempt < maxAttempts) {
      window.setTimeout(run, delayMs);
      return;
    }
    onGiveUp?.();
  };

  if (initialDelayMs > 0) {
    window.setTimeout(run, initialDelayMs);
  } else {
    run();
  }
}

/** Przewiń do karty prośby — z krótkim opóźnieniem i ponowieniem (np. po rozwinięciu archiwum). */
export function scrollToMojeCardWhenReady(
  domId: string,
  opts?: {
    behavior?: ScrollBehavior;
    flash?: boolean;
    /** tint — obwódka + delikatne tło (Start dnia); outline — samo obramowanie (np. wyszukiwarka). */
    flashStyle?: "tint" | "outline";
    initialDelayMs?: number;
    retryDelayMs?: number;
    maxAttempts?: number;
  }
): () => void {
  const behavior = opts?.behavior ?? "smooth";
  const flash = opts?.flash !== false;
  const flashStyle = opts?.flashStyle ?? "tint";
  const initialDelayMs = opts?.initialDelayMs ?? 120;
  const retryDelayMs = opts?.retryDelayMs ?? 120;
  const maxAttempts = opts?.maxAttempts ?? 2;

  let cancelled = false;
  const timers: number[] = [];
  let attempt = 0;

  const schedule = (fn: () => void, delayMs: number) => {
    timers.push(window.setTimeout(fn, delayMs));
  };

  const run = () => {
    if (cancelled) return;
    attempt += 1;
    const card = document.getElementById(domId);
    if (card) {
      card.scrollIntoView({ behavior, block: "center" });
      if (flash) {
        if (flashStyle === "outline") flashMojeCardOutline(card);
        else flashMojeCard(card);
      }
      return;
    }
    if (attempt < maxAttempts) {
      schedule(run, retryDelayMs);
    }
  };

  schedule(run, initialDelayMs);

  return () => {
    cancelled = true;
    for (const id of timers) window.clearTimeout(id);
  };
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
