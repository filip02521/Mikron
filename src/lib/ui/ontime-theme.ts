/**
 * Wspólne tokeny UI aplikacji — paleta OnTime (indigo + sky), nawiązanie do logowania.
 * Gradient tła i akcentów jest subtelny; ciemny panel zostaje na ekranach auth.
 */

import { cn } from "@/lib/cn";
import type { NavTone } from "@/lib/nav";

/** Tło całej aplikacji (main + shell) */
export const appShellClass = "min-h-screen bg-transparent";

/** Obszar treści — lekki kontrast względem sidebara */
export const appMainClass = "min-h-screen overflow-y-auto bg-transparent";

/** Padding main — bez max-width; szerokość ustawia shell każdej strony. */
export const appMainInsetClass = "mx-auto w-full px-3 py-5 sm:px-4 sm:py-6 lg:px-5";

/** Sidebar — biała powierzchnia, obwódka i cień jak karty panelu dziennego */
export const sidebarShellClass =
  "border-r border-indigo-100/75 bg-[var(--card)] text-slate-900 shadow-[var(--shadow-card)]";

export const sidebarHeaderClass =
  "shrink-0 border-b border-indigo-100/70 px-4 pb-4 pt-5";

export const sidebarFooterClass =
  "shrink-0 border-t border-indigo-100/70 bg-indigo-50/25 px-3 py-3";

export const sidebarNavScrollClass = "flex-1 overflow-y-auto px-2.5 pb-3 pt-4";

/** Sidebar — aktywny link: mocniejsze tło w tonie, bez obramowania. */
export function sidebarNavToneActiveClass(tone: NavTone): string {
  switch (tone) {
    case "amber":
      return "border border-transparent bg-amber-100/60 text-slate-900 shadow-sm shadow-amber-900/5";
    case "orange":
      return "border border-transparent bg-orange-100/65 text-slate-900 shadow-sm shadow-orange-900/5";
    case "emerald":
      return "border border-transparent bg-emerald-100/60 text-slate-900 shadow-sm shadow-emerald-900/5";
    case "sky":
      return "border border-transparent bg-sky-100/55 text-slate-900 shadow-sm shadow-sky-900/5";
    case "slate":
      return "border border-transparent bg-slate-200/55 text-slate-900 shadow-sm";
    case "violet":
      return "border border-transparent bg-violet-100/60 text-slate-900 shadow-sm shadow-violet-900/5";
    case "indigo":
    default:
      return "border border-transparent bg-indigo-100/55 text-slate-900 shadow-sm shadow-indigo-900/5";
  }
}

/** @deprecated Użyj {@link sidebarNavToneActiveClass} z tonem pozycji. */
export const navLinkActiveClass =
  "border border-transparent bg-indigo-100/55 text-slate-900 shadow-sm shadow-indigo-900/5";

/** Sidebar — link w stanie spoczynku (bez obramowania). */
export const navLinkIdleClass =
  "border border-transparent text-slate-700 hover:bg-slate-50/70 hover:text-slate-900";

/** Sidebar — nagłówek grupy nawigacji. */
export const sidebarNavSectionTitleClass =
  "mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500";

/** Sidebar — separator między grupami. */
export const sidebarNavSectionDividerClass = "mt-3 border-t border-indigo-100/70 pt-3";

/** Sidebar — wyróżniony punkt startowy (Panel / Moje) w stanie spoczynku. */
export const sidebarNavPrimaryHighlightIdleClass =
  "bg-indigo-50/30 hover:bg-indigo-50/45";

/** Delikatne tło powierzchni wg tonu — spoczynek (sidebar). */
export function navToneSurfaceIdleClass(tone: NavTone): string {
  switch (tone) {
    case "amber":
      return "bg-amber-50/35";
    case "orange":
      return "bg-orange-50/40";
    case "emerald":
      return "bg-emerald-50/35";
    case "sky":
      return "bg-sky-50/35";
    case "violet":
      return "bg-violet-50/35";
    case "slate":
      return "bg-slate-50/45";
    case "indigo":
    default:
      return "bg-indigo-50/30";
  }
}

