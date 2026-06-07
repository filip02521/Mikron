"use client";

import { useMemo } from "react";
import { FormStatusAlert } from "@/components/orders/FormStatusAlert";
import {
  assessRequestCompleteness,
  completenessUserHint,
  hasAnyProductHint,
  type RequestCompleteness,
  type RequestDraft,
} from "@/lib/orders/request-completeness";
import type { IndividualRequestKind } from "@/types/database";

export function RequestCompletenessBanner({
  draft,
  requestKind,
  forcedAssessment,
  embedded = false,
  audience = "default",
}: {
  draft: RequestDraft;
  requestKind: IndividualRequestKind;
  /** Gdy formularz ma wiele wierszy — ocena całej grupy */
  forcedAssessment?: RequestCompleteness | null;
  /** Wewnątrz RequestFormStatusPanel — bez podwójnej ramki */
  embedded?: boolean;
  audience?: "procurement" | "default";
}) {
  const assessment = useMemo(() => {
    if (forcedAssessment !== undefined) return forcedAssessment;
    if (!hasAnyProductHint(draft)) return null;
    return assessRequestCompleteness({ ...draft, requestKind });
  }, [draft, forcedAssessment, requestKind]);

  if (!assessment) {
    return (
      <FormStatusAlert tone="info">
        {requestKind === "zamowienie"
          ? "Wpisz symbol lub opis produktu oraz ilość (np. 1), aby sprawdzić kompletność."
          : "Wpisz symbol lub opis produktu, aby sprawdzić kompletność."}
      </FormStatusAlert>
    );
  }

  const hint = completenessUserHint(assessment, requestKind, { ...draft, requestKind }, {
    audience,
  });

  return (
    <FormStatusAlert tone={hint.tone === "success" ? "success" : "warning"} title={hint.title}>
      {hint.detail}
    </FormStatusAlert>
  );
}
