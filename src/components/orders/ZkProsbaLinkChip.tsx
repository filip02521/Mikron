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

const chipToneStyles = {
  violet: {
    label: salesZkLabelClass,
    number: salesZkNumberClass,
    pending: "text-violet-800",
    spinner: "border-slate-200 border-t-violet-600",
    linkHover: "hover:text-violet-800",
  },
  amber: {
    label:
      "inline-flex items-center rounded-md bg-amber-100/90 px-1.5 py-0.5 text-[10px] font-medium leading-none text-amber-900 ring-1 ring-inset ring-amber-200/80",
    number: "text-[11px] font-semibold leading-none text-amber-950",
    pending: "text-amber-900",
    spinner: "border-amber-200 border-t-amber-700",
    linkHover: "hover:text-amber-950",
  },
} as const;

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
  tone = "violet",
}: {
  zkNumber: string;
  zkWatchId?: string | null;
  salesPersonId?: string | null;
  href?: string | null;
  searchQuery?: string | null;
  className?: string;
  /** Jedna linia tekstu (np. w banerze) zamiast bloku meta pod wierszem. */
  inline?: boolean;
  /** Dopasowanie koloru chipa do otoczenia (np. baner uzupełnienia ZK). */
  tone?: keyof typeof chipToneStyles;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [navEpoch, setNavEpoch] = useState(0);
  const [navFromPath, setNavFromPath] = useState(pathname);
  const pending = navEpoch > 0 && pathname === navFromPath;
  const styles = chipToneStyles[tone];

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
      <SearchHighlightText text={nr} searchQuery={searchQuery} className={styles.number} />
    ) : (
      <span className={styles.number}>{nr}</span>
    );

  const linkedNumber = resolvedHref ? (
    <Link
      href={resolvedHref}
      onClick={handleNavigate}
      className={cn(
        "inline-flex min-w-0 max-w-full items-center truncate text-inherit underline-offset-2 hover:underline",
        styles.linkHover
      )}
      title={`Otwórz ZK ${nr} w ZK czekających`}
    >
      {numberEl}
    </Link>
  ) : (
    numberEl
  );

  const content = pending ? (
    <span
      className={cn(
        "inline-flex min-w-0 max-w-full items-center gap-1.5 text-[11px]",
        styles.pending
      )}
      role="status"
      aria-busy="true"
      aria-label={zkPendingMessage(nr)}
      title={zkPendingMessage(nr)}
    >
      <Spinner size="sm" className={cn("shrink-0", styles.spinner)} />
      <span className="shrink-0 text-[11px] font-medium leading-none">{ZK_NAV_PENDING_LABEL}</span>
      <span className={cn(styles.number, "min-w-0 truncate tabular-nums")}>{nr}</span>
    </span>
  ) : (
    <span className="inline-flex max-w-full min-w-0 items-center gap-1.5 leading-none">
      <span className={cn(styles.label, "items-center gap-0.5")}>
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
