"use client";

import Link from "next/link";
import { IconInfoCircle } from "@/components/icons/StrokeIcons";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { usePersistedFlag } from "@/lib/client/use-persisted-flag";
import { prosbaVsBoardHintDismissedStore } from "@/lib/department-board/onboarding-storage";
import { brandLinkClass, salesChromeInsetClass } from "@/lib/ui/ontime-theme";

export function ProsbaVsBoardHint() {
  const hidden = usePersistedFlag(prosbaVsBoardHintDismissedStore);

  if (hidden) return null;

  function dismiss() {
    prosbaVsBoardHintDismissedStore.setValue(true);
  }

  return (
    <div
      role="status"
      aria-label="Różnica między prośbą a Tablicą"
      className={cn("border-b border-slate-100 py-2.5", salesChromeInsetClass)}
    >
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="flex min-w-0 flex-1 items-center justify-center gap-2 sm:gap-2.5">
          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-700">
            <IconInfoCircle size={15} strokeWidth={2} />
          </span>
          <p className="text-xs leading-snug text-slate-600 sm:whitespace-nowrap">
            To formularz <strong className="font-semibold text-slate-800">prośby o towar</strong> — trafia
            do procesu zamówień. Ogólne pytanie do działu zakupów (bez zamawiania) zadaj na{" "}
            <Link href="/tablica" className={cn(brandLinkClass, "font-medium")}>
              Tablicy
            </Link>
            .
          </p>
        </div>

        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 shrink-0 px-2 text-xs text-slate-500"
          onClick={dismiss}
        >
          Ukryj
        </Button>
      </div>
    </div>
  );
}
