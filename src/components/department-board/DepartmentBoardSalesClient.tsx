"use client";

import { useEffect, useMemo, useState } from "react";
import { useSalesOnboardingDemo } from "@/components/sales/SalesOnboardingContext";
import {
  buildOnboardingBoardAttention,
  buildOnboardingTablicaDemo,
  ONBOARDING_TABLICA_UNSEEN_QUESTION_IDS,
} from "@/lib/sales/sales-onboarding-demo-data";
import { DepartmentBoardAnswersBanner } from "@/components/department-board/DepartmentBoardAnswersBanner";
import { DepartmentBoardUnreadBanner } from "@/components/department-board/DepartmentBoardUnreadBanner";
import type { DepartmentBoardAttentionBanners } from "@/lib/department-board/board-attention-banners";
import {
  shouldShowBoardAnswersBanner,
  shouldShowBoardUnreadBanner,
} from "@/lib/department-board/board-attention-banners";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { SectionHeadingIcon } from "@/components/icons/SectionHeadingIcon";
import { IconClipboardPen, IconInbox } from "@/components/icons/StrokeIcons";
import { NOTATNIK_INPUT_CLASS, NOTATNIK_TEXTAREA_CLASS } from "@/components/notatnik/notatnik-layout";
import { AnnouncementCard } from "@/components/department-board/AnnouncementCard";
import { QuestionThreadCard } from "@/components/department-board/QuestionThreadCard";
import {
  DepartmentBoardQuestionFilters,
  DepartmentBoardTabBar,
} from "@/components/department-board/DepartmentBoardSalesChrome";
import {
  DepartmentBoardAnnouncementsEmpty,
  DepartmentBoardQuestionsEmpty,
} from "@/components/department-board/DepartmentBoardEmptyPanel";
import { DepartmentBoardGuide } from "@/components/department-board/DepartmentBoardGuide";
import { DepartmentBoardIntroBanner } from "@/components/department-board/DepartmentBoardIntroBanner";
import {
  DEPARTMENT_BOARD_NOTES_DISTINCTION_SALES,
  DEPARTMENT_BOARD_QUESTIONS_EXPLAINER,
  DEPARTMENT_BOARD_SALES_PAGE_DESC,
  DEPARTMENT_BOARD_SALES_PAGE_TITLE,
} from "@/lib/department-board/copy";
import type { DepartmentBoardData } from "@/lib/data/department-board";
import { countUnreadAnnouncements } from "@/lib/department-board/unread";
import { cn } from "@/lib/cn";
import { mojeShipmentListClass } from "@/lib/ui/moje-shipment-row-styles";
import { salesPageShellClass, salesTypography, sectionIconTileBrandClass, brandLinkClass } from "@/lib/ui/ontime-theme";
import { NotatnikPanel } from "@/components/notatnik/NotatnikPanel";
import { NotatnikListFilterBar } from "@/components/notatnik/NotatnikListFilterBar";
import { SalesListFilterEmptyHint } from "@/components/sales/SalesListEmptyHints";
import { filterDepartmentBoardQuestionsByQuery } from "@/lib/department-board/question-search";
import { actionCreateQuestion } from "@/app/actions/department-board";

type QuestionFilter = "all" | "open" | "answered";
type BoardTab = "announcements" | "questions";

