"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { SectionHeadingIcon } from "@/components/icons/SectionHeadingIcon";
import { IconClipboardPen } from "@/components/icons/StrokeIcons";
import { cn } from "@/lib/cn";

const MISSING_FIELDS = ["Dostawca", "Produkt", "Ilość"] as const;

export function VerificationPendingBanner({
  count,
  onOpen,
  className,
}: {
  count: number;
  onOpen: () => void;
  className?: string;
}) {
  if (count <= 0) return null;

  const title =
    count === 1
      ? "1 zgłoszenie wymaga uzupełnienia danych"
      : `${count} zgłoszeń wymaga uzupełnienia danych`;

  return (
    <div
      role="alert"
      className={cn(
        "relative overflow-hidden rounded-2xl border border-amber-300/90 bg-gradient-to-br from-amber-50 via-white to-amber-50/50 shadow-[var(--shadow-card-elevated)] ring-1 ring-amber-200/80",
        className
      )}
    >
      <div
        className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-amber-200/35 blur-2xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute bottom-0 left-0 h-1 w-full bg-gradient-to-r from-amber-400 via-amber-300 to-amber-200"
        aria-hidden
      />

      <div className="relative flex flex-col gap-4 p-4 sm:flex-row sm:items-stretch sm:gap-5 sm:p-5">
        <SectionHeadingIcon
          tileClassName="h-14 w-14 rounded-xl bg-amber-100 text-amber-800 shadow-inner shadow-amber-900/5"
          className="self-start sm:self-center"
        >
          <IconClipboardPen size={28} />
        </SectionHeadingIcon>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="inline-flex min-w-[2rem] items-center justify-center rounded-full bg-amber-500 px-2.5 py-0.5 text-sm font-bold tabular-nums text-white shadow-sm"
              aria-hidden
            >
              {count}
            </span>
            <p className="text-base font-semibold leading-snug text-amber-950 sm:text-lg">
              {title}
            </p>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-amber-900/90">
            Handlowiec przekazał niekompletne prośby — brakuje m.in. dostawcy, opisu lub ilości.
            Uzupełnij i zapisz tutaj (lub anuluj, jeśli nie da się zrealizować). Dopiero potem
            obsłużysz je w panelu jako{" "}
            <span className="font-medium text-amber-950">Główne</span> /{" "}
            <span className="font-medium text-amber-950">Uzupełniające</span>.
          </p>
          <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Pola do uzupełnienia">
            {MISSING_FIELDS.map((label) => (
              <li
                key={label}
                className="rounded-md border border-amber-200/90 bg-white/90 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-900/85"
              >
                {label}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex shrink-0 flex-col justify-center gap-2 sm:min-w-[10.5rem]">
          <Button
            variant="primary"
            size="sm"
            className="w-full shadow-sm"
            onClick={onOpen}
          >
            Uzupełnij teraz
          </Button>
          <Link
            href="/weryfikacja"
            className="text-center text-sm font-medium text-amber-900 underline decoration-amber-400/80 underline-offset-2 hover:text-amber-950"
          >
            Pełny widok weryfikacji
          </Link>
        </div>
      </div>
    </div>
  );
}
