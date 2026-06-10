"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/cn";
import { formatProsbaZkLinkNumber } from "@/lib/orders/zk-prosba-link-display";
import { notatnikZkWatchHref } from "@/lib/orders/notatnik-zk-watch-href";
import { SearchHighlightText } from "@/components/moje/SearchHighlightText";
import { salesTypography } from "@/lib/ui/ontime-theme";

const ZK_LABEL_CLASS =
  "inline-flex items-center rounded bg-slate-100 px-1 py-0.5 font-semibold uppercase tracking-wide text-slate-500";

export function ZkProsbaLinkChip({
  zkNumber,
  zkWatchId,
  salesPersonId,
  href,
  searchQuery,
  className,
  inline = false,
}: {
  zkNumber: string;
  zkWatchId?: string | null;
  salesPersonId?: string | null;
  href?: string | null;
  searchQuery?: string | null;
  className?: string;
  /** Jedna linia tekstu (np. w banerze) zamiast bloku meta pod wierszem. */
  inline?: boolean;
}) {
  const searchParams = useSearchParams();
  const previewDla = searchParams.get("dla");
  const nr = formatProsbaZkLinkNumber(zkNumber);
  if (!nr) return null;

  const resolvedHref =
    href ??
    notatnikZkWatchHref(zkWatchId, {
      salesPersonId,
      previewDla,
    });

  const numberClass = "font-medium tabular-nums text-slate-800";
  const numberEl =
    searchQuery != null ? (
      <SearchHighlightText text={nr} searchQuery={searchQuery} className={numberClass} />
    ) : (
      <span className={numberClass}>{nr}</span>
    );

  const linkedNumber = resolvedHref ? (
    <Link
      href={resolvedHref}
      className="inline max-w-full min-w-0 truncate text-inherit hover:text-indigo-800 hover:underline"
      title={`Otwórz ZK ${nr} w notatniku`}
    >
      {numberEl}
    </Link>
  ) : (
    numberEl
  );

  const content = (
    <>
      <span className={ZK_LABEL_CLASS}>ZK</span> {linkedNumber}
    </>
  );

  if (inline) {
    return <span className={cn("inline min-w-0", className)}>{content}</span>;
  }

  return (
    <p className={cn(salesTypography.rowMeta, "max-w-full truncate", className)}>{content}</p>
  );
}
