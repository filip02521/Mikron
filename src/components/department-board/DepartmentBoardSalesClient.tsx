"use client";

import { useMemo, useState } from "react";
import { useSalesOnboardingDemo } from "@/components/sales/SalesOnboardingContext";
import {
  buildOnboardingBoardAttention,
  buildOnboardingTablicaDemo,
  ONBOARDING_TABLICA_UNSEEN_QUESTION_IDS,
} from "@/lib/sales/sales-onboarding-demo-data";
import { DepartmentBoardAnswersBanner } from "@/components/department-board/DepartmentBoardAnswersBanner";
import type { DepartmentBoardAttentionBanners } from "@/lib/department-board/board-attention-banners";
import { shouldShowBoardAnswersBanner } from "@/lib/department-board/board-attention-banners";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/Alert";
import { Card, CardHeader } from "@/components/ui/Card";
import { Toast } from "@/components/ui/Toast";
import { SectionHeadingIcon } from "@/components/icons/SectionHeadingIcon";
import { IconClipboardPen } from "@/components/icons/StrokeIcons";
import { QuestionThreadCard } from "@/components/department-board/QuestionThreadCard";
import type { DepartmentBoardQuestionFilter } from "@/components/department-board/DepartmentBoardSalesChrome";
import { DepartmentBoardQuestionsEmpty } from "@/components/department-board/DepartmentBoardEmptyPanel";
import { DepartmentBoardGuide } from "@/components/department-board/DepartmentBoardGuide";
import { DepartmentBoardQuestionForm } from "@/components/department-board/DepartmentBoardQuestionForm";
import { DepartmentBoardQuestionToolbar } from "@/components/department-board/DepartmentBoardQuestionToolbar";
import {
  DEPARTMENT_BOARD_NOTES_DISTINCTION_SALES,
  DEPARTMENT_BOARD_QUESTIONS_EXPLAINER,
  DEPARTMENT_BOARD_QUESTIONS_FILTERS,
  DEPARTMENT_BOARD_QUESTIONS_FORM,
  DEPARTMENT_BOARD_SALES_PAGE_DESC,
  DEPARTMENT_BOARD_SALES_PAGE_TITLE,
} from "@/lib/department-board/copy";
import {
  departmentBoardQuestionFilterCounts,
  filterDepartmentBoardQuestions,
  resolveQuestionFilterAfterUnseenCleared,
} from "@/lib/department-board/question-filters";
import { boardQuestionListClass } from "@/lib/department-board/department-board-thread-styles";
import type { DepartmentBoardQuestionsSlice } from "@/lib/data/department-board";
import { cn } from "@/lib/cn";
import { AppBrandContentFooter } from "@/components/layout/AppBrandContentFooter";
import {
  salesPageShellClass,
  sectionIconTileBrandClass,
  salesChromeInsetClass,
} from "@/lib/ui/ontime-theme";
import { SalesListFilterEmptyHint } from "@/components/sales/SalesListEmptyHints";
import { actionCreateQuestion } from "@/app/actions/department-board";
import {
  emptyBoardQuestionProductDraft,
  type BoardQuestionProductDraft,
} from "@/lib/department-board/question-product";
import { useDeepLinkScrollOnce } from "@/hooks/use-deep-link-scroll-once";
import { useDepartmentBoardSalesQuestionUrl } from "@/hooks/use-department-board-sales-question-url";

