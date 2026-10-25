import { cn } from "@/lib/cn";

/**
 * Wspólna baza badge'y uwagi w wierszu ZK —
 * jedna wysokość, padding i ring, żeby „Do zamknięcia” / „Czeka na odbiór” / przypomnienie
 * wyglądały jak jedna rodzina chipów.
 */
export const zkWatchRowInlineBadgeClass = cn(
  "inline-flex shrink-0 items-center gap-1",
  "h-5 max-w-[14rem] rounded-md px-1.5",
  "text-[0.625rem] font-medium leading-none"
);

/** Mocniejszy chip (akcja / pilne). */
const zkWatchRowInlineBadgeEmphasisClass = "font-semibold";

export const zkWatchRegalInlineBadgeClass = cn(
  zkWatchRowInlineBadgeClass,
  "bg-violet-50/95 text-violet-800 ring-violet-200/75"
);

export const zkWatchRegalNewInlineBadgeClass = cn(
  zkWatchRowInlineBadgeClass,
  zkWatchRowInlineBadgeEmphasisClass,
  "bg-violet-100/95 text-violet-950 ring-violet-300/70"
);

export const zkWatchInformacjaInlineBadgeClass = cn(
  zkWatchRowInlineBadgeClass,
  "bg-sky-50/95 text-sky-800 ring-sky-200/75"
);

export const zkWatchNewLinesInlineBadgeClass = cn(
  zkWatchRowInlineBadgeClass,
  "bg-amber-50/90 text-amber-800 ring-amber-200/70"
);

export const zkWatchNewlyAddedInlineBadgeClass = cn(
  zkWatchRowInlineBadgeClass,
  "bg-indigo-50/95 text-indigo-800 ring-indigo-200/75"
);

export const zkWatchReadyToCloseInlineBadgeClass = cn(
  zkWatchRowInlineBadgeClass,
  zkWatchRowInlineBadgeEmphasisClass,
  "bg-emerald-50 text-emerald-900 ring-emerald-300/70"
);

export const zkWatchScopeOverflowInlineBadgeClass = cn(
  zkWatchRowInlineBadgeClass,
  "bg-slate-50/95 text-slate-600 ring-slate-200/80"
);

export const zkWatchFollowUpInlineBadgeClass = cn(
  zkWatchRowInlineBadgeClass,
  zkWatchRowInlineBadgeEmphasisClass,
  "bg-amber-50 text-amber-950 ring-amber-300/75"
);

/** @deprecated Używaj {@link zkWatchRowShellClassForAccent} — zachowane dla kompatybilności testów. */
export const zkWatchRegalNewRowRingClass = "ring-1 ring-inset ring-violet-300/70";

/** @deprecated */
export const zkWatchNewLinesRowRingClass = "ring-1 ring-inset ring-amber-300/70";

/** @deprecated */
export const zkWatchNewlyAddedRowRingClass = "ring-1 ring-inset ring-indigo-300/70";

/** @deprecated */
export const zkWatchInformacjaRowRingClass = "ring-1 ring-inset ring-sky-300/70";

/**
 * Wiersz z sygnałem uwagi: stan niesie tło wiersza i tag przy numerze ZK, bez paska z boku
 * (DESIGN.md → Shapes). Tła odpowiadają próbkom w `ZkWatchRowColorLegend`.
 */
const SIGNAL_ROW_BASE = "flex min-h-[2.625rem] transition-colors duration-150";

/** Obudowa wiersza gotowego do zamknięcia. */
export const zkWatchReadyToCloseRowShellClass = cn(SIGNAL_ROW_BASE, "bg-emerald-50/60 hover:bg-emerald-50");

/** Obudowa wiersza z towarem na regale (odczytany). */
export const zkWatchRegalWaitingRowShellClass = cn(SIGNAL_ROW_BASE, "bg-indigo-50/50 hover:bg-indigo-50");

/** Obudowa wiersza z nowym przybyciem na regale (nieodczytany). */
export const zkWatchRegalNewRowShellClass = cn(SIGNAL_ROW_BASE, "bg-indigo-50/80 hover:bg-indigo-50");

export type ZkWatchRowRailKind = "ready_to_close" | "regal_waiting" | "regal_new";

export type ZkWatchRowAccentKind =
  | "informacja"
  | "new_lines"
  | "newly_added"
  | "follow_up"
  | "scope_overflow";

