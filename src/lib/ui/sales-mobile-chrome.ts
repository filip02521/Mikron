/** Root wrapper for logged-in sales shell — offsets floating UI above bottom tab bar. */
export const salesMobileChromeRoot =
  "[--mobile-bottom-chrome:calc(3.25rem+env(safe-area-inset-bottom,0px))] md:[--mobile-bottom-chrome:0px]";

/** Toast / undo bar position — clears mobile bottom nav when chrome variable is set. */
export const floatingToastBottomClass =
  "bottom-[calc(0.75rem+var(--mobile-bottom-chrome,0px))]";

/** Drugi toast nad pierwszym (np. termin ZD nad undo). */
export const floatingToastStackAboveClass =
  "bottom-[calc(4.75rem+var(--mobile-bottom-chrome,0px))]";