export function DepartmentBoardSalesClient({
  initial,
  loadError = null,
  unseenQuestionIds = [],
  boardAttention = null,
  focusQuestionId = null,
  readOnly = false,
  pageTitle,
  previewHint,
  currentSalesPersonId = null,
}: {
  initial: DepartmentBoardQuestionsSlice;
  loadError?: string | null;
  unseenQuestionIds?: string[];
  boardAttention?: DepartmentBoardAttentionBanners | null;
  focusQuestionId?: string | null;
  readOnly?: boolean;
  pageTitle?: string;
  previewHint?: string;
  currentSalesPersonId?: string | null;
}) {
  const router = useRouter();
  const {
    questionFilter,
    questionSearch,
    setFilter: setQuestionFilter,
    setSearch: setQuestionSearch,
    clearSearch: clearQuestionSearch,
  } = useDepartmentBoardSalesQuestionUrl();
  const tourDemo = useSalesOnboardingDemo("tablica");
  const demoBoard = useMemo(() => buildOnboardingTablicaDemo(), []);
  const board = tourDemo ? { questions: demoBoard.questions } : initial;
  const effectiveUnseenQuestionIds = useMemo(
    () => (tourDemo ? [...ONBOARDING_TABLICA_UNSEEN_QUESTION_IDS] : unseenQuestionIds),
    [tourDemo, unseenQuestionIds]
  );
  const unseenSet = useMemo(
    () => new Set(effectiveUnseenQuestionIds),
    [effectiveUnseenQuestionIds]
  );
  const unseenAnswersCount = effectiveUnseenQuestionIds.length;

  const filterCtx = useMemo(
    () => ({ unseenIds: unseenSet, currentSalesPersonId }),
    [unseenSet, currentSalesPersonId]
  );

  const filtersLockedByFocus = Boolean(focusQuestionId);
  const activeQuestionFilter: DepartmentBoardQuestionFilter = filtersLockedByFocus
    ? "all"
    : resolveQuestionFilterAfterUnseenCleared(questionFilter, unseenAnswersCount);
  const focusQuestionMissing = Boolean(
    focusQuestionId && !board.questions.some((question) => question.id === focusQuestionId)
  );
  const [questionTitle, setQuestionTitle] = useState("");
  const [questionBody, setQuestionBody] = useState("");
  const [questionProduct, setQuestionProduct] = useState<BoardQuestionProductDraft>(
    emptyBoardQuestionProductDraft()
  );
  const [questionFormError, setQuestionFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [successToast, setSuccessToast] = useState(false);

  const questionFilterCounts = useMemo(
    () =>
      departmentBoardQuestionFilterCounts(board.questions, {
        search: questionSearch,
        ctx: filterCtx,
      }),
    [board.questions, questionSearch, filterCtx]
  );

  const statusFilteredQuestions = useMemo(
    () =>
      filterDepartmentBoardQuestions(board.questions, {
        filter: activeQuestionFilter,
        search: "",
        ctx: filterCtx,
      }),
    [board.questions, activeQuestionFilter, filterCtx]
  );

  const questionSearchNeedle = questionSearch.trim();
  const filteredQuestions = useMemo(
    () =>
      filterDepartmentBoardQuestions(board.questions, {
        filter: activeQuestionFilter,
        search: questionSearch,
        ctx: filterCtx,
        focusQuestionId,
      }),
    [board.questions, activeQuestionFilter, questionSearch, filterCtx, focusQuestionId]
  );

  function refresh() {
    router.refresh();
  }

  useDeepLinkScrollOnce(
    focusQuestionId ? `question-${focusQuestionId}` : null,
    Boolean(focusQuestionId)
  );

  async function submitQuestion() {
    setSaving(true);
    setQuestionFormError(null);
    try {
      await actionCreateQuestion(questionTitle, questionBody, {
        symbol: questionProduct.symbol,
        productName: questionProduct.product,
        subiektTwId: questionProduct.subiektTwId,
        mikranCode: questionProduct.mikranCode,
      });
      setQuestionTitle("");
      setQuestionBody("");
      setQuestionProduct(emptyBoardQuestionProductDraft());
      const nextFilter = currentSalesPersonId ? "mine" : "all";
      setQuestionFilter(nextFilter);
      setSuccessToast(true);
      refresh();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Nie udało się wysłać pytania.";
      setQuestionFormError(message);
    } finally {
      setSaving(false);
    }
  }

  const pageDescription = `${DEPARTMENT_BOARD_SALES_PAGE_DESC} ${DEPARTMENT_BOARD_NOTES_DISTINCTION_SALES}`;
  const effectiveAttention = tourDemo ? buildOnboardingBoardAttention() : boardAttention;
  const showAnswersBanner =
    effectiveAttention != null &&
    shouldShowBoardAnswersBanner(effectiveAttention) &&
    activeQuestionFilter !== "unseen";

  const filtersDisabledReason = filtersLockedByFocus
    ? DEPARTMENT_BOARD_QUESTIONS_FILTERS.focusDisabledHint
    : null;

  return (
    <div className={salesPageShellClass}>
      {successToast ? (
        <Toast
          message={DEPARTMENT_BOARD_QUESTIONS_FORM.successToast}
          onDismiss={() => setSuccessToast(false)}
        />
      ) : null}

      <Card padding={false} className="overflow-hidden">
        <CardHeader
          inset
          density="compact"
          title={pageTitle ?? DEPARTMENT_BOARD_SALES_PAGE_TITLE}
          hint={pageDescription}
          hintAriaLabel="O pytaniach zespołu"
          action={<DepartmentBoardGuide />}
          leading={
            <SectionHeadingIcon tileClassName={sectionIconTileBrandClass}>
              <IconClipboardPen size={20} />
            </SectionHeadingIcon>
          }
        />

        {loadError && !tourDemo ? (
          <Alert tone="error" className={cn(salesChromeInsetClass, "mt-0")}>
            {loadError}
          </Alert>
        ) : null}

        {previewHint ? (
          <div className="border-b border-slate-100 px-3 py-2.5 sm:px-4">
            <p className="text-xs leading-relaxed text-slate-600">{previewHint}</p>
          </div>
        ) : null}

        {focusQuestionMissing ? (
          <div className="border-b border-slate-100 px-3 py-2.5 sm:px-4">
            <Alert tone="warning">
              Nie znaleziono wskazanego pytania — mogło zostać zarchiwizowane lub usunięte.
            </Alert>
          </div>
        ) : null}

        {showAnswersBanner && effectiveAttention ? (
          <div className="border-b border-slate-100 px-3 py-2.5 sm:px-4">
            <DepartmentBoardAnswersBanner
              count={effectiveAttention.unseenAnswerCount}
              preview={effectiveAttention.unseenAnswerPreview}
            />
          </div>
        ) : null}

        <div className="space-y-4 p-3 pb-20 sm:p-4 sm:pb-4">
          <p className="text-xs leading-relaxed text-slate-600">
            {DEPARTMENT_BOARD_QUESTIONS_EXPLAINER.body}
          </p>

          {!readOnly ? (
            <DepartmentBoardQuestionForm
              embedded
              title={questionTitle}
              body={questionBody}
              product={questionProduct}
              error={questionFormError}
              saving={saving}
              tourDemo={tourDemo}
              defaultExpanded={board.questions.length === 0}
              hasQuestions={board.questions.length > 0}
              onTitleChange={setQuestionTitle}
              onBodyChange={setQuestionBody}
              onProductChange={(patch) =>
                setQuestionProduct((current) => ({ ...current, ...patch }))
              }
              onSubmit={() => void submitQuestion()}
            />
          ) : null}

          <DepartmentBoardQuestionToolbar
            domain="sales"
            filter={activeQuestionFilter}
            onFilterChange={setQuestionFilter}
            filtersDisabled={filtersLockedByFocus}
            filtersDisabledReason={filtersDisabledReason}
            search={questionSearch}
            onSearchChange={setQuestionSearch}
            matchCount={filteredQuestions.length}
            totalCount={statusFilteredQuestions.length}
            showSearch={board.questions.length > 0}
            filterCounts={questionFilterCounts}
            showMine={Boolean(currentSalesPersonId)}
            showUnseen={unseenAnswersCount > 0}
            searchLabel="Szukaj w pytaniach zespołu"
            searchActive={Boolean(questionSearchNeedle)}
          />

          {questionSearchNeedle && filteredQuestions.length === 0 && statusFilteredQuestions.length > 0 ? (
            <SalesListFilterEmptyHint
              query={questionSearchNeedle}
              onClear={clearQuestionSearch}
              entityLabel="pytań"
            />
          ) : filteredQuestions.length === 0 ? (
            <DepartmentBoardQuestionsEmpty domain="sales" filter={activeQuestionFilter} />
          ) : (
            <div className={boardQuestionListClass}>
              {filteredQuestions.map((question) => (
                <QuestionThreadCard
                  key={question.id}
                  question={question}
                  embedded
                  unseenReply={unseenSet.has(question.id)}
                  autoMarkSeen={!tourDemo && !readOnly && question.status === "answered"}
                  defaultExpanded={tourDemo || focusQuestionId === question.id}
                  onChanged={refresh}
                />
              ))}
            </div>
          )}
        </div>
      </Card>
      <AppBrandContentFooter mobileOnly variant="page" />
    </div>
  );
}
