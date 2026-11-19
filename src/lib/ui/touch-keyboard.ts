/**
 * Klawiatura ekranowa na ekranach dotykowych z Windows (panel serwisu, `.touch-ui`). Chrome i Edge na Windows pokazują
 * klawiaturę dotykową tylko po stuknięciu w pole — pole, które dostało fokus samo (okno otwarte palcem z polem
 * `autoFocus`), zostaje bez klawiatury, a serwisant musi stuknąć drugi raz. VirtualKeyboard API (Chromium) pozwala ją
 * pokazać, gdy pole ma `virtualkeyboardpolicy="manual"` i trwa aktywacja użytkownika (kilka sekund po stuknięciu).
 * Mysz i fizyczna klawiatura: bez zmian — klawiaturę pokazujemy tylko, gdy ostatnio dotknięto palcem albo piórem.
 */

/** Ile po ostatnim dotknięciu fokus pola uznajemy za skutek tego dotknięcia (otwarcie okna, przejście do pola). */
export const TOUCH_FOCUS_WINDOW_MS = 4000;

const TEXT_INPUT_TYPES = new Set(["", "text", "search", "email", "tel", "url", "number", "password"]);

/** Pole, do którego się pisze (nie checkbox, nie przycisk, nie tylko do odczytu). */
export function isTypingField(el: Element | null): el is HTMLInputElement | HTMLTextAreaElement {
  if (!el) return false;
  if (el instanceof HTMLTextAreaElement) return !el.readOnly && !el.disabled;
  if (el instanceof HTMLInputElement) return TEXT_INPUT_TYPES.has(el.type.toLowerCase()) && !el.readOnly && !el.disabled;
  return false;
}

/** Pokazać klawiaturę: pole w strefie dotykowej, ostatnie wskazanie palcem/piórem i niedawno. */
export function shouldShowTouchKeyboard(input: {
  typingField: boolean;
  inTouchZone: boolean;
  lastPointerType: string | null;
  msSinceLastPointer: number;
}): boolean {
  return (
    input.typingField &&
    input.inTouchZone &&
    (input.lastPointerType === "touch" || input.lastPointerType === "pen") &&
    input.msSinceLastPointer >= 0 &&
    input.msSinceLastPointer <= TOUCH_FOCUS_WINDOW_MS
  );
}

type VirtualKeyboardLike = { show: () => void; hide: () => void };

/**
 * Podpina nasłuch na całym dokumencie; zwraca funkcję sprzątającą. Bez VirtualKeyboard API (Firefox, Safari, Chrome
 * na macOS) nic nie robi — tam system obsługuje klawiaturę sam.
 */
export function installTouchKeyboardAssist(doc: Document = document): () => void {
  const vk = (doc.defaultView?.navigator as Navigator & { virtualKeyboard?: VirtualKeyboardLike }).virtualKeyboard;
  if (!vk) return () => {};
  let lastPointerType: string | null = null;
  let lastPointerAt = 0;
  const onPointer = (e: PointerEvent) => {
    lastPointerType = e.pointerType;
    lastPointerAt = Date.now();
  };
  const onFocusIn = (e: FocusEvent) => {
    const el = e.target as Element | null;
    const show = shouldShowTouchKeyboard({
      typingField: isTypingField(el),
      inTouchZone: !!el?.closest(".touch-ui"),
      lastPointerType,
      msSinceLastPointer: Date.now() - lastPointerAt,
    });
    if (!show || !el) return;
    // „manual” — klawiaturą sterujemy sami (pokaż teraz, schowaj po wyjściu z pól); stuknięcie w pole też tu trafia.
    el.setAttribute("virtualkeyboardpolicy", "manual");
    try {
      vk.show();
    } catch {
      return;
    }
    // Klawiatura dokuje u dołu ekranu — pole przewijamy na środek, żeby nie zostało pod nią.
    doc.defaultView?.setTimeout(() => (el as HTMLElement).scrollIntoView({ block: "center" }), 250);
  };
  const onFocusOut = (e: FocusEvent) => {
    const el = e.target as Element | null;
    if (el?.getAttribute("virtualkeyboardpolicy") !== "manual") return;
    // Przejście do kolejnego pola nie chowa klawiatury; wyjście poza pola — chowa.
    doc.defaultView?.setTimeout(() => {
      if (isTypingField(doc.activeElement) && doc.activeElement?.closest(".touch-ui")) return;
      try {
        vk.hide();
      } catch {
        /* klawiatura już schowana */
      }
    }, 0);
  };
  doc.addEventListener("pointerdown", onPointer, true);
  doc.addEventListener("focusin", onFocusIn, true);
  doc.addEventListener("focusout", onFocusOut, true);
  return () => {
    doc.removeEventListener("pointerdown", onPointer, true);
    doc.removeEventListener("focusin", onFocusIn, true);
    doc.removeEventListener("focusout", onFocusOut, true);
  };
}
