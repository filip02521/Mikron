import {
  buildProcurementSupplierBlocks,
  type ProcurementSupplierBlock,
} from "@/lib/orders/procurement-supplier-groups";

/**
 * Tory (Do zamówienia, Urlop, …) startują zwinięte.
 * Zwinięty tor pokazuje tylko nieprzeczytane z serwera (`hasUnseen`);
 * lokalne „widziane” (badge) nie usuwa karty z peeka — dopiero odświeżenie danych.
 * Rozwinięcie toru — wszystkie prośby.
 */

export type ProcurementLaneChromeMode = "expanded" | "peek" | "closed";

export type ProcurementLaneChrome = {
  /** Użytkownik rozwinął pełną listę toru. */
  laneExpanded: boolean;
  /** Treść w DOM / animacja otwarta. */
  bodyOpen: boolean;
  /** Zwinięty chrome (chevron zamknięty, aria-expanded=false). */
  chromeCollapsed: boolean;
  mode: ProcurementLaneChromeMode;
  totalGroupCount: number;
  peekGroupCount: number;
  /** Etykieta licznika: `3` albo `1/5` w częściowym peeku. */
  countLabel: string;
  subtitle: string | null;
};

export function isProcurementLaneExpanded(
  laneId: string,
  expandedLaneIds: ReadonlySet<string>
): boolean {
  return expandedLaneIds.has(laneId);
}

/**
 * Podgląd zwiniętego toru: sygnał serwera `hasUnseen`, nie lokalny tracker badge.
 * Dzięki temu najechanie (zniknięcie „Nowa”) nie chowa karty w trakcie obsługi.
 */
export function isProcurementLanePeekGroup(group: {
  hasUnseen: boolean;
}): boolean {
  return group.hasUnseen;
}

/** Grupy widoczne w torze: wszystkie albo tylko nieprzeczytane (serwer). */
export function filterProcurementGroupsForLaneDisplay<
  T extends { hasUnseen: boolean },
>(groups: readonly T[], laneExpanded: boolean): T[] {
  if (laneExpanded) return [...groups];
  return groups.filter((g) => isProcurementLanePeekGroup(g));
}

/** Bloki dostawców pod widok toru (peek vs pełny). */
export function procurementLaneDisplayBlocks(
  blocks: readonly ProcurementSupplierBlock[],
  laneExpanded: boolean,
  flagSortById: Map<string, number> | Record<string, number> = {}
): ProcurementSupplierBlock[] {
  if (laneExpanded) return [...blocks];
  const peekGroups = blocks
    .flatMap((b) => b.requestGroups)
    .filter((g) => isProcurementLanePeekGroup(g));
  if (peekGroups.length === 0) return [];
  return buildProcurementSupplierBlocks(peekGroups, flagSortById);
}

export function countProcurementBlockGroups(
  blocks: readonly ProcurementSupplierBlock[]
): number {
  return blocks.reduce((n, b) => n + b.requestGroups.length, 0);
}

export function procurementLaneCountLabel(input: {
  laneExpanded: boolean;
  totalGroupCount: number;
  peekGroupCount: number;
}): string {
  const { laneExpanded, totalGroupCount, peekGroupCount } = input;
  if (
    !laneExpanded &&
    peekGroupCount > 0 &&
    peekGroupCount < totalGroupCount
  ) {
    return `${peekGroupCount}/${totalGroupCount}`;
  }
  return String(totalGroupCount);
}

/**
 * Podpowiedź pod etykietą zwiniętego toru.
 * expanded → null (użyj zwykłego hintu toru).
 */
export function procurementLaneCollapsedSubtitle(input: {
  laneExpanded: boolean;
  totalGroupCount: number;
  peekGroupCount: number;
  peekHint: string;
  allNewHint: string;
  emptyCollapsedHint: string;
}): string | null {
  if (input.laneExpanded) return null;
  if (input.totalGroupCount <= 0) return null;
  if (input.peekGroupCount <= 0) return input.emptyCollapsedHint;
  if (input.peekGroupCount >= input.totalGroupCount) return input.allNewHint;
  return input.peekHint;
}

/** Jedno źródło prawdy dla chrome toru (UI + a11y). */
export function resolveProcurementLaneChrome(input: {
  laneExpanded: boolean;
  totalGroupCount: number;
  peekGroupCount: number;
  peekHint: string;
  allNewHint: string;
  emptyCollapsedHint: string;
}): ProcurementLaneChrome {
  const {
    laneExpanded,
    totalGroupCount,
    peekGroupCount,
    peekHint,
    allNewHint,
    emptyCollapsedHint,
  } = input;

  const bodyOpen = laneExpanded || peekGroupCount > 0;
  const chromeCollapsed = !laneExpanded;
  const mode: ProcurementLaneChromeMode = laneExpanded
    ? "expanded"
    : peekGroupCount > 0
      ? "peek"
      : "closed";

  return {
    laneExpanded,
    bodyOpen,
    chromeCollapsed,
    mode,
    totalGroupCount,
    peekGroupCount,
    countLabel: procurementLaneCountLabel({
      laneExpanded,
      totalGroupCount,
      peekGroupCount,
    }),
    subtitle: procurementLaneCollapsedSubtitle({
      laneExpanded,
      totalGroupCount,
      peekGroupCount,
      peekHint,
      allNewHint,
      emptyCollapsedHint,
    }),
  };
}

/** Czy „Zamów razem” w peeku obejmuje tylko część osób u dostawcy w tym torze. */
export function isProcurementLanePeekPartialSupplier(input: {
  laneExpanded: boolean;
  fullBlock: ProcurementSupplierBlock | undefined;
  displayBlock: ProcurementSupplierBlock;
}): boolean {
  if (input.laneExpanded) return false;
  const full = input.fullBlock;
  if (!full) return false;
  return full.requestGroups.length > input.displayBlock.requestGroups.length;
}
