/**
 * Wspólne tokeny UI aplikacji — paleta OnTime (indigo + sky), nawiązanie do logowania.
 * Gradient tła i akcentów jest subtelny; ciemny panel zostaje na ekranach auth.
 */

import { cn } from "@/lib/cn";

/** Tło całej aplikacji (main + shell) */
export const appShellClass = "min-h-screen bg-transparent";

/** Obszar treści — lekki kontrast względem sidebara */
export const appMainClass = "min-h-screen overflow-y-auto bg-transparent";

/** Sidebar — biała powierzchnia, spójna z kartami logowania */
export const sidebarShellClass =
  "border-r border-[var(--card-border)] bg-[var(--card)] text-slate-900 shadow-[2px_0_24px_-12px_rgba(15,23,42,0.1)]";

export const sidebarHeaderClass =
  "shrink-0 border-b border-[var(--card-border)] px-4 pb-3 pt-4";

export const sidebarBrandAccentClass = "brand-accent-strip mb-4";

export const sidebarFooterClass =
  "shrink-0 border-t border-[var(--card-border)] bg-slate-50/80 px-3 py-3";

export const sidebarNavScrollClass = "flex-1 overflow-y-auto px-2.5 py-3";

/** Logo w aplikacji — gradient jak na logowaniu */
export const brandMarkAppClass =
  "bg-gradient-to-br from-indigo-600 to-sky-600 text-white shadow-[var(--shadow-brand)] ring-1 ring-sky-500/30";

/** Aktywny link — indigo + subtelny akcent sky po lewej */
export const navLinkActiveClass =
  "border-l-[3px] border-l-sky-400 bg-indigo-600 pl-[calc(0.75rem-3px)] text-white shadow-sm shadow-indigo-600/12 ring-1 ring-indigo-500/15";

export const navLinkIdleClass =
  "border-l-[3px] border-l-transparent text-slate-700 hover:bg-slate-100/90 hover:text-slate-900";

/** Plakietka roli — neutralna baza + kolorowy akcent */
export function roleBadgeClass(role: string): string {
  const accent: Record<string, string> = {
    admin: "border-l-violet-500",
    zakupy: "border-l-amber-500",
    sales: "border-l-indigo-500",
    sales_manager: "border-l-indigo-400",
  };
  return [
    "inline-flex max-w-full items-center rounded-lg border border-slate-200/90 border-l-[3px] bg-slate-50/80 px-2.5 py-1 text-[10px] font-semibold leading-tight text-slate-700",
    accent[role] ?? "border-l-slate-400",
  ].join(" ");
}

/** Karty treści — cień zbliżony do karty na logowaniu */
export const surfaceCardClass =
  "rounded-xl border border-slate-200/80 bg-[var(--card)] shadow-[var(--shadow-card-elevated)]";

/** Przycisk primary — ledwo zauważalny gradient */
export const buttonPrimaryClass =
  "bg-gradient-to-b from-indigo-600 to-indigo-700 text-white shadow-sm shadow-indigo-600/15 hover:from-[var(--primary-hover)] hover:to-indigo-800 active:from-indigo-800 active:to-indigo-900";

/** Ikona nagłówka panelu / sekcji marki */
export const brandIconTileClass =
  "bg-gradient-to-br from-indigo-600 to-sky-600 text-white shadow-[var(--shadow-brand)] ring-1 ring-sky-500/30";

/** Sticky zakładki panelu dziennego */
export const panelStickyTabsClass =
  "sticky top-0 z-20 border-b border-slate-200/80 bg-[var(--card)]/95 shadow-[var(--shadow-card-elevated)] backdrop-blur-sm";

/** Wypełnienie paska postępu */
export const progressFillUrgentClass = "bg-gradient-to-r from-sky-400 to-sky-600";
export const progressFillForSomeoneClass = "bg-gradient-to-r from-indigo-500 to-indigo-700";

export const brandGradientTextClass =
  "bg-gradient-to-br from-indigo-600 to-sky-600 bg-clip-text text-transparent";

export const legendDotUrgentClass = "h-2 w-2 rounded-full bg-sky-500";
export const legendDotForSomeoneClass = "h-2 w-2 rounded-full bg-indigo-500";

/** Linki akcentu marki */
export const brandLinkClass =
  "font-medium text-indigo-700 underline-offset-2 hover:text-indigo-900 hover:underline";

export const brandLinkSubtleClass = "font-medium text-indigo-600 hover:text-indigo-800";

/** Pola i checkboxy */
export const controlFocusClass =
  "focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-sky-500/15";

export const controlFocusRingClass =
  "focus:border-indigo-500 focus:ring-2 focus:ring-sky-500/15";