/** Sidebar — delikatne tło wiersza primary wg tonu semantycznego (Dziś). */
export function sidebarNavToneHighlightIdleClass(tone: NavTone): string | undefined {
  switch (tone) {
    case "indigo":
    case "amber":
    case "orange":
    case "emerald":
      return cn(navToneSurfaceIdleClass(tone), "hover:opacity-95");
    default:
      return undefined;
  }
}

/** Sidebar — badge licznika dopasowany do tonu pozycji. */
export function sidebarNavBadgeClassForTone(tone: NavTone, active: boolean): string {
  if (active) return "bg-slate-200/90 text-slate-800";
  switch (tone) {
    case "amber":
      return sidebarNavBadgeWarningClass;
    case "orange":
      return "bg-orange-100 text-orange-950 ring-1 ring-orange-200/80";
    case "emerald":
      return "bg-emerald-100 text-emerald-900 ring-1 ring-emerald-200/80";
    case "indigo":
      return "bg-indigo-100 text-indigo-800 ring-1 ring-indigo-200/70";
    case "sky":
      return "bg-sky-100 text-sky-900 ring-1 ring-sky-200/70";
    case "violet":
      return "bg-violet-100 text-violet-900 ring-1 ring-violet-200/70";
    default:
      return "bg-slate-100 text-slate-700 ring-1 ring-slate-200/70";
  }
}

/** Sidebar — kompaktowy wiersz (archiwum, dostawcy, system). */
export const sidebarNavCompactPaddingClass = "px-2 py-1.5";

/** Sidebar — badge wymagający uwagi (weryfikacja). */
export const sidebarNavBadgeWarningClass =
  "bg-amber-100 text-amber-900 ring-1 ring-amber-200/80";

/** Logo w aplikacji — gradient jak na logowaniu */
export const brandMarkAppClass =
  "bg-gradient-to-br from-indigo-600 to-sky-600 text-white shadow-[var(--shadow-brand)] ring-1 ring-sky-500/30";

/** Plakietka roli — delikatny ton bez lewego paska. */
export function roleBadgeClass(role: string): string {
  const tint: Record<string, string> = {
    admin: "border-violet-200/80 bg-violet-50/90 text-violet-800",
    zakupy: "border-amber-200/80 bg-amber-50/90 text-amber-900",
    magazyn: "border-emerald-200/80 bg-emerald-50/90 text-emerald-800",
    sales: "border-indigo-200/80 bg-indigo-50/90 text-indigo-800",
    sales_manager: "border-indigo-200/70 bg-indigo-50/80 text-indigo-800",
  };
  return [
    "inline-flex max-w-full items-center rounded-md border px-2.5 py-1 text-[10px] font-semibold leading-tight",
    tint[role] ?? "border-slate-200/90 bg-slate-50/80 text-slate-700",
  ].join(" ");
}

/** Karty treści — cień zbliżony do karty na logowaniu */
export const surfaceCardClass =
  "rounded-md border border-slate-200/80 bg-[var(--card)] shadow-[var(--shadow-card-elevated)]";

/** Przycisk primary — ledwo zauważalny gradient */
export const buttonPrimaryClass =
  "bg-gradient-to-b from-indigo-600 to-indigo-700 text-white shadow-sm shadow-indigo-600/15 hover:from-[var(--primary-hover)] hover:to-indigo-800 active:from-indigo-800 active:to-indigo-900";

/** Wspólna wysokość kontrolek w pasku akcji nagłówka (checkbox, CTA, pomoc). */
export const pageToolbarSizingClass = "h-10 min-h-10 shrink-0 px-3 py-0 text-xs leading-none";

/** Ramka pomocnicza — toggle / drugorzędny przycisk w toolbarze. */
export const pageToolbarSurfaceClass =
  "inline-flex items-center justify-center gap-2 rounded-md border border-slate-200 bg-white font-medium text-slate-700 shadow-sm";

/** Ikona nagłówka panelu / sekcji marki */
export const brandIconTileClass =
  "bg-gradient-to-br from-indigo-600 to-sky-600 text-white shadow-[var(--shadow-brand)] ring-1 ring-sky-500/30";

