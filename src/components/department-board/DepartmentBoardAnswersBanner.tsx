import Link from "next/link";
import { SystemNotice } from "@/components/ui/SystemNotice";
import { Button } from "@/components/ui/Button";

function answerBannerDetail(
  count: number,
  preview?: {
    threadId: string;
    title: string;
    isOwnQuestion: boolean;
  } | null
): string {
  const title = preview?.title?.trim();
  const others = count > 1 ? count - 1 : 0;

  if (preview?.isOwnQuestion && title) {
    if (others > 0) {
      return `„${title}”. Na liście jest też ${others} ${others === 1 ? "inna nowa odpowiedź" : "inne nowe odpowiedzi"} w zespole.`;
    }
    return `„${title}” — odpowiedź widoczna dla całego działu.`;
  }

  if (title && others > 0) {
    return `„${title}” i ${others} ${others === 1 ? "inna nowa odpowiedź" : "inne nowe odpowiedzi"} zakupów w zespole.`;
  }

  if (title) {
    return `„${title}” — odpowiedź widoczna dla całego działu.`;
  }

  return "Sprawdź zakładkę Pytania zespołu w Komunikacji z zakupami.";
}

export function DepartmentBoardAnswersBanner({
  count,
  preview,
}: {
  count: number;
  preview?: {
    threadId: string;
    title: string;
    isOwnQuestion: boolean;
  } | null;
}) {
  if (count <= 0) return null;

  const label = preview?.isOwnQuestion
    ? count > 1
      ? "Zakupy odpowiedziały — także na inne pytania"
      : "Zakupy odpowiedziały na Twoje pytanie"
    : count === 1
      ? "1 nowa odpowiedź zakupów w zespole"
      : `${count} nowe odpowiedzi zakupów w zespole`;

  const href =
    count === 1 && preview
      ? `/tablica?widok=pytania&watek=${preview.threadId}`
      : "/tablica?widok=pytania";

  return (
    <SystemNotice
      variant="action"
      title={label}
      description={answerBannerDetail(count, preview)}
      action={
        <Link href={href} className="shrink-0">
          <Button type="button" size="sm" className="min-h-11">
            {count === 1 ? "Zobacz odpowiedź" : "Zobacz odpowiedzi"}
          </Button>
        </Link>
      }
    />
  );
}