export function DepartmentBoardSalesClient({
  initial,
  loadError = null,
  unseenQuestionIds = [],
  boardAttention = null,
  initialTab,
  focusQuestionId = null,
  focusAnnouncementId = null,
  readOnly = false,
  pageTitle,
  previewHint,
}: {
  initial: DepartmentBoardData;
  loadError?: string | null;
  unseenQuestionIds?: string[];
  boardAttention?: DepartmentBoardAttentionBanners | null;
  initialTab?: BoardTab;
  focusQuestionId?: string | null;
  focusAnnouncementId?: string | null;
  readOnly?: boolean;
  pageTitle?: string;
  previewHint?: string;
}) {
  const router = useRouter();
  const tourDemo = useSalesOnboardingDemo("tablica");
  const demoBoard = useMemo(() => buildOnboardingTablicaDemo(), []);
  const board = tourDemo ? demoBoard : initial;
  const effectiveUnseenQuestionIds = useMemo(
    () => (tourDemo ? [...ONBOARDING_TABLICA_UNSEEN_QUESTION_IDS] : unseenQuestionIds),
    [tourDemo, unseenQuestionIds]
  );
  const readSet = useMemo(
    () => new Set(board.readAnnouncementIds),
    [board.readAnnouncementIds]
  );
  const unseenSet = useMemo(
    () => new Set(effectiveUnseenQuestionIds),
    [effectiveUnseenQuestionIds]
  );
  const unreadAnnouncements = useMemo(() => countUnreadAnnouncements(board), [board]);
  const openQuestionsCount = board.questions.filter((q) => q.status === "open").length;
  const unseenAnswersCount = effectiveUnseenQuestionIds.length;

  const [activeTab, setActiveTab] = useState<BoardTab>(() => {
    if (initialTab) return initialTab;
    if (focusAnnouncementId) return "announcements";
    if (focusQuestionId || unseenAnswersCount > 0) return "questions";
    return unreadAnnouncements > 0 ? "announcements" : "questions";
  });
  const [tourDemoTab, setTourDemoTab] = useState<BoardTab>("announcements");
  const [questionFilter, setQuestionFilter] = useState<QuestionFilter>("all");
  const forceAllQuestions = Boolean(focusQuestionId) || unseenAnswersCount > 0;
  const activeQuestionFilter: QuestionFilter = forceAllQuestions ? "all" : questionFilter;
  const [questionTitle, setQuestionTitle] = useState("");
  const [questionBody, setQuestionBody] = useState("");
  const [questionFormError, setQuestionFormError] = useState<string | null>(null);
  const [questionSearch, setQuestionSearch] = useState("");
  const [saving, setSaving] = useState(false);

  const statusFilteredQuestions = useMemo(() => {
    if (activeQuestionFilter === "open") {
      return board.questions.filter((q) => q.status === "open");
    }
    if (activeQuestionFilter === "answered") {
      return board.questions.filter((q) => q.status === "answered");
    }
    return board.questions;
  }, [board.questions, activeQuestionFilter]);

  const questionSearchNeedle = questionSearch.trim();
  const filteredQuestions = useMemo(
    () => filterDepartmentBoardQuestionsByQuery(statusFilteredQuestions, questionSearch),
    [statusFilteredQuestions, questionSearch]
  );

  function refresh() {
    router.refresh();
  }

  useEffect(() => {
    if (!focusQuestionId) return;
    window.setTimeout(() => {
      document.getElementById(`question-${focusQuestionId}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 120);
  }, [focusQuestionId, activeTab]);

  useEffect(() => {
    if (!focusAnnouncementId) return;
    window.setTimeout(() => {
      document.getElementById(`announcement-${focusAnnouncementId}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 180);
  }, [focusAnnouncementId, activeTab, board.announcements.length]);

  async function submitQuestion() {
    setSaving(true);
    setQuestionFormError(null);
    try {
      await actionCreateQuestion(questionTitle, questionBody);
      setQuestionTitle("");
      setQuestionBody("");
      setActiveTab("questions");
      setQuestionFilter("all");
      refresh();
    } catch (e) {
      setQuestionFormError(e instanceof Error ? e.message : "Nie udało się wysłać pytania.");
    } finally {
      setSaving(false);
    }
  }

  const pageDescription = `${DEPARTMENT_BOARD_SALES_PAGE_DESC} ${DEPARTMENT_BOARD_NOTES_DISTINCTION_SALES}`;
  const resolvedTab = tourDemo ? tourDemoTab : activeTab;
  const handleTabChange = tourDemo ? setTourDemoTab : setActiveTab;
  const showAnnouncements = resolvedTab === "announcements";
  const showQuestions = resolvedTab === "questions";
  const effectiveAttention = tourDemo ? buildOnboardingBoardAttention() : boardAttention;
  const showUnreadBanner =
    effectiveAttention != null &&
    shouldShowBoardUnreadBanner(effectiveAttention, resolvedTab);
  const showAnswersBanner =
    effectiveAttention != null &&
    shouldShowBoardAnswersBanner(effectiveAttention, resolvedTab);

  const questionFormPanel =
    readOnly ? null : (
      <div className="space-y-2 border-b border-slate-100 pb-4">
        <p className={salesTypography.sectionHint}>
          {DEPARTMENT_BOARD_QUESTIONS_EXPLAINER.body}{" "}
          <Link href="/prosba" className={brandLinkClass}>
            Nowa prośba
          </Link>{" "}
          służy do zamówień u dostawcy.
        </p>
        <input
          type="text"
          value={questionTitle}
          onChange={(e) => setQuestionTitle(e.target.value)}
          placeholder="Temat pytania"
          className={cn(NOTATNIK_INPUT_CLASS, "w-full")}
        />
        <textarea
          rows={2}
          value={questionBody}
          onChange={(e) => setQuestionBody(e.target.value)}
          placeholder="Treść pytania…"
          className={cn(NOTATNIK_TEXTAREA_CLASS, "w-full")}
        />
        {questionFormError ? (
          <p className="text-xs text-red-600">{questionFormError}</p>
        ) : null}
        <Button
          size="sm"
          disabled={tourDemo || saving || !questionTitle.trim() || !questionBody.trim()}
          onClick={() => void submitQuestion()}
        >
          {tourDemo ? "Podgląd — bez wysyłki" : saving ? "Wysyłanie…" : "Wyślij pytanie"}
        </Button>
      </div>
    );

  return (
    <div className={salesPageShellClass}>
      {loadError && !tourDemo ? <Alert tone="error">{loadError}</Alert> : null}

      <Card padding={false} className="overflow-hidden">
        <CardHeader
          inset
          density="compact"
          title={pageTitle ?? DEPARTMENT_BOARD_SALES_PAGE_TITLE}
          description={pageDescription}
          action={<DepartmentBoardGuide />}
          leading={
            <SectionHeadingIcon tileClassName={sectionIconTileBrandClass}>
              <IconInbox size={20} />
            </SectionHeadingIcon>
          }
        />

        {previewHint ? (
          <div className="border-b border-slate-100 px-3 py-2.5 sm:px-4">
            <p className={salesTypography.sectionHint}>{previewHint}</p>
          </div>
        ) : null}

        {tourDemo ? null : <DepartmentBoardIntroBanner />}

        <DepartmentBoardTabBar
          domain="sales"
          activeTab={resolvedTab}
          onTabChange={handleTabChange}
          unreadAnnouncements={unreadAnnouncements}
          openQuestions={openQuestionsCount}
          unseenAnswers={unseenAnswersCount}
        />

        {showUnreadBanner || showAnswersBanner ? (
          <div className="space-y-2 border-b border-slate-100 px-3 py-2.5 sm:px-4">
            {showUnreadBanner && effectiveAttention ? (
              <DepartmentBoardUnreadBanner
                unreadCount={effectiveAttention.unreadAnnouncementBannerCount}
                latestTitle={effectiveAttention.unreadAnnouncementBannerLatestTitle}
              />
            ) : null}
            {showAnswersBanner && effectiveAttention ? (
              <DepartmentBoardAnswersBanner
                count={effectiveAttention.unseenAnswerCount}
                preview={effectiveAttention.unseenAnswerPreview}
              />
            ) : null}
          </div>
        ) : null}

        {showAnnouncements ? (
          <div className="space-y-3 p-3 sm:p-4">
            <NotatnikPanel
              title="Ogłoszenia od zakupów"
              description="Komunikaty do odczytu — bez odpowiedzi w tej sekcji."
              count={board.announcements.length || undefined}
              icon={<IconInbox size={17} />}
              accent="neutral"
            >
              {board.announcements.length === 0 ? (
                <DepartmentBoardAnnouncementsEmpty domain="sales" />
              ) : (
                <div className={cn(mojeShipmentListClass, "-mx-3 -mb-3 sm:-mx-4 sm:-mb-4")}>
                  {board.announcements.map((thread) => (
                    <AnnouncementCard
                      key={thread.id}
                      thread={thread}
                      embedded
                      unread={!readSet.has(thread.id)}
                      autoMarkRead={!tourDemo && !readOnly}
                      onChanged={refresh}
                    />
                  ))}
                </div>
              )}
            </NotatnikPanel>
          </div>
        ) : null}

        {showQuestions ? (
          <div className="space-y-3 p-3 sm:p-4">
            <NotatnikPanel
              title="Pytania zespołu"
              description="Wspólna lista pytań i odpowiedzi zakupów."
              count={board.questions.length || undefined}
              icon={<IconClipboardPen size={17} />}
              accent="neutral"
              bodyClassName="space-y-3"
            >
              {questionFormPanel}

              <DepartmentBoardQuestionFilters
                value={activeQuestionFilter}
                onChange={setQuestionFilter}
              />
              {board.questions.length > 0 ? (
                <NotatnikListFilterBar
                  embedded
                  bleed
                  value={questionSearch}
                  onChange={setQuestionSearch}
                  matchCount={filteredQuestions.length}
                  totalCount={statusFilteredQuestions.length}
                  placeholder="Szukaj po temacie, treści, autorze lub odpowiedzi…"
                  searchLabel="Szukaj w pytaniach zespołu"
                  idleHint="Filtruj pytania po temacie, treści, autorze lub fragmencie odpowiedzi."
                  activeHint="Wyniki z aktywnego filtra statusu pytań."
                  emptyMatchHint="Brak dopasowań — sprawdź temat, treść, autora lub odpowiedź."
                />
              ) : null}
              {questionSearchNeedle && filteredQuestions.length === 0 && statusFilteredQuestions.length > 0 ? (
                <SalesListFilterEmptyHint
                  query={questionSearchNeedle}
                  onClear={() => setQuestionSearch("")}
                  entityLabel="pytań"
                />
              ) : filteredQuestions.length === 0 ? (
                <DepartmentBoardQuestionsEmpty domain="sales" filter={activeQuestionFilter} />
              ) : (
                <div className={cn(mojeShipmentListClass, "-mx-3 sm:-mx-4")}>
                  {filteredQuestions.map((question) => (
                    <QuestionThreadCard
                      key={question.id}
                      question={question}
                      embedded
                      unseenReply={unseenSet.has(question.id)}
                      autoMarkSeen={!tourDemo && !readOnly && question.status === "answered"}
                      defaultExpanded={
                        tourDemo ||
                        focusQuestionId === question.id ||
                        unseenSet.has(question.id)
                      }
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
