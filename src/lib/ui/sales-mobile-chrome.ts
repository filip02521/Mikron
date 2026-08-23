/** Root wrapper for logged-in sales shell — offsets floating UI above bottom tab bar. */
export const salesMobileChromeRoot =
  "[--mobile-bottom-chrome:calc(3.25rem+env(safe-area-inset-bottom,0px))] md:[--mobile-bottom-chrome:0px]";

/** Toast / undo bar position — clears mobile bottom nav when chrome variable is set. */
export const floatingToastBottomClass =
  "bottom-[calc(0.75rem+var(--mobile-bottom-chrome,0px))]";

/** Drugi toast nad pierwszym (np. termin ZD nad undo). */
export const floatingToastStackAboveClass =
  "bottom-[calc(4.75rem+var(--mobile-bottom-chrome,0px))]";

/** Undo / toast nad sticky Create/TSV/Link w kreatorze ZD. */
export const floatingToastAboveZdStickyClass =
  "bottom-[calc(9.75rem+env(safe-area-inset-bottom,0px))] md:bottom-[6.75rem]";

/**
 * Zakładka sesji kreatora ZD przy prawej krawędzi (poza kreatorem — countdown).
 * Nad dolną nawigacją mobile; toasty zostają po prawej u dołu.
 */
export const floatingZdSessionRailClass =
  "right-[env(safe-area-inset-right,0px)] top-[min(38%,16rem)]";

/**
 * @deprecated Prefer {@link floatingZdSessionRailClass}.
 * Pływające powiadomienie sesji kreatora ZD — lewy dolny róg (stary układ).
 */
export const floatingZdSessionNoticeClass =
  "bottom-[calc(0.75rem+var(--mobile-bottom-chrome,0px))] left-4 md:left-6";

/**
 * Gdy sticky ma caption gate / hint opakowań — pasek jest wyższy.
 * Używaj razem z `floatingToastAboveZdStickyClass` (nadpisuje bottom).
 */
export const floatingToastAboveZdStickyTallClass =
  "bottom-[calc(13.5rem+env(safe-area-inset-bottom,0px))] md:bottom-[9.75rem]";

/**
 * Drugi toast nad pierwszym przy docku ZD (np. „na bieżąco” nad „Przeliczono”).
 * Składaj z `floatingToastAboveZdStickyClass` (+ Tall gdy dock wyższy).
 */
export const floatingToastAboveZdStickyStackClass =
  "bottom-[calc(15.25rem+env(safe-area-inset-bottom,0px))] md:bottom-[11.25rem]";

/** Tall dock + drugi toast. */
export const floatingToastAboveZdStickyTallStackClass =
  "bottom-[calc(19rem+env(safe-area-inset-bottom,0px))] md:bottom-[14.25rem]";
