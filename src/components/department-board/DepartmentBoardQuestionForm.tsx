"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { ModalShell } from "@/components/ui/ModalShell";
import { IconChevronDown, IconClipboardPen } from "@/components/icons/StrokeIcons";
import { NOTATNIK_INPUT_CLASS, NOTATNIK_TEXTAREA_CLASS } from "@/components/notatnik/notatnik-layout";
import { DEPARTMENT_BOARD_QUESTIONS_FORM } from "@/lib/department-board/copy";
import { boardQuestionFabClass } from "@/lib/department-board/department-board-thread-styles";
import {
  boardQuestionsFieldLabelClass,
  boardQuestionsFormBodyClass,
  boardQuestionsFormEmbeddedBodyClass,
  boardQuestionsFormEmbeddedExpandBadgeClass,
  boardQuestionsFormEmbeddedHeaderClass,
  boardQuestionsFormEmbeddedHeaderExpandedClass,
  boardQuestionsFormEmbeddedShellClass,
  boardQuestionsFormEmbeddedTitleClass,
  boardQuestionsFormHeaderClass,
  boardQuestionsFormShellClass,
} from "@/lib/department-board/department-board-questions-ui";
import { cn } from "@/lib/cn";
import { floatingToastBottomClass } from "@/lib/ui/sales-mobile-chrome";
import { brandLinkClass, salesTypography } from "@/lib/ui/ontime-theme";

function QuestionFormIntro() {
  return (
    <p className={salesTypography.sectionHint}>
      {DEPARTMENT_BOARD_QUESTIONS_FORM.introBeforeLink}{" "}
      <Link href="/prosba" className={brandLinkClass}>
        {DEPARTMENT_BOARD_QUESTIONS_FORM.introLinkLabel}
      </Link>
      .
    </p>
  );
}

function QuestionFormFields({
  title,
  body,
  error,
  saving,
  tourDemo,
  embedded,
  onTitleChange,
  onBodyChange,
  onSubmit,
  idPrefix,
}: {
  title: string;
  body: string;
  error: string | null;
  saving: boolean;
  tourDemo: boolean;
  embedded?: boolean;
  onTitleChange: (value: string) => void;
  onBodyChange: (value: string) => void;
  onSubmit: () => void | Promise<void>;
  idPrefix: string;
}) {
  return (
    <div className={embedded ? boardQuestionsFormEmbeddedBodyClass : boardQuestionsFormBodyClass}>
      <QuestionFormIntro />

      <div>
        <label htmlFor={`${idPrefix}-title`} className={boardQuestionsFieldLabelClass}>
          {DEPARTMENT_BOARD_QUESTIONS_FORM.titleLabel}
        </label>
        <input
          id={`${idPrefix}-title`}
          type="text"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder={DEPARTMENT_BOARD_QUESTIONS_FORM.titlePlaceholder}
          className={cn(NOTATNIK_INPUT_CLASS, "h-9 w-full text-sm")}
        />
      </div>

      <div>
        <label htmlFor={`${idPrefix}-body`} className={boardQuestionsFieldLabelClass}>
          {DEPARTMENT_BOARD_QUESTIONS_FORM.bodyLabel}
        </label>
        <textarea
          id={`${idPrefix}-body`}
          rows={4}
          value={body}
          onChange={(e) => onBodyChange(e.target.value)}
          placeholder={DEPARTMENT_BOARD_QUESTIONS_FORM.bodyPlaceholder}
          className={cn(NOTATNIK_TEXTAREA_CLASS, "w-full text-sm leading-relaxed")}
        />
      </div>

      {error ? <p className="text-xs text-red-600">{error}</p> : null}

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-3">
        <Button
          size="sm"
          disabled={tourDemo || saving || !title.trim() || !body.trim()}
          onClick={() => void onSubmit()}
        >
          {tourDemo
            ? "Podgląd — bez wysyłki"
            : saving
              ? DEPARTMENT_BOARD_QUESTIONS_FORM.submitting
              : DEPARTMENT_BOARD_QUESTIONS_FORM.submit}
        </Button>
      </div>
    </div>
  );
}