/** Sticky zakładki panelu dziennego */
export const panelStickyChromeClass =
  "sticky top-0 z-20 border-b border-indigo-100/75 bg-[var(--card)]/95 shadow-[var(--shadow-card-elevated)] backdrop-blur-sm";

/** @deprecated Alias — użyj {@link panelStickyChromeClass}. */
export const panelStickyTabsClass = panelStickyChromeClass;

/** Panel dzienny / operacje zakupów — wąska kolumna; lekko szersza tylko na 2xl+. */
export const panelWorkspaceShellClass = "relative mx-auto w-full max-w-3xl 2xl:max-w-4xl";

/** Strony operacji z odstępem między blokami (toast, karta, alert). */
export const panelPageShellClass = cn(panelWorkspaceShellClass, "space-y-4");

/** Siatka kalendarza tygodnia — dopasowana do wąskiej kolumny panelu. */
export const weekPlannerGridClass =
  "grid grid-cols-2 gap-0 border-t border-slate-100 divide-x divide-y divide-slate-100 sm:grid-cols-3 sm:divide-y-0 2xl:grid-cols-5";

/** Nagłówki dni w pustym kalendarzu — ta sama siatka co {@link weekPlannerGridClass}. */
export const weekPlannerEmptyHeaderGridClass =
  "grid grid-cols-2 divide-x divide-y divide-slate-100 border-b border-slate-100 sm:grid-cols-3 sm:divide-y-0 2xl:grid-cols-5";

/** Panel handlowca — wąska kolumna treści (listy, formularze); lekko szersza tylko na 2xl+. */
export const salesWorkspaceShellClass = "relative mx-auto w-full max-w-3xl 2xl:max-w-4xl";

/** Podgląd zespołu — szerszy niż pozostałe zakładki (siatka kart). */
export const salesTeamShellClass = "relative mx-auto w-full max-w-4xl xl:max-w-5xl 2xl:max-w-6xl";

/** Obudowa stron handlowca (/moje, /prosba, /plan, /notatnik). */
export const salesPageShellClass = cn(salesWorkspaceShellClass, "space-y-4");

/** Obudowa zakładek zespołu (/zespol/*). */
export const salesTeamPageShellClass = cn(salesTeamShellClass, "space-y-4");

/** Administracja — tabele i formularze (szersza kolumna niż panel dzienny). */
export const adminPageShellClass = salesTeamPageShellClass;

/** Historia, zamówienie grupowe — jak karty dostawców (tabele bez ucinania). */
export const procurementArchivePageShellClass = adminPageShellClass;

/** Treść wewnątrz karty huba administracji / dostawców. */
export const adminHubBodyClass = "min-w-0 space-y-4 p-3 sm:p-4 lg:p-5";

/** Padding chrome panelu handlowca — nieco ciaśniej niż panel dzienny. */
export const salesChromeInsetClass = "px-3 sm:px-4 lg:px-5";

/** Treść wewnątrz karty handlowca. */
export const salesCardBodyClass = "space-y-3 p-3 sm:p-4";

/** Min. obszar dotyku — 44px mobile, kompakt od sm (WCAG / Apple HIG). */
export const salesTouchTargetClass = "min-h-11 sm:min-h-8";

/** Jedna wysokość kontrolek listy /moje — jak toolbar nagłówka (40px). */
export const mojeControlHeightClass = "h-10 min-h-10";

/** Drugorzędny przycisk / chip akcji na /moje. */
export const mojeSecondaryControlClass = cn(
  "inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm transition",
  "hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500",
  "disabled:cursor-not-allowed disabled:opacity-50",
  mojeControlHeightClass
);

/** Potwierdzenie odbioru / akcja wymagająca reakcji. */
export const mojePickupControlClass = cn(
  "inline-flex items-center justify-center gap-0.5 rounded-md border border-emerald-700 bg-emerald-600 px-3 text-xs font-semibold text-white shadow-sm transition",
  "hover:bg-emerald-700 active:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50",
  mojeControlHeightClass
);

