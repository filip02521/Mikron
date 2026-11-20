"use client";

import Link from "next/link";
import { IconInfoCircle } from "@/components/icons/StrokeIcons";
import { prosbaHelpRowActionClass } from "@/components/orders/ProsbaFormMetaStrip";
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
      {/* Ten sam układ co wiersz „Skróty klawiszowe” pod spodem (ProsbaFormMetaStrip): ikona, zdanie, przycisk po prawej. */}
      <div className="flex items-center gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-700" aria-hidden>
            <IconInfoCircle size={15} strokeWidth={2} />
          </span>
          {/* Bez nowrap: długie zdanie nachodziło na „Ukryj” i wypychało ikonę poza kartę. */}
          <p className="min-w-0 text-xs leading-snug text-slate-600">
            To formularz <strong className="font-semibold text-slate-800">prośby o towar</strong> - trafia
            do procesu zamówień. Ogólne pytanie do działu zakupów (bez zamawiania) zadaj na{" "}
            <Link href="/tablica" className={cn(brandLinkClass, "font-medium")}>
              Tablicy
            </Link>
            .
          </p>
        </div>

        {/* Z ramką — goły szary napis „Ukryj” nie wyglądał na przycisk. */}
        <button type="button" className={prosbaHelpRowActionClass} onClick={dismiss}>
          Ukryj
        </button>
      </div>
    </div>
  );
}
