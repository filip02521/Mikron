"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/cn";
import { formatProsbaZkLinkNumber } from "@/lib/orders/zk-prosba-link-display";
import { notatnikZkWatchHref } from "@/lib/orders/notatnik-zk-watch-href";
import { SearchHighlightText } from "@/components/moje/SearchHighlightText";
import { salesTypography } from "@/lib/ui/ontime-theme";

const ZK_LABEL_CLASS =
  "inline-flex items-center rounded bg-slate-100 px-1 py-0.5 font-semibold uppercase tracking-wide text-slate-500";

function zkNavigationMessage(nr: string): string {
  return `Otwieram ZK ${nr} na liście ZK czekających…`;
}

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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [navEpoch, setNavEpoch] = useState(0);
  const [navFromPath, setNavFromPath] = useState(pathname);
  const pending = navEpoch > 0 && pathname === navFromPath;

  useEffect(() => {
    if (!pending) return;
    const timeout = window.setTimeout(() => setNavEpoch(0), 12_000);
    return () => clearTimeout(timeout);
  }, [pending, navEpoch]);
  const previewDla = searchParams.get("dla");
  const nr = formatProsbaZkLinkNumber(zkNumber);

  const resolvedHref =
    href ??
    notatnikZkWatchHref(zkWatchId, {
      salesPersonId,
      previewDla,
    });

  const handleNavigate = useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>) => {
      event.stopPropagation();
      if (
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        event.button !== 0 ||
        !resolvedHref ||
        pending
      ) {
        return;
      }
      event.preventDefault();
      setNavFromPath(pathname);
      setNavEpoch((epoch) => epoch + 1);
      router.push(resolvedHref);
    },
    [pathname, pending, resolvedHref, router]
  );

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
      onClick={handleNavigate}
      className={cn(
        "inline max-w-full min-w-0 truncate text-inherit",
        pending
          ? "pointer-events-none text-indigo-800"
          : "hover:text-indigo-800 hover:underline"
      )}
      aria-busy={pending}
      title={pending ? zkNavigationMessage(nr) : `Otwórz ZK ${nr} w ZK czekających`}
    >
      {pending ? (
        <span className="inline-flex max-w-full min-w-0 items-center gap-1.5">
          <Spinner size="sm" className="border-slate-200 border-t-indigo-600" />
          <span className="truncate font-medium">{zkNavigationMessage(nr)}</span>
        </span>
      ) : (
        numberEl
      )}
    </Link>
  ) : (
    numberEl
  );

  const content = (
    <>
      <span className={ZK_LABEL_CLASS}>ZK</span> {linkedNumber}
    </>
  );

  const wrapperClass = cn(inline ? "inline min-w-0" : salesTypography.rowMeta, "max-w-full", className);

  if (!nr) return null;

  if (inline) {
    return (
      <span className={wrapperClass} aria-live={pending ? "polite" : undefined}>
        {content}
      </span>
    );
  }

  return (
    <p className={cn(wrapperClass, "truncate")} aria-live={pending ? "polite" : undefined}>
      {content}
    </p>
  );
}
