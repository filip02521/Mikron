import Link from "next/link";
import type { ButtonHTMLAttributes, MouseEvent, ReactNode } from "react";
import { LinkChevron } from "@/components/ui/UiGlyphs";
import { cn } from "@/lib/cn";

export type PageAttentionStripTone = "amber" | "violet";
export type PageAttentionStripEdge = "inset" | "flush";
export type PageAttentionStripDensity = "comfortable" | "compact";

const TONE_SHELL: Record<PageAttentionStripTone, string> = {
  amber: "border-amber-200/70 bg-amber-50/80",
  violet: "border-violet-200/60 bg-violet-50/80",
};

const TONE_ICON: Record<PageAttentionStripTone, string> = {
  amber: "bg-amber-100/90 text-amber-800",
  violet: "bg-violet-100/90 text-violet-800",
};

const TONE_TITLE: Record<PageAttentionStripTone, string> = {
  amber: "text-amber-950",
  violet: "text-violet-950",
};

const TONE_CTA: Record<PageAttentionStripTone, string> = {
  amber:
    "border-amber-200/80 bg-white/90 text-amber-950 hover:bg-amber-50/90",
  violet:
    "border-violet-200/80 bg-white/90 text-violet-950 hover:bg-violet-50/90",
};

/**
 * Płaski pasek uwagi (page-level) — ikona | tytuł — hint | CTA.
 * Bez elevated shadow (nie wygląda jak karta).
 */
export function PageAttentionStrip({
  tone = "amber",
  icon,
  title,
  hint,
  actions,
  edge = "inset",
  density = "comfortable",
  className,
  role = "status",
}: {
  tone?: PageAttentionStripTone;
  icon: ReactNode;
  title: ReactNode;
  hint?: ReactNode;
  actions?: ReactNode;
  edge?: PageAttentionStripEdge;
  density?: PageAttentionStripDensity;
  className?: string;
  role?: "status" | "alert";
}) {
  const compact = density === "compact";

  return (
    <div
      role={role}
      className={cn(
        "flex flex-wrap items-center justify-between gap-3",
        TONE_SHELL[tone],
        edge === "inset" && "rounded-md border",
        edge === "flush" && "rounded-none border border-x-0 border-t-0",
        compact ? "gap-2 px-2.5 py-2 sm:px-3" : "px-3 py-2.5 sm:px-4",
        className
      )}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <span
          className={cn(
            "flex shrink-0 items-center justify-center rounded-md",
            TONE_ICON[tone],
            compact ? "h-7 w-7" : "h-8 w-8"
          )}
          aria-hidden
        >
          {icon}
        </span>
        <p
          className={cn(
            "min-w-0 leading-snug text-slate-800",
            compact ? "text-xs sm:text-sm" : "text-sm"
          )}
        >
          <span className={cn("font-semibold", TONE_TITLE[tone])}>{title}</span>
          {hint != null && hint !== "" ? (
            <span className="text-slate-600"> — {hint}</span>
          ) : null}
        </p>
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">{actions}</div>
      ) : null}
    </div>
  );
}

type CtaCommon = {
  tone?: PageAttentionStripTone;
  density?: PageAttentionStripDensity;
  className?: string;
  children: ReactNode;
  chevron?: boolean;
};

/** Chip CTA (link lub button) spójny z PageAttentionStrip. */
export function PageAttentionStripCta({
  tone = "amber",
  density = "comfortable",
  className,
  children,
  chevron = true,
  href,
  onClick,
  type = "button",
  "aria-label": ariaLabel,
}: CtaCommon & {
  href?: string;
  onClick?: (event: MouseEvent<HTMLElement>) => void;
  type?: ButtonHTMLAttributes<HTMLButtonElement>["type"];
  "aria-label"?: string;
}) {
  const compact = density === "compact";
  const classes = cn(
    "inline-flex shrink-0 items-center gap-1 rounded-md border px-2.5 text-xs font-medium transition",
    TONE_CTA[tone],
    compact ? "h-7" : "h-8",
    className
  );

  if (href != null) {
    return (
      <Link
        href={href}
        className={classes}
        aria-label={ariaLabel}
        onClick={onClick}
      >
        {children}
        {chevron ? <LinkChevron size={13} tone="muted" /> : null}
      </Link>
    );
  }

  return (
    <button
      type={type}
      className={classes}
      onClick={onClick}
      aria-label={ariaLabel}
    >
      {children}
      {chevron ? <LinkChevron size={13} tone="muted" /> : null}
    </button>
  );
}
