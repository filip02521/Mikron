"use client";

import { useEffect, useMemo, useState } from "react";
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
  initialTab,
  focusQuestionId = null,
}: {
  initial: DepartmentBoardData;
  loadError?: string | null;
  unseenQuestionIds?: string[];
  initialTab?: BoardTab;
  focusQuestionId?: string | null;
}) {
  const router = useRouter();
  const readSet = useMemo(() => new Set(initial.readAnnouncementIds), [initial.readAnnouncementIds]);
  const unseenSet = useMemo(() => new Set(unseenQuestionIds), [unseenQuestionIds]);
  const unreadAnnouncements = useMemo(() => countUnreadAnnouncements(initial), [initial]);
  const openQuestionsCount = initial.questions.filter((q) => q.status === "open").length;
  const unseenAnswersCount = unseenQuestionIds.length;

  const [activeTab, setActiveTab] = useState<BoardTab>(() => {
    if (initialTab) return initialTab;
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
      return initial.questions.filter((q) => q.status === "open");
    }
    if (questionFilter === "answered") {
      return initial.questions.filter((q) => q.status === "answered");
    }
    return initial.questions;
  }, [initial.questions, questionFilter]);

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

  return (
    <div className={salesPageShellClass}>
      {loadError ? <Alert tone="error">{loadError}</Alert> : null}

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

        <DepartmentBoardIntroBanner />

        <DepartmentBoardTabBar
          domain="sales"
          activeTab={activeTab}
          onTabChange={setActiveTab}
          unreadAnnouncements={unreadAnnouncements}
          openQuestions={openQuestionsCount}
          unseenAnswers={unseenAnswersCount}
        />

        {activeTab === "announcements" ? (
          <div className="space-y-3 p-3 sm:p-4">
            <NotatnikPanel
              title="Ogłoszenia od zakupów"
              description="Komunikaty jednokierunkowe — bez odpowiedzi w tej sekcji."
              count={initial.announcements.length || undefined}
              icon={<IconInbox size={17} />}
            >
              {initial.announcements.length === 0 ? (
                <DepartmentBoardAnnouncementsEmpty domain="sales" />
              ) : (
                <div className={cn(mojeShipmentListClass, "-mx-3 -mb-3 sm:-mx-4 sm:-mb-4")}>
                  {initial.announcements.map((thread) => (
                    <AnnouncementCard
                      key={thread.id}
                      thread={thread}
                      embedded
                      unread={!readSet.has(thread.id)}
                      autoMarkRead
                      onChanged={refresh}
                    />
                  ))}
                </div>
              )}
            </NotatnikPanel>
          </div>
        ) : null}

        {activeTab === "questions" ? (
          <div className="space-y-3 p-3 sm:p-4">
            <NotatnikPanel
              title="Pytania zespołu"
              description="Wspólna lista — pytania kolegów i odpowiedzi zakupów. Filtr „Bez odpowiedzi” pokazuje tylko te, na które zakupy jeszcze nie odpisały."
              count={initial.questions.length || undefined}
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
                      autoMarkSeen={question.status === "answered"}
                      defaultExpanded={
                        focusQuestionId === question.id || unseenSet.has(question.id)
                      }
                      onChanged={refresh}
                    />
                  ))}
                </div>
              )}
            </NotatnikPanel>

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
                    disabled={saving || !questionTitle.trim() || !questionBody.trim()}
                    onClick={() => void submitQuestion()}
                  >
                    {saving ? "Wysyłanie…" : "Wyślij pytanie"}
                  </Button>
                </div>
              </ProsbaFormSection>
            </NotatnikPanel>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
