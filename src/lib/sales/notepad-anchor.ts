/**
 * Wewnętrzna obwódka — nie wychodzi poza element (rodzice mają overflow-hidden).
 * Statyczne wyróżnienie (np. archiwum notatek); przewinięcie z podświetleniem → {@link flashNotepadAnchor}.
 */
export const NOTEPAD_ANCHOR_FLASH_CLASSES = [
  "relative",
  "z-10",
  "ring-2",
  "ring-inset",
  "ring-indigo-400/80",
  "rounded-md",
  "bg-indigo-50/80",
] as const;

/** Atrybut podświetlenia kotwicy — styl i animacja w globals.css (`[data-notepad-flash]`). */
export const NOTEPAD_FLASH_ATTR = "data-notepad-flash";

export function parseNotepadHashAnchor(hash: string): string | null {
  const anchor = hash.replace(/^#/, "").trim();
  if (!anchor) return null;
  if (anchor.startsWith("watch-") || anchor.startsWith("note-")) return anchor;
  return null;
}

export function watchIdFromNotepadAnchor(anchor: string): string | null {
  return anchor.startsWith("watch-") ? anchor.slice("watch-".length) : null;
}

export function noteIdFromNotepadAnchor(anchor: string): string | null {
  const normalized = anchor.replace(/^#/, "").trim();
  return normalized.startsWith("note-") ? normalized.slice("note-".length) : null;
}

/** Przewija do kotwicy w notatniku i krótko podświetla element. */
export function flashNotepadAnchor(
  anchor: string,
  options?: {
    delayMs?: number;
    durationMs?: number;
    maxRetries?: number;
    onFound?: () => void;
    /** Tekst dla czytników ekranu (aria-live). */
    announce?: string;
    onAnnounce?: (message: string) => void;
  }
): void {
  const delayMs = options?.delayMs ?? 120;
  const durationMs = options?.durationMs ?? 2200;
  const maxRetries = options?.maxRetries ?? 16;
  const onFound = options?.onFound;
  const onAnnounce = options?.onAnnounce;

  function attempt(retry: number) {
    const el = document.getElementById(anchor);
    if (!el) {
      if (retry < maxRetries) {
        window.setTimeout(() => attempt(retry + 1), 100);
      }
      return;
    }

    onFound?.();
    if (onAnnounce) {
      onAnnounce(options?.announce ?? "Przewinięto do wskazanej pozycji w notatniku.");
    }
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    // Nakładka ::after (globals.css) — nad treścią karty. Klasy tła / obwódki na kontenerze
    // były zasłaniane przez nieprzezroczyste tło wiersza (np. ZK: bg-white) i nic nie było widać.
    el.removeAttribute(NOTEPAD_FLASH_ATTR);
    void el.offsetWidth; // restart animacji przy ponownym podświetleniu tego samego elementu
    el.style.setProperty("--notepad-flash-ms", `${durationMs}ms`);
    el.setAttribute(NOTEPAD_FLASH_ATTR, "");
    window.setTimeout(() => {
      el.removeAttribute(NOTEPAD_FLASH_ATTR);
      el.style.removeProperty("--notepad-flash-ms");
    }, durationMs);
  }

  window.setTimeout(() => attempt(0), delayMs);
}

export function resolveNotepadWatchFocusId(
  hash: string,
  focusWatchParam?: string | null
): string | null {
  const fromQuery = focusWatchParam?.trim();
  if (fromQuery) return fromQuery;
  const anchor = parseNotepadHashAnchor(hash);
  return anchor ? watchIdFromNotepadAnchor(anchor) : null;
}
