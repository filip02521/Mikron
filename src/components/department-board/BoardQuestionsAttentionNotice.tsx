"use client";

import { usePathname } from "next/navigation";
import { IconInbox } from "@/components/icons/StrokeIcons";
import {
  PageAttentionStrip,
  PageAttentionStripCta,
  type PageAttentionStripEdge,
} from "@/components/ui/PageAttentionStrip";
import { useAppShellMetrics } from "@/components/layout/AppShellMetricsContext";
import {
  DEPARTMENT_BOARD_PROCUREMENT_OPEN_QUESTIONS_HINT,
  departmentBoardOpenQuestionsLabel,
} from "@/lib/department-board/copy";
import { procurementBoardQuestionsListHref } from "@/lib/data/department-board-shared";

/**
 * Otwarte pytania na tablicy — wspólny pasek dla AppShell i panelu dziennego.
 */
export function BoardQuestionsAttentionNotice({
  edge = "inset",
  suppressPathHide = false,
  className,
}: {
  edge?: PageAttentionStripEdge;
  /** Panel /podsumowanie: nie chowaj po path (AppShell i tak jest wyłączony). */
  suppressPathHide?: boolean;
  className?: string;
}) {
  const pathname = usePathname();
  const count = useAppShellMetrics().navBadges.departmentBoardQuestions ?? 0;

  if (count <= 0) return null;

  if (
    !suppressPathHide &&
    (pathname === "/podsumowanie" || pathname.startsWith("/zakupy/tablica"))
  ) {
    return null;
  }

  return (
    <PageAttentionStrip
      tone="amber"
      edge={edge}
      className={className}
      icon={<IconInbox size={17} strokeWidth={2.25} />}
      title={departmentBoardOpenQuestionsLabel(count)}
      hint={DEPARTMENT_BOARD_PROCUREMENT_OPEN_QUESTIONS_HINT}
      actions={
        <PageAttentionStripCta href={procurementBoardQuestionsListHref()}>
          Tablica pytań
        </PageAttentionStripCta>
      }
    />
  );
}
