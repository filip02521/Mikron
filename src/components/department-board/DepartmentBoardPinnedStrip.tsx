import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { IconPin } from "@/components/icons/StrokeIcons";
import { cn } from "@/lib/cn";
import { salesTypography } from "@/lib/ui/ontime-theme";
import type { DepartmentBoardThreadRow } from "@/lib/data/department-board";

export function DepartmentBoardPinnedStrip({
  pinned,
}: {
  pinned: Pick<DepartmentBoardThreadRow, "id" | "title" | "body">[];
}) {
  if (!pinned.length) return null;

  const primary = pinned[0]!;
  const extra = pinned.length - 1;

  return (
    <div
      role="status"
      className="border-b border-indigo-200/80 bg-gradient-to-r from-indigo-50/95 to-sky-50/80 px-3 py-2.5 sm:px-4"
    >
      <div className="mx-auto flex max-w-3xl flex-wrap items-start justify-between gap-2 2xl:max-w-4xl">
        <div className="flex min-w-0 items-start gap-2">
          <span className="mt-0.5 shrink-0 text-indigo-600" aria-hidden>
            <IconPin size={16} strokeWidth={2.5} />
          </span>
          <div className="min-w-0">
            <p className={cn(salesTypography.blockTitle, "text-indigo-950")}>
              Przypięte ogłoszenie od zakupów
              {extra > 0 ? ` (+${extra})` : ""}
            </p>
            <p className="text-[11px] text-indigo-800/80">
              Komunikat — nie prośba o towar. Status zamówień sprawdzasz w Moje zamówienia.
            </p>
            <p className="mt-0.5 text-sm font-semibold text-slate-900">{primary.title}</p>
            <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-slate-600">
              {primary.body.trim()}
            </p>
          </div>
        </div>
        <Link href="/tablica?widok=ogloszenia" className="shrink-0">
          <Button type="button" size="sm" variant="outline" className="min-h-10 bg-white/80">
            Czytaj
          </Button>
        </Link>
      </div>
    </div>
  );
}
