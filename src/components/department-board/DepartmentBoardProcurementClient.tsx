"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { SectionHeadingIcon } from "@/components/icons/SectionHeadingIcon";
import { IconClipboardPen, IconInbox } from "@/components/icons/StrokeIcons";
import { NoteColorPicker } from "@/components/notatnik/NoteColorPicker";
import { NotatnikPanel } from "@/components/notatnik/NotatnikPanel";
import { NOTATNIK_INPUT_CLASS, NOTATNIK_TEXTAREA_CLASS } from "@/components/notatnik/notatnik-layout";
import { AnnouncementCard } from "@/components/department-board/AnnouncementCard";
import { QuestionThreadCard } from "@/components/department-board/QuestionThreadCard";
import {
  DepartmentBoardQuestionFilters,
  DepartmentBoardTabBar,
  type DepartmentBoardQuestionFilter,
  type DepartmentBoardTab,
} from "@/components/department-board/DepartmentBoardSalesChrome";
import {
  DepartmentBoardAnnouncementsEmpty,
  DepartmentBoardQuestionsEmpty,
} from "@/components/department-board/DepartmentBoardEmptyPanel";
import { DepartmentBoardProcurementGuide } from "@/components/department-board/DepartmentBoardProcurementGuide";
import {
  DEPARTMENT_BOARD_ANNOUNCEMENTS_EXPLAINER,
  DEPARTMENT_BOARD_NOTES_DISTINCTION_PROCUREMENT,
  DEPARTMENT_BOARD_PROCUREMENT_PAGE_DESC,
  DEPARTMENT_BOARD_PROCUREMENT_PAGE_TITLE,
  DEPARTMENT_BOARD_QUESTIONS_EXPLAINER,
} from "@/lib/department-board/copy";
import type { DepartmentBoardData } from "@/lib/data/department-board";
import type { SalesNoteColor } from "@/types/database";
import { cn } from "@/lib/cn";
import {
  brandIconTileClass,
  panelPageShellClass,
  panelTypography,
} from "@/lib/ui/ontime-theme";
import { mojeShipmentListClass } from "@/lib/ui/moje-shipment-row-styles";
import { actionCreateAnnouncement } from "@/app/actions/department-board";

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
  const [activeTab, setActiveTab] = useState<DepartmentBoardTab>(
    () => initialTab ?? (focusQuestionId ? "questions" : "announcements")
  );
  const [questionFilter, setQuestionFilter] = useState<DepartmentBoardQuestionFilter>("open");

  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementBody, setAnnouncementBody] = useState("");
  const [announcementColor, setAnnouncementColor] = useState<SalesNoteColor>("default");
  const [announcementPinned, setAnnouncementPinned] = useState(false);
  const [announcementExpires, setAnnouncementExpires] = useState("");
  const [announcementFormError, setAnnouncementFormError] = useState<string | null>(null);
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

  const openQuestionsCount = initial.questions.filter((q) => q.status === "open").length;

  useEffect(() => {
    if (focusAnnouncementId && activeTab === "announcements") {
      document.getElementById(`announcement-${focusAnnouncementId}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [focusAnnouncementId, activeTab, initial.announcements.length]);

  function refresh() {
    router.refresh();
  }

  async function submitAnnouncement() {
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

  return (
    <div className={panelPageShellClass}>
      {loadError ? <Alert tone="error">{loadError}</Alert> : null}

      <Card padding={false} className="overflow-hidden">
        <CardHeader
          inset
          density="compact"
          title={DEPARTMENT_BOARD_PROCUREMENT_PAGE_TITLE}
          description={pageDescription}
          action={<DepartmentBoardProcurementGuide />}
          leading={
            <SectionHeadingIcon tileClassName={brandIconTileClass}>
              <IconInbox size={20} />
            </SectionHeadingIcon>
          }
        />

        <DepartmentBoardTabBar
          domain="panel"
          activeTab={activeTab}
          onTabChange={setActiveTab}
          activeAnnouncements={initial.announcements.length}
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
                className={cn(NOTATNIK_INPUT_CLASS, "w-full text-sm")}
              />
              <textarea
                rows={4}
                value={announcementBody}
                onChange={(e) => setAnnouncementBody(e.target.value)}
                placeholder="Treść widoczna dla wszystkich handlowców…"
                className={cn(NOTATNIK_TEXTAREA_CLASS, "mt-2 w-full text-sm")}
              />
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <NoteColorPicker
                  value={announcementColor}
                  onChange={setAnnouncementColor}
                  disabled={saving}
                  size="sm"
                />
                <label className={cn("flex items-center gap-2", panelTypography.caption)}>
                  <input
                    type="checkbox"
                    checked={announcementPinned}
                    onChange={(e) => setAnnouncementPinned(e.target.checked)}
                  />
                  Przypnij na górze
                </label>
                <label className={cn("flex items-center gap-2", panelTypography.caption)}>
                  <span>Ważne do</span>
                  <input
                    type="date"
                    value={announcementExpires}
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
                  disabled={saving || !announcementTitle.trim() || !announcementBody.trim()}
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
            >
              {initial.announcements.length === 0 ? (
                <DepartmentBoardAnnouncementsEmpty
                  domain="panel"
                  questionsCount={initial.questions.length}
                  onShowQuestions={() => setActiveTab("questions")}
                />
              ) : (
                <div className={cn(mojeShipmentListClass, "-mx-3 -mb-3 sm:-mx-4 sm:-mb-4")}>
                  {initial.announcements.map((thread) => (
                    <AnnouncementCard
                      key={thread.id}
                      thread={thread}
                      embedded
                      canManage
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
              domain="panel"
              title="Pytania handlowców"
              description={DEPARTMENT_BOARD_QUESTIONS_EXPLAINER.body}
              count={initial.questions.length || undefined}
              icon={<IconClipboardPen size={17} />}
              accent="neutral"
            >
              <DepartmentBoardQuestionFilters
                domain="panel"
                value={questionFilter}
                onChange={setQuestionFilter}
              />
              {filteredQuestions.length === 0 ? (
                <DepartmentBoardQuestionsEmpty domain="panel" filter={questionFilter} />
              ) : (
                <div className={cn(mojeShipmentListClass, "-mx-3 sm:-mx-4")}>
                  {filteredQuestions.map((question) => (
                    <QuestionThreadCard
                      key={question.id}
                      question={question}
                      embedded
                      canReply
                      canArchive
                      defaultExpanded={
                        focusQuestionId === question.id || question.status === "open"
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
