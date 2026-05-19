"use client";

import { Button } from "@/components/ui/Button";

export function VerificationPendingBanner({
  count,
  onOpen,
}: {
  count: number;
  onOpen: () => void;
}) {
  if (count <= 0) return null;

  const label =
    count === 1
      ? "1 zgłoszenie wymaga uzupełnienia danych"
      : `${count} zgłoszeń wymaga uzupełnienia danych`;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="font-medium text-amber-950">{label}</p>
        <p className="mt-0.5 text-sm text-amber-900/80">
          Niekompletne prośby (brak dostawcy, opisu lub ilości) — uzupełnij tutaj i zapisz, albo
          anuluj, jeśli nie da się zrealizować. Dopiero potem obsłużysz je w panelu jako Główne /
          Uzupełniające.
        </p>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="shrink-0 border-amber-300 bg-white hover:bg-amber-50"
        onClick={onOpen}
      >
        Uzupełnij dane
      </Button>
    </div>
  );
}
