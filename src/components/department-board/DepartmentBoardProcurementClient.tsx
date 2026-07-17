"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { NoticeToast } from "@/components/ui/NoticeToast";
import { SectionHeadingIcon } from "@/components/icons/SectionHeadingIcon";
import { IconClipboardPen, IconInbox } from "@/components/icons/StrokeIcons";
import { NoteColorPicker } from "@/components/notatnik/NoteColorPicker";
import { NotatnikPanel } from "@/components/notatnik/NotatnikPanel";
import { NOTATNIK_INPUT_CLASS, NOTATNIK_TEXTAREA_CLASS } from "@/components/notatnik/notatnik-layout";
import { AnnouncementCard } from "@/components/department-board/AnnouncementCard";
import { QuestionThreadCard } from "@/components/department-board/QuestionThreadCard";
import {
  DepartmentBoardTabBar,
  type DepartmentBoardQuestionFilter,
  type DepartmentBoardTab,
} from "@/components/department-board/DepartmentBoardSalesChrome";
import {
  DepartmentBoardAnnouncementsEmpty,
  DepartmentBoardQuestionsEmpty,
} from "@/components/department-board/DepartmentBoardEmptyPanel";
import { DepartmentBoardProcurementGuide } from "@/components/department-board/DepartmentBoardProcurementGuide";
import { DepartmentBoardQuestionToolbar } from "@/components/department-board/DepartmentBoardQuestionToolbar";
import {
  DEPARTMENT_BOARD_ANNOUNCEMENTS_EXPLAINER,
  DEPARTMENT_BOARD_NOTES_DISTINCTION_PROCUREMENT,
  DEPARTMENT_BOARD_PROCUREMENT_PAGE_DESC,
  DEPARTMENT_BOARD_PROCUREMENT_PAGE_TITLE,
  DEPARTMENT_BOARD_QUESTIONS_EXPLAINER,
  DEPARTMENT_BOARD_QUESTIONS_FILTERS,
} from "@/lib/department-board/copy";
import {
  departmentBoardQuestionFilterCounts,
  filterDepartmentBoardQuestions,
} from "@/lib/department-board/question-filters";
import { boardQuestionsSectionClass } from "@/lib/department-board/department-board-questions-ui";
import { filterDepartmentBoardAnnouncementsByQuery } from "@/lib/department-board/announcement-search";
import { DEPARTMENT_BOARD_ANNOUNCEMENTS_SEARCH } from "@/lib/department-board/copy";
import { NotatnikListFilterBar } from "@/components/notatnik/NotatnikListFilterBar";
import { salesSearchPlaceholder } from "@/lib/sales/sales-search-ui";
import { SALES_SEARCH_COPY } from "@/lib/sales/sales-page-ui-copy";
import { boardAnnouncementListClass, boardQuestionListClass } from "@/lib/department-board/department-board-thread-styles";
import type { DepartmentBoardData } from "@/lib/data/department-board";
import type { SalesNoteColor } from "@/types/database";
import { cn } from "@/lib/cn";
import {
  brandIconTileClass,
  panelPageShellClass,
  panelTypography,
} from "@/lib/ui/ontime-theme";
import { actionCreateAnnouncement } from "@/app/actions/department-board";
import { usePreviewMutationBlocker } from "@/components/layout/usePreviewMutationBlocker";
import { useDeepLinkScrollOnce } from "@/hooks/use-deep-link-scroll-once";
import { useDepartmentBoardTabUrl } from "@/hooks/use-department-board-tab-url";
import { SalesListFilterEmptyHint } from "@/components/sales/SalesListEmptyHints";
import { toastSuccess } from "@/lib/ui/notice-copy";

const PROCUREMENT_ANNOUNCEMENT_SUCCESS_TOAST = toastSuccess(
  "Opublikowano",
  "Ogłoszenie jest już widoczne na tablicy handlowców."
);

