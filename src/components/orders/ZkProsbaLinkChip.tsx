"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { IconCheck, IconCopy } from "@/components/icons/StrokeIcons";
import { copyTextToClipboard } from "@/lib/ui/copy-text-to-clipboard";
import { cn } from "@/lib/cn";
import { formatProsbaZkLinkNumber } from "@/lib/orders/zk-prosba-link-display";
import { notatnikZkWatchHref } from "@/lib/orders/notatnik-zk-watch-href";
import { SearchHighlightText } from "@/components/moje/SearchHighlightText";
import { salesTypography, salesZkLabelClass, salesZkNumberClass } from "@/lib/ui/ontime-theme";
import { BrandLoader } from "@/components/ui/BrandLoader";

const ZK_NAV_PENDING_LABEL = "Przechodzę do ZK:";

const chipToneStyles = {
  violet: {
    label: salesZkLabelClass,
    number: salesZkNumberClass,
    pending: "text-violet-800",
    linkHover: "hover:text-violet-800",
  },
  amber: {
    label:
      "inline-flex items-center rounded-md bg-amber-100/90 px-1.5 py-0.5 text-[0.625rem] font-medium leading-none text-amber-900 ring-1 ring-inset ring-amber-200/80",
    number: "text-[0.6875rem] font-semibold leading-none text-amber-950",
    pending: "text-amber-900",
    linkHover: "hover:text-amber-950",
  },
} as const;

type CopyState = "idle" | "copied" | "failed";

/**
 * Kopiuje pełny numer ZK (jak dok_NrPelny w Subiekcie). Nie rozwija karty ani nie nawiguje;
 * potwierdzenie w dymku nad przyciskiem — bez przesuwania wiersza.
 */
function ZkNumberCopyButton({ nr }: { nr: string }) {
  const [state, setState] = useState<CopyState>("idle");
  const buttonRef = useRef<HTMLButtonElement>(null);
  const fullNumber = `ZK ${nr}`;

  useEffect(() => {
    if (state === "idle") return;
    const t = window.setTimeout(() => setState("idle"), state === "copied" ? 1600 : 3000);
    return () => window.clearTimeout(t);
  }, [state]);

  const copy = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const ok = await copyTextToClipboard(fullNumber);
    // Zapasowe kopiowanie (http w LAN) przenosi fokus na ukryte pole — oddaj go przyciskowi.
    if (document.activeElement !== buttonRef.current) buttonRef.current?.focus({ preventScroll: true });
    setState(ok ? "copied" : "failed");
  };

  const label =
    state === "copied"
      ? `Skopiowano ${fullNumber}`
      : state === "failed"
        ? "Nie udało się skopiować - zaznacz numer ręcznie"
        : `Kopiuj numer ${fullNumber}`;

  return (
    <span className="relative inline-flex shrink-0">
      <button
        ref={buttonRef}
        type="button"
        onClick={copy}
        // Enter / Spacja kopiują — nie mogą też uruchomić akcji rodzica; inne klawisze
        // (np. „/” wyszukiwania, Ctrl+Z) przechodzą do skrótów strony.
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") event.stopPropagation();
        }}
        aria-label={label}
        title={label}
        className={cn(
          "-my-1 inline-flex size-7 items-center justify-center rounded-md text-slate-400 sm:size-6",
          "transition-[color,background-color,scale] duration-150 ease-out active:scale-[0.94]",
          "hover:bg-slate-100 hover:text-slate-700",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600",
          state === "copied" && "text-emerald-600 hover:text-emerald-700",
          state === "failed" && "text-red-600 hover:text-red-700"
        )}
      >
        {state === "copied" ? (
          <IconCheck size={14} strokeWidth={2.5} />
        ) : (
          <IconCopy size={13} strokeWidth={2} />
        )}
      </button>
      {state !== "idle" ? (
        <span
          role="status"
          className={cn(
            "pointer-events-none absolute bottom-full left-1/2 z-20 mb-1 -translate-x-1/2 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[0.6875rem] font-medium text-white shadow-sm",
            "transition-[opacity,translate] duration-150 ease-out starting:translate-y-0.5 starting:opacity-0",
            state === "copied" ? "bg-slate-900" : "bg-red-700"
          )}
        >
          {state === "copied" ? "Skopiowano" : "Nie udało się skopiować"}
        </span>
      ) : null}
    </span>
  );
}

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
  copyable = false,
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
  /** Przycisk kopiowania numeru obok (np. „Moje zamówienia”). */
  copyable?: boolean;
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
        "inline-flex min-w-0 max-w-full items-center gap-1.5 text-[0.6875rem]",
        styles.pending
      )}
      role="status"
      aria-busy="true"
      aria-label={zkPendingMessage(nr)}
      title={zkPendingMessage(nr)}
    >
      <BrandLoader size="sm" tile={false} />
      <span className="shrink-0 text-[0.6875rem] font-medium leading-none">{ZK_NAV_PENDING_LABEL}</span>
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
      {copyable ? <ZkNumberCopyButton nr={nr} /> : null}
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
