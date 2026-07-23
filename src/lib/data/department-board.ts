import { createAdminClient } from "@/lib/supabase/admin";
import {
  isBoardAnswerUnseen,
  countUnseenOwnBoardAnswers,
  latestQuestionActivityAt,
  pickUnseenAnswerPreview,
  type UnseenBoardAnswer,
} from "@/lib/department-board/attention";
import { sortAnnouncements, sortClosedQuestions, sortQuestions } from "@/lib/department-board/sort";
import { salesMojeAnnouncementHref } from "@/lib/department-board/moje-announcements-ui";
import type {
  DepartmentBoardPost,
  DepartmentBoardThread,
  UserRole,
} from "@/types/database";

export const DEPARTMENT_BOARD_THREAD_SELECT =
  "id, kind, status, created_by, sales_person_id, title, body, product_symbol, product_name, subiekt_tw_id, mikran_code, color, pinned, published_at, expires_at, answered_at, archived_at, closed_by, created_at, updated_at, author:profiles!created_by(email, role), sales_person:sales_people(id, name), closed_by_profile:profiles!closed_by(email, role)";

export const DEPARTMENT_BOARD_POST_SELECT =
  "*, author:profiles!created_by(email, role)";

export type DepartmentBoardAuthor = {
  email: string | null;
  role: UserRole | null;
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

function isAnnouncementActive(row: DepartmentBoardThread): boolean {
  if (row.archived_at) return false;
  if (!row.expires_at) return true;
  return new Date(row.expires_at).getTime() > Date.now();
}

/** Filtr ważności ogłoszeń — wartość ISO w cudzysłowie (PostgREST). */
export function activeAnnouncementExpiryOr(nowIso: string): string {
  return `expires_at.is.null,expires_at.gt."${nowIso}"`;
}

export type DepartmentBoardQuestionsSlice = {
  questions: DepartmentBoardQuestion[];
  closedQuestions: DepartmentBoardQuestion[];
};

export type DepartmentBoardAnnouncementsSlice = {
  announcements: DepartmentBoardThreadRow[];
  readAnnouncementIds: string[];
};

export async function fetchDepartmentBoardThreadKind(
  threadId: string
): Promise<DepartmentBoardThread["kind"] | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("department_board_threads")
    .select("kind")
    .eq("id", threadId)
    .maybeSingle();

  if (error || !data?.kind) return null;
  return data.kind;
}

/** Zamyka wątki pytań bez aktywności przez 2 dni, jeśli zakupy choć raz odpisały. */
async function autoCloseStaleBoardQuestions(): Promise<void> {
  const supabase = createAdminClient();
  const cutoff = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
  const now = new Date().toISOString();

  await supabase
    .from("department_board_threads")
    .update({
      archived_at: now,
      closed_by: null,
      status: "archived",
      updated_at: now,
    })
    .eq("kind", "question")
    .is("archived_at", null)
    .not("answered_at", "is", null)
    .lt("updated_at", cutoff);
}

