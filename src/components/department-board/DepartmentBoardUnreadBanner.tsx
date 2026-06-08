import Link from "next/link";
import { SystemNotice } from "@/components/ui/SystemNotice";
import { Button } from "@/components/ui/Button";
import { MICROCOPY } from "@/lib/ui/microcopy";

export function DepartmentBoardUnreadBanner({
  unreadCount,
  latestTitle,
}: {
  unreadCount: number;
  latestTitle?: string | null;
}) {
  if (unreadCount <= 0) return null;

  const label =
    unreadCount === 1
      ? "1 nowe ogłoszenie od zakupów"
      : `${unreadCount} nowe ogłoszenia od zakupów`;

  const description = latestTitle?.trim()
    ? `„${latestTitle.trim()}”. ${MICROCOPY.notices.boardHint}`
    : MICROCOPY.notices.boardHint;

  return (
    <SystemNotice
      variant="action"
      title={label}
      description={description}
      action={
        <Link href="/tablica?widok=ogloszenia" className="shrink-0">
          <Button type="button" size="sm" className="min-h-11">
            Komunikacja
          </Button>
        </Link>
      }
    />
  );
}
