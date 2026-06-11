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
import { NotatnikPanel } from "@/components/notatnik/NotatnikPanel";
import { ProsbaFormSection } from "@/components/orders/ProsbaFormSection";
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
  DEPARTMENT_BOARD_SALES_PAGE_DESC,
  DEPARTMENT_BOARD_SALES_PAGE_TITLE,
} from "@/lib/department-board/copy";
import type { DepartmentBoardData } from "@/lib/data/department-board";
import { countUnreadAnnouncements } from "@/lib/department-board/unread";
import { cn } from "@/lib/cn";
import { mojeShipmentListClass } from "@/lib/ui/moje-shipment-row-styles";
import { salesPageShellClass, salesTypography, sectionIconTileBrandClass } from "@/lib/ui/ontime-theme";
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
}: {
  initial: DepartmentBoardData;
  loadError?: string | null;
  unseenQuestionIds?: string[];
  boardAttention?: DepartmentBoardAttentionBanners | null;
  initialTab?: BoardTab;
  focusQuestionId?: string | null;
  focusAnnouncementId?: string | null;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const tourDemo = useSalesOnboardingDemo("tablica");
  const demoBoard = useMemo(() => buildOnboardingTablicaDemo(), []);
  const board = tourDemo ? demoBoard : initial;
  const effectiveUnseenQuestionIds = tourDemo
    ? [...ONBOARDING_TABLICA_UNSEEN_QUESTION_IDS]
    : unseenQuestionIds;
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
  const [questionFilter, setQuestionFilter] = useState<QuestionFilter>("all");
  const [questionTitle, setQuestionTitle] = useState("");
  const [questionBody, setQuestionBody] = useState("");
  const [questionFormError, setQuestionFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const filteredQuestions = useMemo(() => {
    if (questionFilter === "open") {
      return board.questions.filter((q) => q.status === "open");
    }
    if (questionFilter === "answered") {
      return board.questions.filter((q) => q.status === "answered");
    }
    return board.questions;
  }, [board.questions, questionFilter]);

  function refresh() {
    router.refresh();
  }

  useEffect(() => {
    if (focusQuestionId || unseenAnswersCount > 0) {
      setQuestionFilter("all");
    }
  }, [focusQuestionId, unseenAnswersCount]);

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
  const showAnnouncements = tourDemo || activeTab === "announcements";
  const showQuestions = tourDemo || activeTab === "questions";
  const effectiveAttention = tourDemo ? buildOnboardingBoardAttention() : boardAttention;
  const showUnreadBanner =
    effectiveAttention != null &&
    shouldShowBoardUnreadBanner(effectiveAttention, activeTab);
  const showAnswersBanner =
    effectiveAttention != null &&
    shouldShowBoardAnswersBanner(effectiveAttention, activeTab);

  const questionFormPanel =
    readOnly ? null : (
      <NotatnikPanel
        title="Zadaj pytanie do zakupów"
        description="Odpowiedź zobaczy cały dział handlowy."
        icon={<IconClipboardPen size={17} />}
        tileClassName="bg-indigo-100 text-indigo-800"
      >
        <ProsbaFormSection
          title="Treść pytania"
          hint="Pytanie ogólne do działu zakupów — nie zastępuje formularza Nowa prośba przy zamówieniu towaru."
        >
          <p className={cn(salesTypography.sectionHint, "-mt-1 mb-2")}>
            Zamówienie u dostawcy zgłaszasz w{" "}
            <Link href="/prosba" className="font-medium text-indigo-700 hover:underline">
              Nowa prośba
            </Link>
            .
          </p>
          <input
            type="text"
            value={questionTitle}
            onChange={(e) => setQuestionTitle(e.target.value)}
            placeholder="Temat pytania"
            className={cn(NOTATNIK_INPUT_CLASS, "w-full")}
          />
          <textarea
            rows={3}
            value={questionBody}
            onChange={(e) => setQuestionBody(e.target.value)}
            placeholder="Opisz pytanie…"
            className={cn(NOTATNIK_TEXTAREA_CLASS, "mt-2 w-full")}
          />
          {questionFormError ? (
            <p className="mt-2 text-xs text-red-600">{questionFormError}</p>
          ) : null}
          <div className="mt-3">
            <Button
              disabled={tourDemo || saving || !questionTitle.trim() || !questionBody.trim()}
              onClick={() => void submitQuestion()}
            >
              {tourDemo ? "Podgląd — bez wysyłki" : saving ? "Wysyłanie…" : "Wyślij pytanie"}
            </Button>
          </div>
        </ProsbaFormSection>
      </NotatnikPanel>
    );

  return (
    <div className={salesPageShellClass}>
      {loadError && !tourDemo ? <Alert tone="error">{loadError}</Alert> : null}

      <Card padding={false} className="overflow-hidden">
        <CardHeader
          inset
          density="compact"
          title={DEPARTMENT_BOARD_SALES_PAGE_TITLE}
          description={pageDescription}
          action={<DepartmentBoardGuide />}
          leading={
            <SectionHeadingIcon tileClassName={sectionIconTileBrandClass}>
              <IconInbox size={20} />
            </SectionHeadingIcon>
          }
        />

        {tourDemo ? null : <DepartmentBoardIntroBanner />}

        <DepartmentBoardTabBar
          domain="sales"
          activeTab={activeTab}
          onTabChange={setActiveTab}
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
              description="Komunikaty jednokierunkowe — bez odpowiedzi w tej sekcji."
              count={board.announcements.length || undefined}
              icon={<IconInbox size={17} />}
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
                      autoMarkRead={!tourDemo}
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
            {questionFormPanel}

            {readOnly ? (
              <Alert tone="info" className="text-xs">
                Podgląd administratora — wysyłanie pytań jest wyłączone.
              </Alert>
            ) : null}

            <NotatnikPanel
              title="Pytania zespołu"
              description="Wspólna lista — pytania kolegów i odpowiedzi zakupów. Filtr „Bez odpowiedzi” pokazuje tylko te, na które zakupy jeszcze nie odpisały."
              count={board.questions.length || undefined}
              icon={<IconClipboardPen size={17} />}
              tileClassName="bg-amber-100 text-amber-800"
            >
              <DepartmentBoardQuestionFilters
                value={questionFilter}
                onChange={setQuestionFilter}
              />
              {filteredQuestions.length === 0 ? (
                <DepartmentBoardQuestionsEmpty domain="sales" filter={questionFilter} />
              ) : (
                <div className={cn(mojeShipmentListClass, "-mx-3 sm:-mx-4")}>
                  {filteredQuestions.map((question) => (
                    <QuestionThreadCard
                      key={question.id}
                      question={question}
                      embedded
                      unseenReply={unseenSet.has(question.id)}
                      autoMarkSeen={!tourDemo && question.status === "answered"}
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