/** Tylko pytania — dla /tablica handlowca (bez ogłoszeń). */
export async function fetchDepartmentBoardQuestions(): Promise<DepartmentBoardQuestionsSlice> {
  const supabase = createAdminClient();

  await autoCloseStaleBoardQuestions();

  const [activeRes, closedRes] = await Promise.all([
    supabase
      .from("department_board_threads")
      .select(DEPARTMENT_BOARD_THREAD_SELECT)
      .eq("kind", "question")
      .is("archived_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("department_board_threads")
      .select(DEPARTMENT_BOARD_THREAD_SELECT)
      .eq("kind", "question")
      .not("archived_at", "is", null)
      .order("archived_at", { ascending: false }),
  ]);

  if (activeRes.error) throw new Error(activeRes.error.message);
  if (closedRes.error) throw new Error(closedRes.error.message);

  const activeRows = (activeRes.data ?? []) as unknown as DepartmentBoardThreadRow[];
  const closedRows = (closedRes.data ?? []) as unknown as DepartmentBoardThreadRow[];
  const allRows = [...activeRows, ...closedRows];
  const allIds = allRows.map((q) => q.id);

  let posts: DepartmentBoardPostRow[] = [];
  if (allIds.length) {
    const postsRes = await supabase
      .from("department_board_posts")
      .select(DEPARTMENT_BOARD_POST_SELECT)
      .in("thread_id", allIds)
      .order("created_at", { ascending: true });
    if (postsRes.error) throw new Error(postsRes.error.message);
    posts = (postsRes.data ?? []) as unknown as DepartmentBoardPostRow[];
  }

  const postsByThread = new Map<string, DepartmentBoardPostRow[]>();
  for (const post of posts) {
    const list = postsByThread.get(post.thread_id) ?? [];
    list.push(post);
    postsByThread.set(post.thread_id, list);
  }

  const buildQuestions = (rows: DepartmentBoardThreadRow[]) =>
    sortQuestions(
      rows.map((row) => ({
        ...row,
        posts: postsByThread.get(row.id) ?? [],
      }))
    );

  return {
    questions: buildQuestions(activeRows),
    closedQuestions: sortClosedQuestions(
      closedRows.map((row) => ({
        ...row,
        posts: postsByThread.get(row.id) ?? [],
      }))
    ),
  };
}

/** Tylko ogłoszenia — dla sekcji na /moje (bez pytań). */
export async function fetchDepartmentBoardAnnouncements(
  profileId: string | null
): Promise<DepartmentBoardAnnouncementsSlice> {
  const supabase = createAdminClient();
  const nowIso = new Date().toISOString();

  const announcementsRes = await supabase
    .from("department_board_threads")
    .select(DEPARTMENT_BOARD_THREAD_SELECT)
    .eq("kind", "announcement")
    .is("archived_at", null)
    .or(activeAnnouncementExpiryOr(nowIso));

  if (announcementsRes.error) throw new Error(announcementsRes.error.message);

  const announcements = sortAnnouncements(
    (announcementsRes.data ?? []).filter(isAnnouncementActive) as unknown as DepartmentBoardThreadRow[]
  );

  let readAnnouncementIds: string[] = [];
  if (profileId && announcements.length) {
    const readsRes = await supabase
      .from("department_board_reads")
      .select("thread_id")
      .eq("profile_id", profileId)
      .in(
        "thread_id",
        announcements.map((a) => a.id)
      );
    if (readsRes.error) throw new Error(readsRes.error.message);
    readAnnouncementIds = (readsRes.data ?? []).map((r) => r.thread_id);
  }

  return { announcements, readAnnouncementIds };
}

/** Pełna tablica — zakupy (ogłoszenia + pytania). */
export async function fetchDepartmentBoard(
  profileId: string | null
): Promise<DepartmentBoardData> {
  const [announcementsSlice, questionsSlice] = await Promise.all([
    fetchDepartmentBoardAnnouncements(profileId),
    fetchDepartmentBoardQuestions(),
  ]);

  return {
    announcements: announcementsSlice.announcements,
    readAnnouncementIds: announcementsSlice.readAnnouncementIds,
    questions: questionsSlice.questions,
    closedQuestions: questionsSlice.closedQuestions,
  };
}

/** Zakupy/admin: pytania bez odpowiedzi. */
export async function countOpenDepartmentBoardQuestions(): Promise<number> {
  const supabase = createAdminClient();
  const { count, error } = await supabase
    .from("department_board_threads")
    .select("id", { count: "exact", head: true })
    .eq("kind", "question")
    .eq("status", "open")
    .is("archived_at", null);

  if (error) return 0;
  return count ?? 0;
}

export function salesBoardAnnouncementHref(threadId: string): string {
  return salesMojeAnnouncementHref(threadId);
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

/** Przypięte, aktywne ogłoszenia — wspólne dla handlowców i panelu zakupów. */
export async function fetchPinnedActiveAnnouncements(): Promise<
  Pick<DepartmentBoardThreadRow, "id" | "title" | "body">[]
> {
  const supabase = createAdminClient();
  const { data, error } = await activeAnnouncementsQuery(supabase);
  if (error) return [];

  return sortAnnouncements(
    ((data ?? []) as unknown as DepartmentBoardThreadRow[]).filter(isAnnouncementActive)
  )
    .filter((row) => row.pinned)
    .map((row) => ({ id: row.id, title: row.title, body: row.body }));
}

export async function countActiveDepartmentBoardAnnouncements(): Promise<number> {
  const supabase = createAdminClient();
  const nowIso = new Date().toISOString();
  const { count, error } = await supabase
    .from("department_board_threads")
    .select("id", { count: "exact", head: true })
    .eq("kind", "announcement")
    .is("archived_at", null)
    .or(activeAnnouncementExpiryOr(nowIso));

  if (error) return 0;
  return count ?? 0;
}

export type SalesBoardAttentionSnapshot = {
  /** Wszystkie nieprzeczytane — badge w menu. */
  unreadAnnouncementCount: number;
  unreadAnnouncementLatestTitle: string | null;
  /** Nieprzeczytane poza przypiętymi (banner na /moje — bez duplikatu z paskiem). */
  unreadAnnouncementBannerCount: number;
  unreadAnnouncementBannerLatestTitle: string | null;
  unreadAnnouncementBannerLatestId: string | null;
  unseenAnswerCount: number;
  /** Nieprzeczytane odpowiedzi na własne pytania handlowca. */
  unseenOwnAnswerCount: number;
  unseenAnswerPreview: {
    threadId: string;
    title: string;
    isOwnQuestion: boolean;
  } | null;
  unseenQuestionIds: string[];
  /** Nieprzeczytane odpowiedzi wyłącznie na własne pytania handlowca. */
  unseenOwnQuestionIds: string[];
  pinnedAnnouncements: DepartmentBoardThreadRow[];
  /** Badge /moje: tylko nieprzeczytane odpowiedzi na własne pytania (bez ogłoszeń i cudzych wątków). */
  navBadgeCount: number;
};

async function activeAnnouncementsQuery(supabase: ReturnType<typeof createAdminClient>) {
  const nowIso = new Date().toISOString();
  return supabase
    .from("department_board_threads")
    .select(DEPARTMENT_BOARD_THREAD_SELECT)
    .eq("kind", "announcement")
    .is("archived_at", null)
    .or(activeAnnouncementExpiryOr(nowIso));
}

/** Podgląd uwagi handlowca: ogłoszenia, odpowiedzi, przypięte. */
export async function fetchSalesBoardAttentionSnapshot(
  profileId: string
): Promise<SalesBoardAttentionSnapshot> {
  const supabase = createAdminClient();

  const [announcementsRes, questionsRes] = await Promise.all([
    activeAnnouncementsQuery(supabase),
    supabase
      .from("department_board_threads")
      .select("id, title, created_by, answered_at, status")
      .eq("kind", "question")
      .eq("status", "answered")
      .is("archived_at", null),
  ]);

  const announcements = sortAnnouncements(
    ((announcementsRes.data ?? []) as unknown as DepartmentBoardThreadRow[]).filter(isAnnouncementActive)
  );

  let unreadAnnouncementCount = 0;
  let unreadAnnouncementLatestTitle: string | null = null;
  let unreadAnnouncementBannerCount = 0;
  let unreadAnnouncementBannerLatestTitle: string | null = null;
  let unreadAnnouncementBannerLatestId: string | null = null;

  const pinnedAnnouncements = announcements.filter((a) => a.pinned);
  const pinnedIds = new Set(pinnedAnnouncements.map((a) => a.id));

  if (announcements.length) {
    const annIds = announcements.map((a) => a.id);
    const { data: reads } = await supabase
      .from("department_board_reads")
      .select("thread_id")
      .eq("profile_id", profileId)
      .in("thread_id", annIds);
    const readSet = new Set((reads ?? []).map((r) => r.thread_id));
    const unread = announcements.filter((a) => !readSet.has(a.id));
    const unreadNotPinned = unread.filter((a) => !pinnedIds.has(a.id));
    unreadAnnouncementCount = unread.length;
    unreadAnnouncementLatestTitle = unread[0]?.title ?? null;
    unreadAnnouncementBannerCount = unreadNotPinned.length;
    unreadAnnouncementBannerLatestTitle = unreadNotPinned[0]?.title ?? null;
    unreadAnnouncementBannerLatestId = unreadNotPinned[0]?.id ?? null;
  }

  const questionRows = questionsRes.data ?? [];
  const questionIds = questionRows.map((q) => q.id);

  const unseenAnswerItems: UnseenBoardAnswer[] = [];

  if (questionIds.length) {
    const { data: posts } = await supabase
      .from("department_board_posts")
      .select("thread_id, created_at")
      .in("thread_id", questionIds);

    const postsByThread = new Map<string, string[]>();
    for (const post of posts ?? []) {
      const list = postsByThread.get(post.thread_id) ?? [];
      list.push(post.created_at);
      postsByThread.set(post.thread_id, list);
    }

    const { data: reads } = await supabase
      .from("department_board_reads")
      .select("thread_id, read_at")
      .eq("profile_id", profileId)
      .in("thread_id", questionIds);

    const readMap = new Map((reads ?? []).map((r) => [r.thread_id, r.read_at]));

    for (const q of questionRows) {
      const latestActivityAt = latestQuestionActivityAt(
        q.answered_at,
        postsByThread.get(q.id) ?? []
      );
      if (!isBoardAnswerUnseen(readMap.get(q.id), latestActivityAt)) continue;
      unseenAnswerItems.push({
        threadId: q.id,
        title: q.title,
        isOwnQuestion: q.created_by === profileId,
        latestActivityAt: latestActivityAt!,
      });
    }

    unseenAnswerItems.sort((a, b) => b.latestActivityAt.localeCompare(a.latestActivityAt));
  }

  const preview = pickUnseenAnswerPreview(unseenAnswerItems);
  const unseenOwnAnswerCount = countUnseenOwnBoardAnswers(unseenAnswerItems);
  const unseenOwnQuestionIds = unseenAnswerItems
    .filter((item) => item.isOwnQuestion)
    .map((item) => item.threadId);

  return {
    unreadAnnouncementCount,
    unreadAnnouncementLatestTitle,
    unreadAnnouncementBannerCount,
    unreadAnnouncementBannerLatestTitle,
    unreadAnnouncementBannerLatestId,
    unseenAnswerCount: unseenAnswerItems.length,
    unseenOwnAnswerCount,
    unseenAnswerPreview: preview
      ? {
          threadId: preview.threadId,
          title: preview.title,
          isOwnQuestion: preview.isOwnQuestion,
        }
      : null,
    unseenQuestionIds: unseenAnswerItems.map((i) => i.threadId),
    unseenOwnQuestionIds,
    pinnedAnnouncements,
    navBadgeCount: unseenOwnAnswerCount,
  };
}

/** Badge na /tablica — tylko nowe odpowiedzi (ogłoszenia są na /moje). */
export async function countSalesTablicaNavBadge(profileId: string): Promise<number> {
  const snapshot = await fetchSalesBoardAttentionSnapshot(profileId);
  return snapshot.unseenAnswerCount;
}
