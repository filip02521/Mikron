"use client";

import { EmptyState } from "@/components/ui/EmptyState";
import { IconClipboardPen, IconInbox } from "@/components/icons/StrokeIcons";
import type { DepartmentBoardQuestionFilter } from "@/components/department-board/DepartmentBoardSalesChrome";

export function DepartmentBoardAnnouncementsEmpty({
  questionsCount = 0,
  onShowQuestions,
}: {
  questionsCount?: number;
  onShowQuestions?: () => void;
}) {
  const panelDescription =
    questionsCount > 0
      ? `Opublikuj ogłoszenie powyżej, aby poinformować cały dział handlowy. Handlowcy mogą też publikować wątki w zakładce Pytania (${questionsCount}) — sprawdź, czy szukany wpis nie jest tam.`
      : "Opublikuj ogłoszenie powyżej, aby poinformować cały dział handlowy.";

  return (
    <EmptyState
      brandAccent
      icon={<IconInbox size={28} strokeWidth={1.75} />}
      title="Brak aktywnych ogłoszeń"
      description={panelDescription}
      action={
        questionsCount > 0 && onShowQuestions ? (
          <button
            type="button"
            className="text-sm font-semibold text-indigo-700 underline-offset-2 hover:underline"
            onClick={onShowQuestions}
          >
            Przejdź do pytań
          </button>
        ) : undefined
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
        : filter === "unseen"
          ? "Brak nowych odpowiedzi"
          : filter === "mine"
            ? "Nie masz jeszcze pytań na tablicy"
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
        : filter === "unseen"
          ? "Przejrzałeś już wszystkie nowe odpowiedzi zakupów — świetnie!"
          : filter === "mine"
            ? domain === "sales"
              ? "Kliknij «Zadaj pytanie» powyżej lub użyj przycisku na dole ekranu na telefonie."
              : "Pytania handlowców pojawią się tutaj automatycznie."
            : domain === "sales"
              ? "Kliknij «Zadaj pytanie» powyżej — odpowiedź zobaczy cały dział."
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