/** Potwierdzenie powiadomienia informacyjnego od magazynu. */
export const mojeInformacjaAckControlClass = cn(
  "inline-flex items-center justify-center gap-0.5 rounded-md border border-violet-700 bg-violet-600 px-3 text-xs font-semibold text-white shadow-sm transition",
  "hover:bg-violet-700 active:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-50",
  mojeControlHeightClass
);

/** Nawigacja z panelu Start dnia (Tablica, Notatnik). */
export const mojeBrandOutlineControlClass = cn(
  "inline-flex items-center justify-center gap-0.5 rounded-md border border-indigo-200 bg-white px-3 text-xs font-semibold text-indigo-800 shadow-sm transition",
  "hover:bg-indigo-50",
  mojeControlHeightClass
);

/** Destrukcyjna akcja wtórna — anulowanie pojedynczej pozycji (outline, spójne z mojeSecondary). */
export const mojeDestructiveOutlineControlClass = cn(
  "inline-flex items-center justify-center gap-1.5 rounded-md border border-red-200 bg-white px-3 text-xs font-semibold text-red-800 shadow-sm transition",
  "hover:border-red-300 hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400",
  "disabled:cursor-not-allowed disabled:opacity-50",
  mojeControlHeightClass
);

/** Anulowanie pojedynczej linii — dyskretny link przy wierszu produktu. */
export const mojeDestructiveSubtleControlClass = cn(
  "inline-flex shrink-0 items-center justify-center rounded-sm px-1 py-0.5 text-[10px] font-medium text-slate-400/90 transition",
  "hover:text-red-700 focus-visible:text-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-red-400/50",
  "disabled:cursor-not-allowed disabled:opacity-40"
);

/**
 * Typografia panelu handlowca — płaska skala, bez powiększania na lg+.
 * Hierarchia: pageTitle → blockTitle/rowTitle → rowBody/chrome → rowMeta/sectionLabel.
 */
export const salesTypography = {
  pageTitle: "text-base font-semibold tracking-tight text-slate-900",
  pageDesc: "text-xs leading-relaxed text-slate-500",
  blockTitle: "text-sm font-semibold text-slate-900",
  sectionLabel: "text-[11px] font-semibold uppercase tracking-wide text-slate-600",
  sectionLabelAccent: "text-[11px] font-semibold uppercase tracking-wide text-emerald-900",
  sectionHint: "text-xs leading-relaxed text-slate-500",
  rowTitle: "text-sm font-semibold leading-snug text-slate-900",
  rowBody: "text-xs font-medium leading-snug text-slate-600",
  rowMeta: "text-[11px] leading-snug text-slate-500",
  chrome: "text-xs leading-snug text-slate-600",
  statValue: "text-sm font-semibold tabular-nums text-slate-900",
  statLabel: "text-xs text-slate-500",
  kindTag: "text-[10px] font-semibold uppercase tracking-wide",
  pill: "text-[11px] font-semibold leading-snug",
} as const;

/** Etykieta „Uwagi” przy notatce handlowca — spójna w /moje i panelu dziennym. */
export const salesRequestNoteLabelClass =
  "inline-flex items-center rounded bg-indigo-50 px-1 py-0.5 font-semibold uppercase tracking-wide text-indigo-700";

/** Etykieta klienta końcowego — ten sam układ co „Uwagi”, ton indigo. */
export const salesClientLabelClass =
  "inline-flex items-center rounded bg-indigo-50 px-1 py-0.5 font-semibold uppercase tracking-wide text-indigo-700";

export const salesClientNameClass = "font-medium text-indigo-900";

/** Etykieta powiązania ZK — fiolet jak w notatniku, ten sam układ co „Klient”. */
export const salesZkLabelClass =
  "inline-flex items-center rounded bg-violet-50 px-1 py-0.5 font-semibold uppercase tracking-wide text-violet-700";

export const salesZkNumberClass = "font-medium text-violet-900";

/** Wewnętrzny padding sekcji panelu. */
export const panelSectionInsetClass = "px-3 py-3 sm:px-4 sm:py-4 lg:px-5 lg:py-4";

/** Padding poziomy chrome (tabs, status, toolbar pod tytułem). */
export const panelChromeInsetClass = "px-3 sm:px-4 lg:px-5";

