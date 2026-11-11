/** Kotwice sekcji zakładki Dziś — wspólne dla nawigacji i scrolla. */
export const DAILY_PANEL_QUEUE_SECTION = {
  // Grupy listy „Dostawcy na dziś” (jeden wiersz na dostawcę) — zob. dailySupplierGroupAnchor.
  send: "kolejka-dostawcy-send",
  order: "kolejka-dostawcy-order",
  early: "kolejka-dostawcy-early",
  shift: "kolejka-dostawcy-shift",
  manual: "kolejka-dostawcy-manual",
  stockOut: "kolejka-brak-na-stanie",
  prosby: "kolejka-prosby",
} as const;

/** Prefiks kotwic torów próśb / braków (pełne id buduje procurementLaneAnchorId). */
export const DAILY_PANEL_LANE_ANCHOR_PREFIX = {
  prosby: "prosby-tor",
  stockOut: "brak-tor",
} as const;

/** Kotwice sekcji zakładki Tydzień. */
export const DAILY_PANEL_WEEK_SECTION = {
  onDemand: "plan-na-zadanie",
  thisWeek: "plan-ten-tydzien",
  nextWeek: "plan-nastepny-tydzien",
} as const;

export type DailyPanelQueueSectionKey = keyof typeof DAILY_PANEL_QUEUE_SECTION;

export function dailyPanelSectionHref(key: DailyPanelQueueSectionKey): string {
  return `#${DAILY_PANEL_QUEUE_SECTION[key]}`;
}

export function scrollToDailyPanelSection(key: DailyPanelQueueSectionKey): void {
  const id = DAILY_PANEL_QUEUE_SECTION[key];
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

/** Margines scrolla pod sticky wyszukiwaniem dostawcy (kompaktowy pasek narzędzi). */
export const dailyPanelQueueSectionScrollClass = "scroll-mt-24 sm:scroll-mt-20";

/** Margines kotwic Tydzień / Wyjątki — ten sam sticky search. */
export const dailyPanelTabScrollClass = "scroll-mt-24 sm:scroll-mt-20";

/** Etykieta czasu od ostatniej synchronizacji (poll lub odświeżenie). */
export function formatDailyPanelSyncLabel(
  lastSyncedAt: number | null,
  lastPollAt: number | null,
  now: number = Date.now()
): string {
  const ref = Math.max(lastSyncedAt ?? 0, lastPollAt ?? 0) || null;
  if (!ref) return "łączenie…";

  const seconds = Math.floor((now - ref) / 1000);
  if (seconds < 15) return "sprawdzono przed chwilą";
  if (seconds < 60) return `sprawdzono ${seconds} s temu`;

  const minutes = Math.floor(seconds / 60);
  if (minutes === 1) return "sprawdzono 1 min temu";
  if (minutes < 60) return `sprawdzono ${minutes} min temu`;

  return "sprawdzono ponad godzinę temu";
}

/** Lista „Dostawcy na dziś” (jeden wiersz na dostawcę) i kotwice jej grup. */
export const DAILY_SUPPLIER_LIST_ANCHOR = "kolejka-dostawcy";

/** Kotwica grupy listy — te same id co kroki kolejki (`DAILY_PANEL_QUEUE_SECTION`); grupy spoza kolejki („done”) wg wzoru. */
export function dailySupplierGroupAnchor(group: string): string {
  return group in DAILY_PANEL_QUEUE_SECTION
    ? DAILY_PANEL_QUEUE_SECTION[group as DailyPanelQueueSectionKey]
    : `${DAILY_SUPPLIER_LIST_ANCHOR}-${group}`;
}
