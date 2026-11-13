import { formatZdEstimateElapsedCompact } from "@/lib/orders/zd-estimate-loading-ui";

/** Teksty zakładki „lista do ZD liczy się / jest gotowa” poza Kreatorem. */

export type ZdEstimateRunNoticeCopy = {
  /** Pionowy napis na zwiniętej zakładce. */
  compact: string;
  title: string;
  /** Dostawca albo zakres. */
  subject: string | null;
  detail: string;
  primaryCta: string;
  secondaryCta: string;
};

export const ZD_ESTIMATE_RUN_LOST_MESSAGE =
  "Serwer OnTime przerwał liczenie (np. restart usługi), zanim lista była gotowa.";

export function zdEstimateRunNoticeCopy(input: {
  state: "running" | "ready" | "failed";
  label: string;
  message?: string | null;
  elapsedMs?: number;
  pagesCommitted?: number;
  totalPages?: number;
}): ZdEstimateRunNoticeCopy {
  const subject = input.label.trim() || null;
  if (input.state === "ready") {
    return {
      compact: "Gotowe",
      title: "Lista do ZD jest gotowa",
      subject,
      detail: "Policzona w tle. Czeka, aż ją otworzysz.",
      primaryCta: "Otwórz listę",
      secondaryCta: "Odrzuć listę",
    };
  }
  if (input.state === "failed") {
    return {
      compact: "Błąd",
      title: "Nie udało się policzyć listy do ZD",
      subject,
      detail: input.message?.trim() || "Liczenie zakończyło się błędem.",
      primaryCta: "Wróć do Kreatora",
      secondaryCta: "Zamknij",
    };
  }
  const elapsed = formatZdEstimateElapsedCompact(input.elapsedMs ?? 0);
  const total = Math.max(0, Math.trunc(input.totalPages ?? 0));
  const done = Math.min(total, Math.max(0, Math.trunc(input.pagesCommitted ?? 0)));
  const pages = total > 1 ? `Subiekt: strona ${done} z ${total}. ` : "";
  return {
    compact: "Liczę",
    title: "Liczę listę do ZD…",
    subject,
    detail: `${pages}Trwa ${elapsed}. Możesz pracować dalej, dam znać, gdy będzie gotowa.`,
    primaryCta: "Wróć do Kreatora",
    secondaryCta: "Nie powiadamiaj",
  };
}
