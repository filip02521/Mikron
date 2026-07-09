"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/cn";
import { formatProsbaZkLinkNumber } from "@/lib/orders/zk-prosba-link-display";
import { notatnikZkWatchHref } from "@/lib/orders/notatnik-zk-watch-href";
import { SearchHighlightText } from "@/components/moje/SearchHighlightText";
import { salesTypography, salesZkLabelClass, salesZkNumberClass } from "@/lib/ui/ontime-theme";

const ZK_NAV_PENDING_LABEL = "Przechodzę do ZK:";

function zkPendingMessage(nr: string): string {
  return `${ZK_NAV_PENDING_LABEL} ${nr}`;
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

  const numberEl =
    searchQuery != null ? (
      <SearchHighlightText text={nr} searchQuery={searchQuery} className={salesZkNumberClass} />
    ) : (
      <span className={salesZkNumberClass}>{nr}</span>
    );

  const linkedNumber = resolvedHref ? (
    <Link
      href={resolvedHref}
      onClick={handleNavigate}
      className="inline-flex min-w-0 max-w-full items-center truncate text-inherit hover:text-violet-800 hover:underline"
      title={`Otwórz ZK ${nr} w ZK czekających`}
    >
      {numberEl}
    </Link>
  ) : (
    numberEl
  );

  const content = pending ? (
    <span
      className="inline-flex min-w-0 max-w-full items-center gap-1.5 text-[11px] text-violet-800"
      role="status"
      aria-busy="true"
      aria-label={zkPendingMessage(nr)}
      title={zkPendingMessage(nr)}
    >
      <Spinner size="sm" className="shrink-0 border-slate-200 border-t-violet-600" />
      <span className="shrink-0 text-[11px] font-medium leading-none">{ZK_NAV_PENDING_LABEL}</span>
      <span className={cn(salesZkNumberClass, "min-w-0 truncate tabular-nums")}>{nr}</span>
    </span>
  ) : (
    <span className="inline-flex max-w-full min-w-0 items-center gap-1.5 leading-none">
      <span className={cn(salesZkLabelClass, "items-center gap-0.5")}>
        <svg viewBox="0 0 16 16" className="size-3" fill="currentColor" aria-hidden>
          <path d="M4 2a1 1 0 0 0-1 1v11a1 1 0 0 0 1.6.8L8 12.5l3.4 2.3a1 1 0 0 0 1.6-.8V3a1 1 0 0 0-1-1H4Zm0 1h8v11L8 11.5 4 14V3Z" />
        </svg>
        ZK
      </span>
      {linkedNumber}
    </span>
  );

  const wrapperClass = cn(inline ? "inline-flex items-center min-w-0" : salesTypography.rowMeta, "max-w-full", className);

  if (!nr) return null;

  if (inline) {
    return (
      <span className={wrapperClass} aria-live={pending ? "polite" : undefined}>
        {content}
      </span>
    );
  }

  return (
    <p
      className={cn(wrapperClass, pending ? "min-w-0" : "truncate")}
      aria-live={pending ? "polite" : undefined}
    >
      {content}
    </p>
  );
}
