"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconInbox } from "@/components/icons/StrokeIcons";
import { LinkChevron } from "@/components/ui/UiGlyphs";
import { useAppShellMetrics } from "@/components/layout/AppShellMetricsContext";
import { cn } from "@/lib/cn";
import {
  DEPARTMENT_BOARD_PROCUREMENT_OPEN_QUESTIONS_HINT,
  departmentBoardOpenQuestionsLabel,
} from "@/lib/department-board/copy";
import { procurementBoardQuestionsListHref } from "@/lib/data/department-board";
import { surfaceCardClass } from "@/lib/ui/ontime-theme";

export function OperationsBoardQuestionsNotice({ className }: { className?: string }) {
  const pathname = usePathname();
  const count = useAppShellMetrics().navBadges.departmentBoardQuestions ?? 0;

  if (
    count <= 0 ||
    pathname === "/podsumowanie" ||
    pathname.startsWith("/zakupy/tablica")
  ) {
    return null;
  }

  return (
    <div
      className={cn(
        surfaceCardClass,
        "mb-4 flex flex-wrap items-center justify-between gap-3 border-amber-200/85 bg-amber-50/40 px-3 py-2.5 sm:mb-6 sm:px-4",
        className
      )}
      role="status"
    >
      <div className="flex min-w-0 items-start gap-2.5">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-amber-100 text-amber-800">
          <IconInbox size={17} strokeWidth={2.25} aria-hidden />
        </span>
        <p className="min-w-0 text-sm text-slate-800">
          <span className="font-semibold text-amber-950">
            {departmentBoardOpenQuestionsLabel(count)}
          </span>
          <span className="text-slate-600"> — {DEPARTMENT_BOARD_PROCUREMENT_OPEN_QUESTIONS_HINT}</span>
        </p>
      </div>
      <Link
        href={procurementBoardQuestionsListHref()}
        className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md border border-amber-200/90 bg-white px-2.5 text-xs font-medium text-amber-950 transition hover:bg-amber-50"
      >
        Tablica pytań
        <LinkChevron size={13} tone="muted" />
      </Link>
    </div>
  );
}