/** Wewnętrzny padding podsekcji (nagłówki list w karcie). */
export const panelSubsectionInsetClass = "px-3 sm:px-4 lg:px-5";

/**
 * Skala typografii panelu dziennego — płaska, bez powiększania na lg+ (wąska kolumna).
 */
export const panelTypography = {
  sectionTitle: "text-sm font-semibold text-slate-900",
  sectionLabel: "text-[11px] font-semibold uppercase tracking-wide text-slate-600",
  rowTitle: "text-sm font-semibold leading-snug text-slate-900",
  rowMeta: "text-xs leading-snug text-slate-500",
  caption: "text-[11px] leading-snug text-slate-500",
  chrome: "text-xs leading-snug text-slate-600",
  sectionDesc: "text-xs leading-relaxed text-slate-500",
  tab: "text-sm font-medium",
  tabBadge: "text-xs font-semibold tabular-nums",
  statValue: "text-xl font-semibold tabular-nums tracking-tight text-slate-900",
} as const;

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
export const rowPendingRingClass = "ring-2 ring-inset ring-indigo-200/80";

/** Zakładki panelu */
export const tabSelectedClass =
  "border-slate-300/90 bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/80";

export const tabBadgeSelectedClass = "bg-slate-200/90 text-slate-800";

/** Plan tygodnia — tryb planowania */
export const plannerModeBannerClass =
  "border-b border-indigo-200/80 bg-indigo-50/60 px-4 py-3 sm:px-5";

export const plannerModeTextClass = "text-sm text-indigo-950";

export const plannerHintMutedClass = "text-xs text-indigo-800/80";

export const plannerHintMutedFaintClass = "text-xs text-indigo-800/60";

export const plannerDropActiveClass =
  "bg-indigo-50/80 ring-2 ring-inset ring-indigo-300/50";

export const plannerDropHintClass =
  "rounded-md border border-dashed border-indigo-200 text-indigo-400";

/** Moje zamówienia — banery i karty */
export const mojeHeadlineInfoWrapClass = "bg-indigo-50 text-indigo-950";
export const mojeHeadlineInfoTitleClass = "text-indigo-900";
export const mojeHeadlineInfoSubClass = "text-indigo-800";

export const mojeCardHighlightClass =
  "z-[1] my-1 rounded-md border border-indigo-300/90 bg-indigo-50/90 shadow-md shadow-indigo-100/30 ring-1 ring-indigo-200/70";

/** Sekcja informacja (magazyn) — sky pozostaje semantyczny */
export const informacjaSurfaceClass =
  "rounded-md border border-sky-200/90 bg-[var(--card)] shadow-[var(--shadow-card-elevated)]";

/** Mobile — widok handlowca */
export const mobileSalesHeaderClass =
  "relative sticky top-0 z-30 flex min-h-14 items-center justify-between gap-3 border-b border-slate-200/80 bg-[var(--card)]/95 px-4 shadow-[var(--shadow-card-elevated)] backdrop-blur-md md:hidden pt-[max(0.75rem,env(safe-area-inset-top,0px))]";

export const mobileSalesNavClass =
  "fixed inset-x-0 bottom-0 z-50 border-t border-slate-200/80 bg-[var(--card)]/95 shadow-[var(--shadow-card-elevated)] backdrop-blur-md md:hidden";

export const mobileNavLinkBaseClass =
  "relative mx-0.5 flex min-h-[3.25rem] flex-col items-center justify-center gap-0.5 rounded-md px-1.5 py-2 text-[11px] font-semibold transition-colors lg:text-xs";

export const mobileNavLinkActiveClass =
  "border border-transparent bg-indigo-100/55 text-slate-900 shadow-sm shadow-indigo-900/5";

export const mobileNavLinkIdleClass = "text-slate-500 hover:bg-white/60 hover:text-slate-800";

export const mobileNavBadgeClass =
  "bg-slate-700 text-[9px] font-bold text-white shadow-sm lg:text-[10px]";

/** Wspólna obudowa komunikatów systemowych. */
export const systemNoticeShellClass = cn(
  "flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between"
);