export const checkboxBrandClass =
  "rounded border-slate-300 text-indigo-600 focus:ring-sky-500/15";

/** Kafelki ikon sekcji */
export const sectionIconTileBrandClass = "bg-indigo-100 text-indigo-800";
export const sectionIconTileBrandSoftClass = "bg-indigo-50 text-indigo-800";

/** Wiersz / karta w trakcie akcji */
export const rowPendingRingClass = "ring-2 ring-indigo-200/80";

/** Zakładki panelu */
export const tabSelectedClass =
  "border-indigo-300/90 bg-gradient-to-b from-indigo-50 to-white text-indigo-950 shadow-sm ring-1 ring-indigo-200/50";

export const tabBadgeSelectedClass = "bg-indigo-200/80 text-indigo-900";

/** Plan tygodnia — tryb planowania */
export const plannerModeBannerClass =
  "border-b border-indigo-200/80 bg-indigo-50/60 px-4 py-3 sm:px-5";

export const plannerModeTextClass = "text-sm text-indigo-950";

export const plannerHintMutedClass = "text-xs text-indigo-800/80";

export const plannerHintMutedFaintClass = "text-xs text-indigo-800/60";

export const plannerDropActiveClass =
  "bg-indigo-50/80 ring-2 ring-inset ring-indigo-300/50";

export const plannerDropHintClass =
  "rounded-lg border border-dashed border-indigo-200 text-indigo-400";

/** Moje zamówienia — banery i karty */
export const mojeHeadlineInfoWrapClass = "bg-indigo-50 text-indigo-950";
export const mojeHeadlineInfoTitleClass = "text-indigo-900";
export const mojeHeadlineInfoSubClass = "text-indigo-800";

export const mojeCardHighlightClass =
  "z-[1] my-1 rounded-xl border border-indigo-300/90 bg-indigo-50/90 shadow-md shadow-indigo-100/30 ring-1 ring-indigo-200/70";

export const mojeFilterChipActiveClass = "ring-2 ring-indigo-400 ring-offset-1";

export const mojeFilterChipInfoClass = "bg-indigo-100 text-indigo-900";

export const mojeFilterChipSuccessClass = "bg-indigo-50 text-indigo-900";

/** Sekcja informacja (magazyn) — sky pozostaje semantyczny */
export const informacjaSurfaceClass =
  "rounded-xl border border-sky-200/90 bg-[var(--card)] shadow-[var(--shadow-card-elevated)]";

/** Mobile — widok handlowca */
export const mobileSalesHeaderClass =
  "relative sticky top-0 z-30 flex min-h-14 items-center justify-between gap-3 border-b border-slate-200/80 bg-[var(--card)]/95 px-4 shadow-[var(--shadow-card-elevated)] backdrop-blur-md md:hidden pt-[max(0.75rem,env(safe-area-inset-top,0px))]";

export const mobileSalesNavClass =
  "fixed inset-x-0 bottom-0 z-50 border-t border-slate-200/80 bg-[var(--card)]/95 shadow-[var(--shadow-card-elevated)] backdrop-blur-md md:hidden";

export const mobileNavLinkBaseClass =
  "relative flex min-h-[3.25rem] flex-col items-center justify-center gap-0.5 px-2 py-2 text-[10px] font-semibold transition-colors";

export const mobileNavLinkActiveClass =
  "text-indigo-700 before:absolute before:inset-x-3 before:top-0 before:h-0.5 before:rounded-full before:bg-gradient-to-r before:from-indigo-500 before:to-sky-400 before:content-['']";

export const mobileNavLinkIdleClass = "text-slate-500";

export const mobileNavBadgeClass =
  "bg-gradient-to-br from-indigo-600 to-sky-600 text-white shadow-sm shadow-indigo-600/20";

export const salesUpdatesBannerClass =
  "mb-4 flex flex-col gap-3 rounded-xl border border-indigo-200/80 bg-gradient-to-br from-indigo-50/90 via-white to-sky-50/40 px-3 py-3 text-sm text-indigo-950 shadow-[var(--shadow-card-elevated)] sm:mb-6 sm:flex-row sm:items-center sm:justify-between sm:px-4";

/** Panel dzienny — kafelki, zakładki, linki i przyciski pomocnicze */
export const panelMetricTileClass =
  "rounded-xl border border-slate-200/80 bg-white px-3 py-2.5 text-left shadow-[var(--shadow-card)] transition";

export const panelMetricTileInteractiveClass =
  "cursor-pointer hover:border-indigo-200/80 hover:bg-indigo-50/40 hover:shadow-[var(--shadow-card-elevated)]";

