/** Kotwice sekcji zakładki Dziś — wspólne dla nawigacji i scrolla. */
export const DAILY_PANEL_QUEUE_SECTION = {
  overdue: "kolejka-zalegle",
  stockOut: "kolejka-brak-na-stanie",
  prosby: "kolejka-prosby",
  today: "kolejka-harmonogram-dzis",
} as const;

export type DailyPanelQueueSectionKey = keyof typeof DAILY_PANEL_QUEUE_SECTION;

export function dailyPanelSectionHref(key: DailyPanelQueueSectionKey): string {
  return `#${DAILY_PANEL_QUEUE_SECTION[key]}`;
}

export function scrollToDailyPanelSection(key: DailyPanelQueueSectionKey): void {
  const id = DAILY_PANEL_QUEUE_SECTION[key];
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

/** Margines scrolla pod sticky chrome na zakładce Dziś (pełny pasek statusu). */
export const dailyPanelQueueSectionScrollClass = "scroll-mt-40 sm:scroll-mt-32";

/** Margines gdy sticky to tylko zakładki + sync (Tydzień / Wyjątki). */
export const dailyPanelTabScrollClass = "scroll-mt-28 sm:scroll-mt-24";

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