export function DepartmentBoardQuestionForm({
  title,
  body,
  error,
  saving,
  tourDemo,
  defaultExpanded,
  hasQuestions,
  embedded = false,
  onTitleChange,
  onBodyChange,
  onSubmit,
}: {
  title: string;
  body: string;
  error: string | null;
  saving: boolean;
  tourDemo: boolean;
  defaultExpanded: boolean;
  hasQuestions: boolean;
  /** Wewnątrz panelu listy — bez osobnej karty i ikony. */
  embedded?: boolean;
  onTitleChange: (value: string) => void;
  onBodyChange: (value: string) => void;
  onSubmit: () => void | Promise<void>;
}) {
  const [userExpanded, setUserExpanded] = useState<boolean | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const expanded = userExpanded ?? defaultExpanded;

  const submit = async () => {
    try {
      await onSubmit();
      setMobileOpen(false);
    } catch {
      /* błąd zostaje w formularzu — modal otwarty */
    }
  };

  return (
    <>
      <div
        className={cn(
          embedded ? boardQuestionsFormEmbeddedShellClass : boardQuestionsFormShellClass,
          "hidden sm:block"
        )}
      >
        <button
          type="button"
          className={cn(
            embedded ? boardQuestionsFormEmbeddedHeaderClass : boardQuestionsFormHeaderClass,
            embedded && expanded && boardQuestionsFormEmbeddedHeaderExpandedClass,
            !embedded && "w-full text-left"
          )}
          onClick={() => setUserExpanded(!(userExpanded ?? defaultExpanded))}
          aria-expanded={expanded}
        >
          <span className="flex min-w-0 flex-1 items-center gap-2">
            <IconClipboardPen size={17} className="shrink-0 text-indigo-600" />
            <span
              className={
                embedded ? boardQuestionsFormEmbeddedTitleClass : salesTypography.blockTitle
              }
            >
              {DEPARTMENT_BOARD_QUESTIONS_FORM.title}
            </span>
            {embedded && hasQuestions && !expanded ? (
              <span className={boardQuestionsFormEmbeddedExpandBadgeClass}>
                {DEPARTMENT_BOARD_QUESTIONS_FORM.expandHint}
              </span>
            ) : null}
            {!embedded && hasQuestions && !expanded ? (
              <span className={salesTypography.sectionHint}>
                — {DEPARTMENT_BOARD_QUESTIONS_FORM.expandHint}
              </span>
            ) : null}
          </span>
          <IconChevronDown
            open={expanded}
            size={16}
            className={cn("shrink-0", embedded ? "text-indigo-500" : "text-slate-400")}
          />
        </button>
        {expanded ? (
          <QuestionFormFields
            title={title}
            body={body}
            error={error}
            saving={saving}
            tourDemo={tourDemo}
            embedded={embedded}
            onTitleChange={onTitleChange}
            onBodyChange={onBodyChange}
            onSubmit={() => submit()}
            idPrefix="board-question-desktop"
          />
        ) : null}
      </div>

      <button
        type="button"
        className={cn(boardQuestionFabClass, "sm:hidden", floatingToastBottomClass, "left-4 right-auto")}
        onClick={() => setMobileOpen(true)}
        aria-label={DEPARTMENT_BOARD_QUESTIONS_FORM.title}
      >
        <IconClipboardPen size={18} />
        <span>{DEPARTMENT_BOARD_QUESTIONS_FORM.title}</span>
      </button>

      <ModalShell
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        title={DEPARTMENT_BOARD_QUESTIONS_FORM.title}
        size="md"
        tier="raised"
        bodyClassName="p-0"
      >
        <QuestionFormFields
          title={title}
          body={body}
          error={error}
          saving={saving}
          tourDemo={tourDemo}
          onTitleChange={onTitleChange}
          onBodyChange={onBodyChange}
          onSubmit={() => submit()}
          idPrefix="board-question-mobile"
        />
      </ModalShell>
    </>
  );
}
