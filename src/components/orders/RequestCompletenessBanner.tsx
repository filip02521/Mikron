"use client";

import { useMemo } from "react";
import {
  assessRequestCompleteness,
  completenessUserHint,
  hasAnyProductHint,
  type RequestCompleteness,
  type RequestDraft,
} from "@/lib/orders/request-completeness";
import type { IndividualRequestKind } from "@/types/database";
import { cn } from "@/lib/cn";

export function RequestCompletenessBanner({
  draft,
  requestKind,
  forcedAssessment,
  embedded = false,
}: {
  draft: RequestDraft;
  requestKind: IndividualRequestKind;
  /** Gdy formularz ma wiele wierszy — ocena całej grupy */
  forcedAssessment?: RequestCompleteness | null;
  /** Wewnątrz RequestFormStatusPanel — bez podwójnej ramki */
  embedded?: boolean;
}) {
  const assessment = useMemo(() => {
    if (forcedAssessment !== undefined) return forcedAssessment;
    if (!hasAnyProductHint(draft)) return null;
    return assessRequestCompleteness({ ...draft, requestKind });
  }, [draft, forcedAssessment, requestKind]);

  if (!assessment) {
    return (
      <p
        className={cn(
          "text-sm text-slate-600",
          embedded
            ? "rounded-lg border border-dashed border-slate-200 bg-white px-3 py-2.5"
            : "rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3"
        )}
      >
        {requestKind === "zamowienie"
          ? "Wpisz symbol lub opis produktu oraz ilość (np. 1) — zobaczysz, czy zgłoszenie jest kompletne."
          : "Wpisz symbol lub opis produktu — zobaczysz, czy zgłoszenie jest kompletne."}
      </p>
    );
  }

  const hint = completenessUserHint(assessment, requestKind, { ...draft, requestKind });

  return (
    <div
      className={cn(
        "text-sm",
        embedded ? "rounded-lg border px-3 py-2.5" : "rounded-xl border px-4 py-3",
        hint.tone === "success"
          ? "border-emerald-200 bg-emerald-50 text-emerald-950"
          : "border-amber-200 bg-amber-50 text-amber-950"
      )}
    >
      <p className="font-semibold">{hint.title}</p>
      <p className="mt-1 leading-relaxed opacity-90">{hint.detail}</p>
    </div>
  );
}
