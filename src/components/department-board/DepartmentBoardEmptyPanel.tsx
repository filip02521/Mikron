"use client";

import { EmptyState } from "@/components/ui/EmptyState";
import { IconClipboardPen, IconInbox } from "@/components/icons/StrokeIcons";
import type { DepartmentBoardQuestionFilter } from "@/components/department-board/DepartmentBoardSalesChrome";

export function DepartmentBoardAnnouncementsEmpty({
  domain,
}: {
  domain: "sales" | "panel";
}) {
  return (
    <EmptyState
      brandAccent
      icon={<IconInbox size={28} strokeWidth={1.75} />}
      title={domain === "sales" ? "Brak ogłoszeń od zakupów" : "Brak aktywnych ogłoszeń"}
      description={
        domain === "sales"
          ? "Gdy dział zakupów opublikuje komunikat, pojawi się tutaj — bez konieczności sprawdzania maila."
          : "Opublikuj ogłoszenie powyżej, aby poinformować cały dział handlowy."
      }
    />
  );
}

export function DepartmentBoardQuestionsEmpty({
  domain,
  filter,
}: {
  domain: "sales" | "panel";
  filter: DepartmentBoardQuestionFilter;
}) {
  const title =
    filter === "open"
      ? "Brak pytań bez odpowiedzi"
      : filter === "answered"
        ? "Brak pytań z odpowiedzią"
        : domain === "sales"
          ? "Brak pytań na tablicy"
          : "Brak pytań do wyświetlenia";

  const description =
    filter === "open"
      ? domain === "sales"
        ? "Wszystkie pytania zespołu mają już odpowiedź zakupów — albo nikt jeszcze nic nie zapytał."
        : "Handlowcy nie czekają obecnie na odpowiedź — sprawdź filtr „Wszystkie”."
      : filter === "answered"
        ? "Gdy zakupy odpowiedzą na pytanie, wątek trafi tutaj po wybraniu tego filtra."
        : domain === "sales"
          ? "Zadaj pierwsze pytanie w formularzu poniżej — odpowiedź zobaczy cały dział."
          : "Pytania handlowców pojawią się tutaj automatycznie.";

  return (
    <EmptyState
      brandAccent
      icon={<IconClipboardPen size={28} strokeWidth={1.75} />}
      title={title}
      description={description}
    />
  );
}