/** Domyślny wiersz bez sygnału uwagi. */
export const zkWatchDefaultRowShellClass = cn(
  "flex min-h-[2.625rem] transition duration-150",
  "bg-white hover:bg-slate-50/55"
);

/** Wiersz w archiwum. */
export const zkWatchArchivedRowShellClass = cn(
  "flex min-h-[2.625rem] transition duration-150",
  "bg-slate-50/45 hover:bg-slate-50/65"
);


export const zkWatchInformacjaRowShellClass = cn(SIGNAL_ROW_BASE, "bg-slate-50/80 hover:bg-slate-50");

export const zkWatchNewLinesRowShellClass = cn(SIGNAL_ROW_BASE, "bg-amber-50/50 hover:bg-amber-50");

export const zkWatchNewlyAddedRowShellClass = cn(SIGNAL_ROW_BASE, "bg-indigo-50/50 hover:bg-indigo-50");

export const zkWatchFollowUpRowShellClass = cn(SIGNAL_ROW_BASE, "bg-amber-50/50 hover:bg-amber-50");

export const zkWatchScopeOverflowRowShellClass = cn(SIGNAL_ROW_BASE, "bg-white hover:bg-slate-50/70");

const ROW_SHELL_BY_RAIL: Record<ZkWatchRowRailKind, string> = {
  ready_to_close: zkWatchReadyToCloseRowShellClass,
  regal_waiting: zkWatchRegalWaitingRowShellClass,
  regal_new: zkWatchRegalNewRowShellClass,
};

const ROW_SHELL_BY_ACCENT: Record<ZkWatchRowAccentKind, string> = {
  informacja: zkWatchInformacjaRowShellClass,
  new_lines: zkWatchNewLinesRowShellClass,
  newly_added: zkWatchNewlyAddedRowShellClass,
  follow_up: zkWatchFollowUpRowShellClass,
  scope_overflow: zkWatchScopeOverflowRowShellClass,
};

export function zkWatchRowShellClassForRail(kind: ZkWatchRowRailKind): string {
  return ROW_SHELL_BY_RAIL[kind];
}

export function zkWatchRowShellClassForAccent(kind: ZkWatchRowAccentKind): string {
  return ROW_SHELL_BY_ACCENT[kind];
}

export function zkWatchRowShellClassForChrome(
  chrome: {
    railKind?: ZkWatchRowRailKind;
    accentKind?: ZkWatchRowAccentKind;
    isUrgent: boolean;
  },
  options?: { archived?: boolean }
): string {
  if (options?.archived) {
    return zkWatchArchivedRowShellClass;
  }

  if (chrome.railKind) {
    return zkWatchRowShellClassForRail(chrome.railKind);
  }
  if (chrome.accentKind) {
    return zkWatchRowShellClassForAccent(chrome.accentKind);
  }
  return zkWatchDefaultRowShellClass;
}

/** Delikatniejszy separator akcji na mobile, gdy wiersz ma kolorową obudowę. */
export const zkWatchRowActionsMobileDividerClass =
  "border-slate-200/55 pt-2 sm:border-0 sm:pt-0";

/** @deprecated Używaj {@link zkWatchReadyToCloseRowShellClass} — zachowane dla testów / kompatybilności. */
export const zkWatchReadyToCloseRowRingClass = "ring-1 ring-inset ring-emerald-200/50";

/** Prośba w pełni pokryta — status informacyjny (nie sukces / nie CTA). */
export const zkWatchProsbaSettledStatusClass =
  "bg-slate-100 text-slate-700 ring-slate-200/80 normal-case tracking-normal font-medium";

const ATTENTION_BADGE_CLASS = {
  regal_new: zkWatchRegalNewInlineBadgeClass,
  follow_up_due: zkWatchFollowUpInlineBadgeClass,
  regal_waiting: zkWatchRegalInlineBadgeClass,
  informacja_ready: zkWatchInformacjaInlineBadgeClass,
  new_lines: zkWatchNewLinesInlineBadgeClass,
  newly_added: zkWatchNewlyAddedInlineBadgeClass,
  ready_to_close: zkWatchReadyToCloseInlineBadgeClass,
  scope_overflow: zkWatchScopeOverflowInlineBadgeClass,
} as const;

export function zkWatchRowAttentionBadgeClass(
  kind: keyof typeof ATTENTION_BADGE_CLASS
): string {
  return ATTENTION_BADGE_CLASS[kind];
}