/** Przypięte ogłoszenie — neutralna karta, bez gradientu. */
export const systemNoticePinnedClass = cn(
  systemNoticeShellClass,
  "mb-3 rounded-md border border-indigo-100/80 bg-white px-3 py-2 shadow-[var(--shadow-card)] sm:px-3.5"
);

/** Komunikat z akcją (nowe ogłoszenia, odpowiedzi, odświeżenie). */
export const systemNoticeActionClass = cn(
  systemNoticeShellClass,
  "rounded-md border border-slate-200/90 bg-white px-3 py-3 text-slate-900 shadow-[var(--shadow-card)] sm:px-4"
);

/** Tour onboarding — jedyny mocny akcent indigo w warstwie notice. */
export const systemNoticeTourClass = cn(
  systemNoticeShellClass,
  "mb-4 rounded-md border border-indigo-300/90 bg-indigo-600 px-3 py-3 text-white shadow-md sm:px-4"
);

/** Sticky pasek odświeżenia w panelu dziennym. */
export const systemNoticePanelStripClass = cn(
  systemNoticeShellClass,
  "border-t border-slate-200/90 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-2 sm:py-2.5 sm:px-6"
);

/** Toast / banner cofania — spójny z SystemNotice i panelem dziennym. */
export const systemNoticeUndoClass = cn(
  "relative overflow-hidden rounded-md border border-slate-200/90 bg-white text-slate-900 shadow-[var(--shadow-card)]"
);

export const undoNoticeIconTileClass = cn(
  brandIconTileClass,
  "flex h-9 w-9 shrink-0 items-center justify-center rounded-md"
);

export const undoNoticeProgressTrackClass = "absolute inset-x-0 top-0 h-0.5 bg-slate-100";

export const undoNoticeProgressFillClass = "undo-notice-progress-fill h-full bg-indigo-500";

/** @deprecated Użyj {@link systemNoticeActionClass}. */
export const salesUpdatesBannerClass = cn(systemNoticeActionClass, "mb-4 sm:mb-6");

/** @deprecated Użyj {@link systemNoticePinnedClass}. */
export const salesPinnedNoticeClass = systemNoticePinnedClass;

/** Obudowa menu kontekstowego w panelu dzennym. */
export const panelDropdownShellClass =
  "rounded-md border border-indigo-100/85 bg-white py-1 shadow-lg shadow-indigo-950/5 ring-1 ring-sky-100/35";

export const panelQueueStepsShellClass = cn(
  "flex flex-nowrap items-center gap-2 overflow-x-auto rounded-md border border-slate-200/80 bg-slate-50/40 px-2 py-2 sm:px-2.5 sm:py-2",
  "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
);

/** Klikalny licznik sekcji w pasku kolejki Dziś. */
export const panelQueueStatButtonClass =
  "inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-md px-2 py-1.5 -mx-1 transition-colors hover:bg-slate-100/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300/80";

/** Podświetlenie świeżo zsynchronizowanych, nieprzeczytanych prośb. */
export const dailyPanelFreshHighlightClass =
  "ring-2 ring-inset ring-violet-500/55 shadow-md shadow-violet-200/50";

export type DailyPanelUnseenVariant = "prosby" | "stockOut";

/** Wiersz nieprzeczytanej prośby w panelu dziennym — delikatne tło, bez paska bocznego sekcji. */
export function dailyPanelUnseenRequestRowClass(
  variant: DailyPanelUnseenVariant,
  options?: { nestedInBlock?: boolean }
): string {
  const nested = options?.nestedInBlock;
  if (variant === "stockOut") {
    if (nested) return "bg-amber-50/70 hover:bg-amber-50/85";
    return "border-amber-200/75 bg-amber-50/55 shadow-sm ring-1 ring-inset ring-amber-100/80";
  }
  if (nested) return "bg-violet-50/70 hover:bg-violet-50/85";
  return "border-violet-200/75 bg-violet-50/55 shadow-sm ring-1 ring-inset ring-violet-100/80";
}

/** Badge „Nowa” / licznik nieprzeczytanych — kontrastowy, dobrze widoczny na liście. */
export function dailyPanelUnseenBadgeClass(variant: DailyPanelUnseenVariant): string {
  if (variant === "stockOut") {
    return "bg-amber-600 text-white ring-1 ring-amber-700/30";
  }
  return "bg-violet-600 text-white ring-1 ring-violet-700/30";
}

