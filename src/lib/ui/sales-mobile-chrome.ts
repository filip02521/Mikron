/** Root wrapper for logged-in sales shell — offsets floating UI above bottom tab bar. */
export const salesMobileChromeRoot =
  "[--mobile-bottom-chrome:calc(3.25rem+env(safe-area-inset-bottom,0px))] md:[--mobile-bottom-chrome:0px]";

/** Wysokość zwiniętego docka podglądu admina (sam pasek). */
export const ADMIN_PREVIEW_DOCK_HEIGHT = "2.75rem";

/**
 * CSS vars na shell root gdy admin preview aktywny.
 * `--admin-preview-dock` — wysokość paska (toasty).
 * `--admin-preview-clearance` — clearance treści (desktop = pasek + bottom-3).
 */
export const adminPreviewDockShellVarsClass = [
  `[--admin-preview-dock:${ADMIN_PREVIEW_DOCK_HEIGHT}]`,
  `[--admin-preview-clearance:${ADMIN_PREVIEW_DOCK_HEIGHT}]`,
  "md:[--admin-preview-clearance:calc(var(--admin-preview-dock)+0.75rem)]",
].join(" ");

/** Toast / undo bar position — clears mobile bottom nav + admin preview dock. */
export const floatingToastBottomClass =
  "bottom-[calc(0.75rem+var(--mobile-bottom-chrome,0px)+var(--admin-preview-dock,0px))]";

/** Drugi toast nad pierwszym (np. termin ZD nad undo). */
export const floatingToastStackAboveClass =
  "bottom-[calc(4.75rem+var(--mobile-bottom-chrome,0px)+var(--admin-preview-dock,0px))]";

/** Undo / toast nad sticky Create/TSV/Link w kreatorze ZD. */
export const floatingToastAboveZdStickyClass =
  "bottom-[calc(9.75rem+env(safe-area-inset-bottom,0px)+var(--admin-preview-dock,0px))] md:bottom-[calc(6.75rem+var(--admin-preview-dock,0px))]";

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
  "bottom-[calc(0.75rem+var(--mobile-bottom-chrome,0px)+var(--admin-preview-dock,0px))] left-4 md:left-6";

/**
 * Gdy sticky ma caption gate / hint opakowań — pasek jest wyższy.
 * Używaj razem z `floatingToastAboveZdStickyClass` (nadpisuje bottom).
 */
export const floatingToastAboveZdStickyTallClass =
  "bottom-[calc(13.5rem+env(safe-area-inset-bottom,0px)+var(--admin-preview-dock,0px))] md:bottom-[calc(9.75rem+var(--admin-preview-dock,0px))]";

/**
 * Drugi toast nad pierwszym przy docku ZD (np. „na bieżąco” nad „Przeliczono”).
 * Składaj z `floatingToastAboveZdStickyClass` (+ Tall gdy dock wyższy).
 */
export const floatingToastAboveZdStickyStackClass =
  "bottom-[calc(15.25rem+env(safe-area-inset-bottom,0px)+var(--admin-preview-dock,0px))] md:bottom-[calc(11.25rem+var(--admin-preview-dock,0px))]";

/** Tall dock + drugi toast. */
export const floatingToastAboveZdStickyTallStackClass =
  "bottom-[calc(19rem+env(safe-area-inset-bottom,0px)+var(--admin-preview-dock,0px))] md:bottom-[calc(14.25rem+var(--admin-preview-dock,0px))]";

/** Sticky footer nad mobile nav + opcjonalnym dockiem admin preview. */
export const stickyAboveMobileChromeClass =
  "bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px)+var(--admin-preview-dock,0px))] md:bottom-[var(--admin-preview-clearance,0px)]";
