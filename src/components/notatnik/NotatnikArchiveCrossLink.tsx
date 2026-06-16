import Link from "next/link";
import { buildNotatnikPageHref } from "@/lib/sales/notepad-page-tabs";
import { cn } from "@/lib/cn";
import { salesChromeInsetClass, salesTypography } from "@/lib/ui/ontime-theme";

/** Wskazówka między osobnymi archiwami ZK i notatek. */
export function NotatnikArchiveCrossLink({
  surface,
  className,
}: {
  surface: "zk" | "notes";
  className?: string;
}) {
  const otherHref =
    surface === "zk"
      ? buildNotatnikPageHref({ tab: "archive", surface: "notes" })
      : buildNotatnikPageHref({ tab: "archive", surface: "zk" });

  return (
    <p
      className={cn(
        salesTypography.chrome,
        "border-b border-slate-100 bg-slate-50/45 py-2.5 text-slate-600",
        salesChromeInsetClass,
        className
      )}
    >
      {surface === "zk" ? (
        <>
          Zarchiwizowane notatki są w{" "}
          <Link
            href={otherHref}
            className="font-medium text-indigo-700 underline decoration-indigo-300/80 underline-offset-2 hover:text-indigo-900"
          >
            Notatniku → Archiwum
          </Link>
          .
        </>
      ) : (
        <>
          Zamknięte sprawy ZK są w{" "}
          <Link
            href={otherHref}
            className="font-medium text-indigo-700 underline decoration-indigo-300/80 underline-offset-2 hover:text-indigo-900"
          >
            ZK czekające → Archiwum
          </Link>
          .
        </>
      )}
    </p>
  );
}