/** Obudowa wielu prośb u jednego dostawcy — ton bez lewego paska. */
export function procurementSupplierBlockShellClass(
  variant: DailyPanelUnseenVariant = "prosby"
): string {
  if (variant === "stockOut") {
    return "overflow-hidden rounded-md border border-amber-200/85 bg-amber-50/20 shadow-sm";
  }
  return "overflow-hidden rounded-md border border-indigo-200/75 bg-indigo-50/15 shadow-sm";
}

/** Nagłówek bloku dostawcy (wiele osób / grup). */
export function procurementSupplierBlockHeaderClass(
  variant: DailyPanelUnseenVariant = "prosby"
): string {
  if (variant === "stockOut") {
    return "border-b border-amber-200/65 bg-amber-50/55";
  }
  return "border-b border-indigo-200/60 bg-indigo-50/45";
}

/** Lista prośb wewnątrz bloku dostawcy — wspólny kontener, bez osobnych ramek. */
export function procurementSupplierBlockInnerListClass(
  variant: DailyPanelUnseenVariant = "prosby"
): string {
  if (variant === "stockOut") {
    return "divide-y divide-amber-100/80 bg-amber-50/10";
  }
  return "divide-y divide-indigo-100/70 bg-indigo-50/10";
}

export const panelMetricTileClass =
  "rounded-md border border-indigo-100/70 bg-white px-3 py-2.5 text-left shadow-[var(--shadow-card)] transition";

export const panelMetricTileInteractiveClass =
  "cursor-pointer hover:border-indigo-200/80 hover:bg-indigo-50/45 hover:shadow-[var(--shadow-card-elevated)]";

export const panelTabIdleClass =
  "border-slate-200/90 bg-white text-slate-700 hover:border-slate-300/90 hover:bg-slate-50/80";

/** Klikalna nazwa dostawcy — wygląd jak nagłówek, nie jak odwiedzony link */
export const panelNameLinkClass =
  "text-left font-medium text-slate-900 transition-colors hover:text-indigo-950";

/** Drobna akcja tekstowa w panelu (np. pełna lista, Terminy) */
export const panelTextLinkClass =
  "font-medium text-indigo-700/85 transition-colors hover:text-indigo-900";

/** E-mail lub kontakt do dostawcy — bez podkreślenia */
export const panelContactLinkClass =
  "max-w-[min(100%,18rem)] truncate text-xs font-medium text-indigo-700/80 transition-colors hover:text-indigo-950";

export const panelChoiceChipClass =
  "rounded-md border px-3 py-2 text-left text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/15";

export const panelChoiceChipIdleClass =
  "border-indigo-100/80 bg-white text-slate-700 hover:border-indigo-200/80 hover:bg-indigo-50/50";

export const panelChoiceChipSelectedClass =
  "border-indigo-400/90 bg-gradient-to-b from-indigo-50 to-white text-indigo-950 ring-1 ring-indigo-200/60";

export const panelChoiceChipSuccessSelectedClass =
  "border-emerald-400/90 bg-gradient-to-b from-emerald-50 to-white text-emerald-950 ring-1 ring-emerald-200/50";

export const panelDashedActionClass =
  "w-full rounded-md border border-dashed border-indigo-200/70 bg-indigo-50/30 px-4 py-3 text-sm font-medium text-indigo-800 transition hover:border-indigo-300/90 hover:bg-indigo-50/60 hover:text-indigo-950";

export const panelMutedToggleClass =
  "text-sm font-medium text-indigo-700/80 transition hover:text-indigo-900";

export const panelMenuItemClass =
  "block w-full cursor-pointer px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-indigo-50/80 hover:text-indigo-950";

/** Segmenty w grupie akcji panelu — h-full wypełnia obudowę (bez białego paska). */
export const panelSegmentPrimaryClass =
  "flex h-full min-h-0 shrink-0 items-center justify-center rounded-none rounded-l-md border-0 bg-indigo-600 px-2.5 text-xs font-semibold leading-none text-white shadow-none transition-colors duration-150 hover:bg-indigo-700 active:bg-indigo-800 sm:px-3";

