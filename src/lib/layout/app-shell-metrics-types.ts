import type { SalesBoardAttentionSnapshot } from "@/lib/data/department-board";

export type AppShellNavBadges = {
  nowe: number;
  weryfikacja: number;
  realizacja: number;
  salesMoje?: number;
  salesZkDue?: number;
  salesNotesDue?: number;
  salesTablica?: number;
  operationsNotatki?: number;
  departmentBoardQuestions?: number;
  adminBugReports?: number;
};

export type AppShellMetrics = {
  navBadges: AppShellNavBadges;
  salesActivityVersion: string | null;
  operationsDailyPanelVersion: string | null;
  salesPersonName: string | null;
  userAssignmentLabel: string | null;
  salesBoardAttention: SalesBoardAttentionSnapshot | null;
  operationsPinnedAnnouncements: Pick<
    SalesBoardAttentionSnapshot["pinnedAnnouncements"][number],
    "id" | "title" | "body"
  >[];
  /** Metryki z SSR załadowane — przed tym liczniki dźwięku tablicy nie są wiarygodne. */
  ready: boolean;
};

export const EMPTY_APP_SHELL_METRICS: AppShellMetrics = {
  navBadges: { nowe: 0, weryfikacja: 0, realizacja: 0 },
  salesActivityVersion: null,
  operationsDailyPanelVersion: null,
  salesPersonName: null,
  userAssignmentLabel: null,
  salesBoardAttention: null,
  operationsPinnedAnnouncements: [],
  ready: false,
};
