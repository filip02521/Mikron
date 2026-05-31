"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";

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
      className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200/90 bg-white px-3 py-2.5 sm:px-4"
      role="status"
    >
      <p className="min-w-0 text-sm text-slate-800">
        <span className="font-semibold">{label}</span>
        <span className="text-slate-500"> — brak danych blokuje kolejkę prośb.</span>
      </p>
      <div className="flex shrink-0 flex-wrap gap-1.5">
        <Button variant="primary" size="sm" className="h-8" onClick={onOpenModal}>
          Uzupełnij
        </Button>
        <Link
          href="/weryfikacja"
          className="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
        >
          Pełny widok
        </Link>
      </div>
    </div>
  );
}