export const panelSegmentControlClass =
  "flex h-full min-h-0 shrink-0 items-center justify-center rounded-none border-0 border-l border-slate-200/90 px-2 text-xs font-medium leading-none text-slate-700 shadow-none transition-colors duration-150 hover:bg-slate-50 sm:px-2.5";

/** Outline (Uzupełniające) — ten sam layout co panelSegmentControlClass. */
export const panelSegmentOutlineClass =
  "flex h-full min-h-0 shrink-0 items-center justify-center rounded-none border-0 border-l border-indigo-200/90 bg-[var(--primary-muted)]/60 px-2 text-xs font-semibold leading-none text-indigo-800 shadow-none transition-colors duration-150 hover:bg-[var(--primary-muted)] disabled:cursor-not-allowed disabled:opacity-50 sm:px-2.5";

export const panelSegmentLastClass = "rounded-r-md";

/** Segment potwierdzenia w grupie akcji /moje — h-full wypełnia obudowę. */
export const mojeAckSegmentPrimaryClass =
  "flex h-full min-h-0 shrink-0 items-center justify-center rounded-none border-0 bg-emerald-600 px-2.5 text-xs font-semibold leading-none text-white shadow-none transition-colors duration-150 hover:bg-emerald-700 active:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50 sm:px-2";

export const mojeAckSegmentInformacjaClass =
  "flex h-full min-h-0 shrink-0 items-center justify-center rounded-none border-0 bg-violet-600 px-2.5 text-xs font-semibold leading-none text-white shadow-none transition-colors duration-150 hover:bg-violet-700 active:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-50 sm:px-2";

export const mojeAckSegmentOutlineClass =
  "flex h-full min-h-0 shrink-0 items-center justify-center rounded-none border-0 border-l border-emerald-200/90 bg-white px-2 text-xs font-semibold leading-none text-emerald-800 shadow-none transition-colors duration-150 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50 sm:px-2";

export const panelSegmentControlOpenClass = "bg-slate-50 text-slate-900";

export const panelCardHitAreaClass =
  "w-full cursor-pointer rounded-md text-left transition hover:bg-indigo-50/35";

export const panelNoticeTriggerBaseClass =
  "flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-left text-sm transition";

export const panelNoticeTriggerUrgentClass =
  "border-amber-200/90 bg-amber-50/50 hover:border-amber-300 hover:bg-amber-50";

export const panelNoticeTriggerDefaultClass =
  "border-indigo-100/85 bg-indigo-50/35 hover:border-indigo-200/75 hover:bg-indigo-50/55";

/** Pasek akcji w nagłówku panelu dziennego (wyszukiwarka + przyciski) */
export const panelToolbarShellClass =
  "flex w-full min-w-0 items-center rounded-md border border-indigo-100/75 bg-gradient-to-b from-indigo-50/35 via-white to-white p-2 shadow-sm";

export const panelToolbarRowClass =
  "flex w-full min-w-0 flex-col gap-2 md:flex-row md:items-center";

export const panelToolbarSearchWrapClass =
  "flex min-w-0 flex-1 items-center px-0.5 md:min-w-[12rem]";

export const panelToolbarSearchInputClass =
  "h-9 w-full rounded-md border border-indigo-100/80 bg-white px-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100/90";

export const panelToolbarActionsClass =
  "flex shrink-0 flex-wrap items-center justify-stretch gap-1.5 md:justify-end md:border-l md:border-indigo-100/75 md:pl-2.5";

export const panelToolbarTextButtonClass =
  "inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md border border-indigo-100/80 bg-white px-2.5 text-xs font-medium text-indigo-800/85 shadow-sm transition hover:border-indigo-200/80 hover:bg-indigo-50/45 hover:text-indigo-950";

export const panelToolbarIconButtonClass =
  "inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-md border border-indigo-100/80 bg-white text-indigo-800/85 shadow-sm transition hover:border-indigo-200/80 hover:bg-indigo-50/45 hover:text-indigo-950 disabled:cursor-not-allowed disabled:opacity-50";
