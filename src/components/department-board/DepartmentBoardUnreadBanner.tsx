import Link from "next/link";
import { salesUpdatesBannerClass } from "@/lib/ui/ontime-theme";
import { Button } from "@/components/ui/Button";

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

  return (
    <div role="status" className={salesUpdatesBannerClass}>
      <div>
        <p className="font-semibold">{label}</p>
        <p className="mt-0.5 text-xs text-indigo-800/90">
          {latestTitle?.trim()
            ? `„${latestTitle.trim()}”. To komunikat — nie odpowiadasz na niego jak na prośbę o towar.`
            : "Komunikat jednokierunkowy od działu zakupów (nie prośba o zamówienie)."}
        </p>
      </div>
      <Link href="/tablica?widok=ogloszenia" className="shrink-0">
        <Button type="button" size="sm" className="min-h-11">
          Komunikacja
        </Button>
      </Link>
    </div>
  );
}
