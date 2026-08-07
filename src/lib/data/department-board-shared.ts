/** Typy i hrefy tablicy działu — bezpieczne dla klienta (bez Supabase). */

import { salesMojeAnnouncementHref } from "@/lib/department-board/moje-announcements-ui";
import type {
  DepartmentBoardPost,
  DepartmentBoardThread,
  UserRole,
} from "@/types/database";

export type DepartmentBoardAuthor = {
  email: string | null;
  role: UserRole | null;
  sales_person?: { id: string; name: string } | null;
};

export type DepartmentBoardThreadRow = DepartmentBoardThread & {
  author?: DepartmentBoardAuthor | null;
  sales_person?: { id: string; name: string } | null;
  closed_by_profile?: DepartmentBoardAuthor | null;
};

export type DepartmentBoardPostRow = DepartmentBoardPost & {
  author?: DepartmentBoardAuthor | null;
};

export type DepartmentBoardQuestion = DepartmentBoardThreadRow & {
  posts: DepartmentBoardPostRow[];
};

export type DepartmentBoardData = {
  announcements: DepartmentBoardThreadRow[];
  questions: DepartmentBoardQuestion[];
  closedQuestions: DepartmentBoardQuestion[];
  readAnnouncementIds: string[];
};

export type DepartmentBoardQuestionsSlice = {
  questions: DepartmentBoardQuestion[];
  closedQuestions: DepartmentBoardQuestion[];
};

export type DepartmentBoardAnnouncementsSlice = {
  announcements: DepartmentBoardThreadRow[];
  readAnnouncementIds: string[];
};

export type SalesBoardAttentionSnapshot = {
  /** Wszystkie nieprzeczytane ogłoszenia. */
  unreadAnnouncementCount: number;
  unreadAnnouncementLatestTitle: string | null;
  /** Nieprzeczytane poza przypiętymi (banner na /moje — bez duplikatu z paskiem). */
  unreadAnnouncementBannerCount: number;
  unreadAnnouncementBannerLatestTitle: string | null;
  unreadAnnouncementBannerLatestId: string | null;
  /** Wszystkie nieprzeczytane odpowiedzi (własne + cudze) — lista/baner na Tablicy. */
  unseenAnswerCount: number;
  /** Nieprzeczytane odpowiedzi na własne pytania handlowca. */
  unseenOwnAnswerCount: number;
  /**
   * Najnowsza aktywność (ISO) wśród nieprzeczytanych odpowiedzi na własne pytania.
   * Używane do dźwięku przy kolejnej odpowiedzi w tym samym wątku (gdy licznik się nie zmienia).
   */
  latestOwnAnswerActivityAt: string | null;
  unseenAnswerPreview: {
    threadId: string;
    title: string;
    isOwnQuestion: boolean;
  } | null;
  unseenQuestionIds: string[];
  /** Nieprzeczytane odpowiedzi wyłącznie na własne pytania handlowca. */
  unseenOwnQuestionIds: string[];
  pinnedAnnouncements: DepartmentBoardThreadRow[];
  /** Badge /moje i /tablica: tylko własne pytania z nową odpowiedzią. */
  navBadgeCount: number;
};

export function salesBoardAnnouncementHref(threadId: string): string {
  return salesMojeAnnouncementHref(threadId);
}

/** Deep-link do pytania handlowca na /tablica. */
export function salesBoardQuestionHref(threadId: string): string {
  return `/tablica?watek=${encodeURIComponent(threadId.trim())}`;
}

export function procurementBoardAnnouncementHref(threadId: string): string {
  return `/zakupy/tablica?widok=ogloszenia&watek=${encodeURIComponent(threadId)}`;
}

export function procurementBoardQuestionHref(threadId: string): string {
  return `/zakupy/tablica?widok=pytania&watek=${encodeURIComponent(threadId)}`;
}

export function procurementBoardQuestionsListHref(): string {
  return "/zakupy/tablica?widok=pytania";
}
