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
import { procurementBoardQuestionsListHref } from "@/lib/data/department-board-shared";

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
        "mb-3 flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-200/70 bg-amber-50/80 px-3.5 py-2.5 sm:mb-4 sm:px-4",
        className
      )}
      role="status"
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-amber-100/90 text-amber-800">
          <IconInbox size={17} strokeWidth={2.25} aria-hidden />
        </span>
        <p className="min-w-0 text-sm leading-snug text-slate-800">
          <span className="font-semibold text-amber-950">
            {departmentBoardOpenQuestionsLabel(count)}
          </span>
          <span className="text-slate-600">
            {" "}
            — {DEPARTMENT_BOARD_PROCUREMENT_OPEN_QUESTIONS_HINT}
          </span>
        </p>
      </div>
      <Link
        href={procurementBoardQuestionsListHref()}
        className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md border border-amber-200/80 bg-white/90 px-2.5 text-xs font-semibold text-amber-950 transition hover:bg-amber-50/90"
      >
        Tablica pytań
        <LinkChevron size={13} tone="muted" />
      </Link>
    </div>
  );
}