export function DepartmentBoardProcurementClient({
  initial,
  loadError = null,
  initialTab,
  focusQuestionId = null,
  focusAnnouncementId = null,
}: {
  initial: DepartmentBoardData;
  loadError?: string | null;
  initialTab?: DepartmentBoardTab;
  focusQuestionId?: string | null;
  focusAnnouncementId?: string | null;
}) {
  const router = useRouter();
  const { readOnly, blockIfReadOnly } = usePreviewMutationBlocker();
  const [activeTab, setActiveTab] = useState<DepartmentBoardTab>(
    () => initialTab ?? (focusQuestionId ? "questions" : "announcements")
  );
  const [questionFilter, setQuestionFilter] = useState<DepartmentBoardQuestionFilter>(
    () => (focusQuestionId ? "all" : "open")
  );
  const [questionSearch, setQuestionSearch] = useState("");
  const [announcementSearch, setAnnouncementSearch] = useState("");
  const filtersLockedByFocus = Boolean(focusQuestionId);
  const activeQuestionFilter: DepartmentBoardQuestionFilter = filtersLockedByFocus
    ? "all"
    : questionFilter;
  const focusThreadMissing = Boolean(
    (focusQuestionId && !initial.questions.some((question) => question.id === focusQuestionId)) ||
      (focusAnnouncementId &&
        !initial.announcements.some((announcement) => announcement.id === focusAnnouncementId))
  );

  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementBody, setAnnouncementBody] = useState("");
  const [announcementColor, setAnnouncementColor] = useState<SalesNoteColor>("default");
  const [announcementPinned, setAnnouncementPinned] = useState(false);
  const [announcementExpires, setAnnouncementExpires] = useState("");
  const [announcementFormError, setAnnouncementFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [successToast, setSuccessToast] = useState(false);

  const openQuestionsCount = initial.questions.filter((q) => q.status === "open").length;

  const questionFilterCounts = useMemo(
    () =>
      departmentBoardQuestionFilterCounts(initial.questions, {
        search: questionSearch,
      }),
    [initial.questions, questionSearch]
  );

  const announcementSearchNeedle = announcementSearch.trim();
  const filteredAnnouncements = useMemo(
    () => filterDepartmentBoardAnnouncementsByQuery(initial.announcements, announcementSearch),
    [initial.announcements, announcementSearch]
  );

  const statusFilteredQuestions = useMemo(
    () =>
      filterDepartmentBoardQuestions(initial.questions, {
        filter: activeQuestionFilter,
        search: "",
      }),
    [initial.questions, activeQuestionFilter]
  );

  const questionSearchNeedle = questionSearch.trim();
  const filteredQuestions = useMemo(
    () =>
      filterDepartmentBoardQuestions(initial.questions, {
        filter: activeQuestionFilter,
        search: questionSearch,
        focusQuestionId,
      }),
    [focusQuestionId, initial.questions, questionSearch, activeQuestionFilter]
  );

  const syncTabToUrl = useDepartmentBoardTabUrl();
  const handleTabChange = (tab: DepartmentBoardTab) => {
    setActiveTab(tab);
    syncTabToUrl(tab);
  };

  useDeepLinkScrollOnce(
    focusAnnouncementId ? `announcement-${focusAnnouncementId}` : null,
    Boolean(focusAnnouncementId) && activeTab === "announcements"
  );
  useDeepLinkScrollOnce(
    focusQuestionId ? `question-${focusQuestionId}` : null,
    Boolean(focusQuestionId) && activeTab === "questions"
  );

  const refresh = useCallback(() => {
    router.refresh();
  }, [router]);

  async function submitAnnouncement() {
    if (blockIfReadOnly()) return;
    setSaving(true);
    setAnnouncementFormError(null);
    try {
      await actionCreateAnnouncement(announcementTitle, announcementBody, {
        color: announcementColor,
        pinned: announcementPinned,
        expires_at: announcementExpires || null,
      });
      setAnnouncementTitle("");
      setAnnouncementBody("");
      setAnnouncementPinned(false);
      setAnnouncementExpires("");
      setAnnouncementColor("default");
      setSuccessToast(true);
      refresh();
    } catch (e) {
      setAnnouncementFormError(
        e instanceof Error ? e.message : "Nie udało się opublikować ogłoszenia."
      );
    } finally {
      setSaving(false);
    }
  }

  const pageDescription = `${DEPARTMENT_BOARD_PROCUREMENT_PAGE_DESC} ${DEPARTMENT_BOARD_NOTES_DISTINCTION_PROCUREMENT}`;
  const filtersDisabledReason = filtersLockedByFocus
    ? DEPARTMENT_BOARD_QUESTIONS_FILTERS.focusDisabledHint
    : null;

  return (
    <div className={panelPageShellClass}>
      {successToast ? (
        <NoticeToast
          notice={PROCUREMENT_ANNOUNCEMENT_SUCCESS_TOAST}
          onDismiss={() => setSuccessToast(false)}
        />
      ) : null}

      {loadError ? <Alert tone="error">{loadError}</Alert> : null}

      {focusThreadMissing ? (
        <Alert tone="warning">
          Nie znaleziono wskazanego wpisu — mógł zostać zarchiwizowany lub usunięty.
        </Alert>
      ) : null}

      <Card padding={false} className="overflow-hidden">
        <CardHeader
          inset
          density="compact"
          title={DEPARTMENT_BOARD_PROCUREMENT_PAGE_TITLE}
          hint={pageDescription}
          hintAriaLabel="O tablicy"
          action={<DepartmentBoardProcurementGuide />}
          leading={
            <SectionHeadingIcon tileClassName={brandIconTileClass}>
              <IconInbox size={20} />
            </SectionHeadingIcon>
          }
        />

        <DepartmentBoardTabBar
          activeTab={activeTab}
          onTabChange={handleTabChange}
          activeAnnouncements={initial.announcements.length}
          totalQuestions={initial.questions.length}
          openQuestions={openQuestionsCount}
        />

        {activeTab === "announcements" ? (
          <div className="space-y-3 p-3 sm:p-4">
            <NotatnikPanel
              domain="panel"
              title="Nowe ogłoszenie"
              description={DEPARTMENT_BOARD_ANNOUNCEMENTS_EXPLAINER.body}
              icon={<IconInbox size={17} />}
            >
              <input
                type="text"
                value={announcementTitle}
                onChange={(e) => setAnnouncementTitle(e.target.value)}
                placeholder="Tytuł ogłoszenia"
                disabled={readOnly || saving}
                className={cn(NOTATNIK_INPUT_CLASS, "w-full text-sm")}
              />
              <textarea
                rows={4}
                value={announcementBody}
                onChange={(e) => setAnnouncementBody(e.target.value)}
                placeholder="Treść widoczna dla wszystkich handlowców…"
                disabled={readOnly || saving}
                className={cn(NOTATNIK_TEXTAREA_CLASS, "mt-2 w-full text-sm")}
              />
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <NoteColorPicker
                  value={announcementColor}
                  onChange={setAnnouncementColor}
                  disabled={readOnly || saving}
                  size="sm"
                />
                <label className={cn("flex items-center gap-2", panelTypography.caption)}>
                  <input
                    type="checkbox"
                    checked={announcementPinned}
                    disabled={readOnly || saving}
                    onChange={(e) => setAnnouncementPinned(e.target.checked)}
                  />
                  Przypnij na górze
                </label>
                <label className={cn("flex items-center gap-2", panelTypography.caption)}>
                  <span>Ważne do</span>
                  <input
                    type="date"
                    value={announcementExpires}
                    disabled={readOnly || saving}
                    min={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => setAnnouncementExpires(e.target.value)}
                    className={cn(NOTATNIK_INPUT_CLASS, "h-8 w-auto text-xs")}
                  />
                </label>
              </div>
              {announcementFormError ? (
                <p className="mt-2 text-xs text-red-600">{announcementFormError}</p>
              ) : null}
              <div className="mt-3">
                <Button
                  disabled={
                    readOnly || saving || !announcementTitle.trim() || !announcementBody.trim()
                  }
                  onClick={() => void submitAnnouncement()}
                >
                  {saving ? "Publikowanie…" : "Opublikuj ogłoszenie"}
                </Button>
              </div>
            </NotatnikPanel>

            <NotatnikPanel
              domain="panel"
              title="Opublikowane ogłoszenia"
              count={initial.announcements.length || undefined}
              icon={<IconInbox size={17} />}
              bodyClassName="space-y-3"
            >
              {initial.announcements.length > 0 ? (
                <NotatnikListFilterBar
                  embedded
                  bleed
                  visibleLabel={DEPARTMENT_BOARD_ANNOUNCEMENTS_SEARCH.label}
                  value={announcementSearch}
                  onChange={setAnnouncementSearch}
                  matchCount={filteredAnnouncements.length}
                  totalCount={initial.announcements.length}
                  placeholder={salesSearchPlaceholder(SALES_SEARCH_COPY.boardAnnouncements)}
                  searchLabel={DEPARTMENT_BOARD_ANNOUNCEMENTS_SEARCH.label}
                  showIdleHint={false}
                  showActiveDetail={false}
                  emptyMatchHint="Brak dopasowań — sprawdź tytuł lub treść ogłoszenia."
                />
              ) : null}
              {announcementSearchNeedle && filteredAnnouncements.length === 0 ? (
                <SalesListFilterEmptyHint
                  query={announcementSearchNeedle}
                  onClear={() => setAnnouncementSearch("")}
                  entityLabel="ogłoszeń"
                />
              ) : initial.announcements.length === 0 ? (
                <DepartmentBoardAnnouncementsEmpty
                  questionsCount={initial.questions.length}
                  onShowQuestions={() => handleTabChange("questions")}
                />
              ) : (
                <div className={cn(boardAnnouncementListClass, "-mx-3 -mb-3 sm:-mx-4 sm:-mb-4")}>
                  {filteredAnnouncements.map((thread) => (
                    <AnnouncementCard
                      key={thread.id}
                      thread={thread}
                      embedded
                      canManage={!readOnly}
                      onChanged={refresh}
                    />
                  ))}
                </div>
              )}
            </NotatnikPanel>
          </div>
        ) : null}

        {activeTab === "questions" ? (
          <div className={cn(boardQuestionsSectionClass, "p-3 sm:p-4")}>
            <NotatnikPanel
              domain="panel"
              title="Pytania handlowców"
              description={`${DEPARTMENT_BOARD_QUESTIONS_EXPLAINER.body} Odpowiedzi widzą wszyscy handlowcy.`}
              count={initial.questions.length || undefined}
              icon={<IconClipboardPen size={17} />}
              accent="indigo"
              flushBody
              bodyClassName="space-y-4 p-3 sm:p-4"
            >
              <DepartmentBoardQuestionToolbar
                domain="panel"
                filter={activeQuestionFilter}
                onFilterChange={setQuestionFilter}
                filtersDisabled={filtersLockedByFocus}
                filtersDisabledReason={filtersDisabledReason}
                search={questionSearch}
                onSearchChange={setQuestionSearch}
                matchCount={filteredQuestions.length}
                totalCount={statusFilteredQuestions.length}
                showSearch={initial.questions.length > 0}
                filterCounts={questionFilterCounts}
                searchLabel="Szukaj w pytaniach handlowców"
                searchActive={Boolean(questionSearchNeedle)}
              />

              {questionSearchNeedle && filteredQuestions.length === 0 && statusFilteredQuestions.length > 0 ? (
                <SalesListFilterEmptyHint
                  query={questionSearchNeedle}
                  onClear={() => setQuestionSearch("")}
                  entityLabel="pytań"
                />
              ) : filteredQuestions.length === 0 ? (
                <DepartmentBoardQuestionsEmpty domain="panel" filter={activeQuestionFilter} />
              ) : (
                <div className={cn(boardQuestionListClass, "-mx-1 sm:-mx-0")}>
                  {filteredQuestions.map((question, index) => (
                    <QuestionThreadCard
                      key={question.id}
                      question={question}
                      embedded
                      rowAlternate={index % 2 === 1}
                      canReply={!readOnly}
                      canArchive={!readOnly}
                      defaultExpanded={focusQuestionId === question.id}
                      onChanged={refresh}
                    />
                  ))}
                </div>
              )}
            </NotatnikPanel>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
