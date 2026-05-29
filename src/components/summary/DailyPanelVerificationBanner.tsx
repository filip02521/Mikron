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
      ? "1 zgłoszenie wymaga uzupełnienia"
      : `${count} zgłoszeń wymaga uzupełnienia`;

  return (
    <div
      className="rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-3.5 sm:flex sm:items-center sm:justify-between sm:gap-4"
      role="status"
    >
      <div className="min-w-0">
        <p className="text-sm font-semibold text-amber-950">{label}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-amber-900/90">
          Prośby handlowców bez kompletnych danych nie trafią do kolejki Dziś. Uzupełnij je w
          weryfikacji.
        </p>
      </div>
      <div className="mt-3 flex shrink-0 flex-wrap gap-2 sm:mt-0">
        <Button variant="primary" size="sm" onClick={onOpenModal}>
          Uzupełnij teraz
        </Button>
        <Link
          href="/weryfikacja"
          className="inline-flex min-h-9 items-center rounded-lg border border-amber-300 bg-white px-3 text-sm font-medium text-amber-950 transition hover:bg-amber-50"
        >
          Pełny widok
        </Link>
      </div>
    </div>
  );
}
