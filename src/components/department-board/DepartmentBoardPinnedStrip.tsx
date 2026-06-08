import Link from "next/link";
import { IconPin } from "@/components/icons/StrokeIcons";
import { cn } from "@/lib/cn";
import { salesPinnedNoticeClass } from "@/lib/ui/ontime-theme";
import type { DepartmentBoardThreadRow } from "@/lib/data/department-board";

export function DepartmentBoardPinnedStrip({
  pinned,
  className,
}: {
  pinned: Pick<DepartmentBoardThreadRow, "id" | "title" | "body">[];
  className?: string;
}) {
  if (!pinned.length) return null;

  const primary = pinned[0]!;
  const extra = pinned.length - 1;
  const title = primary.title.trim() || "Ogłoszenie";

  return (
    <div role="status" className={cn(salesPinnedNoticeClass, className)}>
      <div className="flex min-w-0 items-center gap-2">
        <span className="shrink-0 text-indigo-500" aria-hidden>
          <IconPin size={15} strokeWidth={2.25} />
        </span>
        <p className="min-w-0 truncate text-sm text-slate-700">
          <span className="text-slate-500">Przypięte:</span>{" "}
          <span className="font-medium text-slate-900">{title}</span>
          {extra > 0 ? (
            <span className="font-normal text-slate-500">{` (+${extra})`}</span>
          ) : null}
        </p>
      </div>
      <Link
        href="/tablica?widok=ogloszenia"
        className="shrink-0 text-sm font-medium text-indigo-700 transition hover:text-indigo-950 hover:underline"
      >
        Czytaj
      </Link>
    </div>
  );
}
