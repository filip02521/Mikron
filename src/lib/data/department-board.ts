import { createAdminClient } from "@/lib/supabase/admin";
import {
  isBoardAnswerUnseen,
  latestQuestionActivityAt,
  pickUnseenAnswerPreview,
  type UnseenBoardAnswer,
} from "@/lib/department-board/attention";
import { sortAnnouncements, sortQuestions } from "@/lib/department-board/sort";
import type {
  DepartmentBoardPost,
  DepartmentBoardThread,
  UserRole,
} from "@/types/database";

export const DEPARTMENT_BOARD_THREAD_SELECT =
  "*, author:profiles!created_by(email, role), sales_person:sales_people(id, name)";

export const DEPARTMENT_BOARD_POST_SELECT =
  "*, author:profiles!created_by(email, role)";

export type DepartmentBoardAuthor = {
  email: string | null;
  role: UserRole | null;
};

export type DepartmentBoardThreadRow = DepartmentBoardThread & {
  author?: DepartmentBoardAuthor | null;
  sales_person?: { id: string; name: string } | null;
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
  readAnnouncementIds: string[];
};

function isAnnouncementActive(row: DepartmentBoardThread): boolean {
  if (row.archived_at) return false;
  if (!row.expires_at) return true;
  return new Date(row.expires_at).getTime() > Date.now();
}

export async function fetchDepartmentBoard(
  profileId: string | null
): Promise<DepartmentBoardData> {
  const supabase = createAdminClient();
  const nowIso = new Date().toISOString();

  const [announcementsRes, questionsRes] = await Promise.all([
    supabase
      .from("department_board_threads")
      .select(DEPARTMENT_BOARD_THREAD_SELECT)
      .eq("kind", "announcement")
      .is("archived_at", null)
      .or(`expires_at.is.null,expires_at.gt.${nowIso}`),
    supabase
      .from("department_board_threads")
      .select(DEPARTMENT_BOARD_THREAD_SELECT)
      .eq("kind", "question")
      .is("archived_at", null)
      .order("created_at", { ascending: false }),
  ]);

  if (announcementsRes.error) throw new Error(announcementsRes.error.message);
  if (questionsRes.error) throw new Error(questionsRes.error.message);

  const announcements = sortAnnouncements(
    (announcementsRes.data ?? []).filter(isAnnouncementActive) as DepartmentBoardThreadRow[]
  );

  const questionRows = (questionsRes.data ?? []) as DepartmentBoardThreadRow[];
  const questionIds = questionRows.map((q) => q.id);

  let posts: DepartmentBoardPostRow[] = [];
  if (questionIds.length) {
    const postsRes = await supabase
      .from("department_board_posts")
      .select(DEPARTMENT_BOARD_POST_SELECT)
      .in("thread_id", questionIds)
      .order("created_at", { ascending: true });
    if (postsRes.error) throw new Error(postsRes.error.message);
    posts = (postsRes.data ?? []) as DepartmentBoardPostRow[];
  }

  const postsByThread = new Map<string, DepartmentBoardPostRow[]>();
  for (const post of posts) {
    const list = postsByThread.get(post.thread_id) ?? [];
    list.push(post);
    postsByThread.set(post.thread_id, list);
  }

  const questions: DepartmentBoardQuestion[] = sortQuestions(
    questionRows.map((row) => ({
      ...row,
      posts: postsByThread.get(row.id) ?? [],
    }))
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

  return { announcements, questions, readAnnouncementIds };
}

/** Handlowiec: nieprzeczytane aktywne ogłoszenia. */
export async function countUnreadAnnouncementsForProfile(
  profileId: string
): Promise<number> {
  const supabase = createAdminClient();
  const nowIso = new Date().toISOString();

  const { data: announcements, error: annError } = await supabase
    .from("department_board_threads")
    .select("id")
    .eq("kind", "announcement")
    .is("archived_at", null)
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`);

  if (annError || !announcements?.length) return 0;

  const ids = announcements.map((a) => a.id);
  const { data: reads, error: readError } = await supabase
    .from("department_board_reads")
    .select("thread_id")
    .eq("profile_id", profileId)
    .in("thread_id", ids);

  if (readError) return 0;

  const readSet = new Set((reads ?? []).map((r) => r.thread_id));
  return ids.filter((id) => !readSet.has(id)).length;
}

/** Najnowsze nieprzeczytane ogłoszenie (tytuł do bannera na /moje). */
export async function fetchUnreadAnnouncementsPreview(profileId: string): Promise<{
  count: number;
  latestTitle: string | null;
}> {
  const supabase = createAdminClient();
  const nowIso = new Date().toISOString();

  const { data: announcements, error: annError } = await supabase
    .from("department_board_threads")
    .select("id, title, published_at")
    .eq("kind", "announcement")
    .is("archived_at", null)
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
    .order("published_at", { ascending: false });

  if (annError || !announcements?.length) {
    return { count: 0, latestTitle: null };
  }

  const ids = announcements.map((a) => a.id);
  const { data: reads, error: readError } = await supabase
    .from("department_board_reads")
    .select("thread_id")
    .eq("profile_id", profileId)
    .in("thread_id", ids);

  if (readError) return { count: 0, latestTitle: null };

  const readSet = new Set((reads ?? []).map((r) => r.thread_id));
  const unread = announcements.filter((a) => !readSet.has(a.id));
  return {
    count: unread.length,
    latestTitle: unread[0]?.title ?? null,
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
  return `/tablica?widok=ogloszenia&watek=${encodeURIComponent(threadId)}`;
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
  unseenAnswerPreview: {
    threadId: string;
    title: string;
    isOwnQuestion: boolean;
  } | null;
  unseenQuestionIds: string[];
  pinnedAnnouncements: DepartmentBoardThreadRow[];
  navBadgeCount: number;
};

async function activeAnnouncementsQuery(supabase: ReturnType<typeof createAdminClient>) {
  const nowIso = new Date().toISOString();
  return supabase
    .from("department_board_threads")
    .select(DEPARTMENT_BOARD_THREAD_SELECT)
    .eq("kind", "announcement")
    .is("archived_at", null)
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`);
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
    ((announcementsRes.data ?? []) as DepartmentBoardThreadRow[]).filter(isAnnouncementActive)
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

  let unseenAnswerItems: UnseenBoardAnswer[] = [];

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

  return {
    unreadAnnouncementCount,
    unreadAnnouncementLatestTitle,
    unreadAnnouncementBannerCount,
    unreadAnnouncementBannerLatestTitle,
    unreadAnnouncementBannerLatestId,
    unseenAnswerCount: unseenAnswerItems.length,
    unseenAnswerPreview: preview
      ? {
          threadId: preview.threadId,
          title: preview.title,
          isOwnQuestion: preview.isOwnQuestion,
        }
      : null,
    unseenQuestionIds: unseenAnswerItems.map((i) => i.threadId),
    pinnedAnnouncements,
    navBadgeCount: unreadAnnouncementCount + unseenAnswerItems.length,
  };
}

/** Badge menu handlowca: nieprzeczytane ogłoszenia + nieodczytane odpowiedzi. */
export async function countSalesBoardNavBadge(profileId: string): Promise<number> {
  const snapshot = await fetchSalesBoardAttentionSnapshot(profileId);
  return snapshot.navBadgeCount;
}