export const panelTabIdleClass =
  "border-slate-200/90 bg-white text-slate-700 hover:border-indigo-200/70 hover:bg-indigo-50/50";

/** Klikalna nazwa dostawcy — wygląd jak nagłówek, nie jak odwiedzony link */
export const panelNameLinkClass =
  "text-left font-medium text-slate-900 transition-colors hover:text-slate-950";

/** Drobna akcja tekstowa w panelu (np. pełna lista, Terminy) */
export const panelTextLinkClass =
  "font-medium text-slate-600 transition-colors hover:text-slate-800";

/** E-mail lub kontakt do dostawcy — bez podkreślenia */
export const panelContactLinkClass =
  "max-w-[min(100%,18rem)] truncate text-xs font-medium text-slate-600 transition-colors hover:text-slate-900";

export const panelChoiceChipClass =
  "rounded-xl border px-3 py-2 text-left text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/15";

export const panelChoiceChipIdleClass =
  "border-slate-200/90 bg-white text-slate-700 hover:border-indigo-200/80 hover:bg-indigo-50/50";

export const panelChoiceChipSelectedClass =
  "border-indigo-400/90 bg-gradient-to-b from-indigo-50 to-white text-indigo-950 ring-1 ring-indigo-200/60";

export const panelChoiceChipSuccessSelectedClass =
  "border-emerald-400/90 bg-gradient-to-b from-emerald-50 to-white text-emerald-950 ring-1 ring-emerald-200/50";

export const panelDashedActionClass =
  "w-full rounded-xl border border-dashed border-indigo-200/70 bg-indigo-50/30 px-4 py-3 text-sm font-medium text-indigo-800 transition hover:border-indigo-300/90 hover:bg-indigo-50/60 hover:text-indigo-950";

export const panelMutedToggleClass =
  "text-sm font-medium text-slate-600 transition hover:text-indigo-800";

export const panelMenuItemClass =
  "block w-full cursor-pointer px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-indigo-50/80 hover:text-indigo-950";

export const panelSegmentControlClass =
  "min-h-9 shrink-0 !rounded-none border-0 border-l border-slate-200/90 px-3 text-sm font-medium text-slate-700 shadow-none transition hover:bg-indigo-50/60";

export const panelSegmentControlOpenClass = "bg-indigo-50/80 text-indigo-900";

/** Pierwszy segment w grupie (Zamówione) — gradient primary, biały tekst */
export const panelSegmentPrimaryClass = cn(
  buttonPrimaryClass,
  "min-h-9 shrink-0 !rounded-none rounded-l-xl border-0 px-3.5 text-sm font-semibold text-white shadow-none hover:shadow-sm"
);

export const panelCardHitAreaClass =
  "w-full cursor-pointer rounded-xl text-left transition hover:bg-indigo-50/35";

export const panelNoticeTriggerBaseClass =
  "flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-sm transition";

export const panelNoticeTriggerUrgentClass =
  "border-amber-200/90 bg-amber-50/50 hover:border-amber-300 hover:bg-amber-50";

export const panelNoticeTriggerDefaultClass =
  "border-slate-200/90 bg-slate-50/60 hover:border-indigo-200/70 hover:bg-indigo-50/40";

/** Przycisk outline w grupie (HoldToConfirm — Uzupełniające) */
export const panelHoldOutlineClass =
  "border border-indigo-200/90 bg-[var(--primary-muted)]/60 text-indigo-800 hover:bg-[var(--primary-muted)]";

/** Pasek akcji w nagłówku panelu dziennego (wyszukiwarka + przyciski) */
export const panelToolbarShellClass =
  "w-full min-w-0 rounded-xl border border-slate-200/80 bg-gradient-to-b from-slate-50/80 to-white p-1.5 shadow-sm";

export const panelToolbarRowClass =
  "flex min-w-0 flex-col gap-2 sm:flex-row sm:items-stretch";

export const panelToolbarSearchWrapClass = "min-w-0 flex-1 px-0.5 sm:flex sm:items-center";

export const panelToolbarSearchInputClass =
  "h-9 w-full rounded-lg border border-slate-200/90 bg-white px-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100";

export const panelToolbarActionsClass =
  "flex shrink-0 flex-wrap items-center justify-end gap-1.5 sm:border-l sm:border-slate-200/80 sm:pl-2";

export const panelToolbarTextButtonClass =
  "inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200/90 bg-white px-2.5 text-xs font-medium text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-white hover:text-slate-900";

export const panelToolbarIconButtonClass =
  "inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-slate-200/90 bg-white text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-white hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50";
