"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { IconClipboardPen } from "@/components/icons/StrokeIcons";
import { LinkChevron } from "@/components/ui/UiGlyphs";
import { cn } from "@/lib/cn";
import { surfaceCardClass } from "@/lib/ui/ontime-theme";

export function DailyPanelVerificationBanner({
  count,
  onOpenModal,
}: {
  count: number;
  onOpenModal: () => void;
}) {
  if (count <= 0) return null;

  const label =
    count === 1
      ? "1 zgłoszenie do uzupełnienia"
      : `${count} zgłoszeń do uzupełnienia`;

  return (
    <div
      className={cn(
        surfaceCardClass,
        "flex flex-wrap items-center justify-between gap-3 border-amber-200/85 bg-amber-50/40 px-3 py-2.5 sm:px-4"
      )}
      role="status"
    >
      <div className="flex min-w-0 items-start gap-2.5">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-amber-100 text-amber-800">
          <IconClipboardPen size={17} strokeWidth={2.25} aria-hidden />
        </span>
        <p className="min-w-0 text-sm text-slate-800">
          <span className="font-semibold text-amber-950">{label}</span>
          <span className="text-slate-600"> — brak danych blokuje kolejkę prośb.</span>
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap gap-1.5">
        <Button variant="primary" size="sm" className="h-8" onClick={onOpenModal}>
          Uzupełnij
        </Button>
        <Link
          href="/weryfikacja"
          className="inline-flex h-8 items-center gap-1 rounded-md border border-amber-200/90 bg-white px-2.5 text-xs font-medium text-amber-950 transition hover:bg-amber-50"
        >
          Pełny widok
          <LinkChevron size={13} tone="muted" />
        </Link>
      </div>
    </div>
  );
}
