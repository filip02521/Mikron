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
}: {
  draft: RequestDraft;
  requestKind: IndividualRequestKind;
  /** Gdy formularz ma wiele wierszy — ocena całej grupy */
  forcedAssessment?: RequestCompleteness | null;
}) {
  const assessment = useMemo(() => {
    if (forcedAssessment !== undefined) return forcedAssessment;
    if (!hasAnyProductHint(draft)) return null;
    return assessRequestCompleteness({ ...draft, requestKind });
  }, [draft, forcedAssessment, requestKind]);

  if (!assessment) {
    return (
      <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
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
        "rounded-xl border px-4 py-3 text-sm",
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
