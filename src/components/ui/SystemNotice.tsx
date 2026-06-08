import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import {
  systemNoticeActionClass,
  systemNoticePinnedClass,
  systemNoticeTourClass,
} from "@/lib/ui/ontime-theme";

export type SystemNoticeVariant = "pinned" | "action" | "tour";

const VARIANT_CLASS: Record<SystemNoticeVariant, string> = {
  pinned: systemNoticePinnedClass,
  action: systemNoticeActionClass,
  tour: systemNoticeTourClass,
};

export function SystemNotice({
  variant = "action",
  title,
  description,
  icon,
  action,
  href,
  actionLabel,
  onAction,
  className,
  sticky = false,
  role = "status",
}: {
  variant?: SystemNoticeVariant;
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  /** Własna akcja (np. checkbox + przycisk). */
  action?: ReactNode;
  /** Prosty link/przycisk po prawej. */
  href?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
  sticky?: boolean;
  role?: "status" | "alert";
}) {
  const actionNode =
    action ??
    (href ? (
      href.startsWith("/") ? (
        <Link
          href={href}
          className="shrink-0 text-sm font-medium text-indigo-700 transition hover:text-indigo-950 hover:underline"
        >
          {actionLabel ?? "Zobacz"}
        </Link>
      ) : (
        <a
          href={href}
          className="shrink-0 text-sm font-medium text-indigo-700 transition hover:text-indigo-950 hover:underline"
        >
          {actionLabel ?? "Zobacz"}
        </a>
      )
    ) : onAction ? (
      <Button type="button" size="sm" className="min-h-10 shrink-0" onClick={onAction}>
        {actionLabel ?? "OK"}
      </Button>
    ) : null);

  return (
    <div
      role={role}
      aria-live={variant === "tour" ? "polite" : undefined}
      className={cn(
        VARIANT_CLASS[variant],
        sticky && variant === "tour" && "sticky top-0 z-30 md:top-2",
        className
      )}
    >
      <div className="flex min-w-0 items-start gap-2">
        {icon ? <span className="mt-0.5 shrink-0 text-indigo-500">{icon}</span> : null}
        <div className="min-w-0">
          <p
            className={cn(
              "text-sm leading-snug",
              variant === "tour"
                ? "font-semibold text-white"
                : variant === "pinned"
                  ? "min-w-0 font-normal text-slate-900"
                  : "font-semibold text-slate-900"
            )}
          >
            {title}
          </p>
          {description ? (
            <p
              className={cn(
                "mt-0.5 text-xs leading-relaxed",
                variant === "tour" ? "text-indigo-100" : "text-slate-600"
              )}
            >
              {description}
            </p>
          ) : null}
        </div>
      </div>
      {actionNode ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actionNode}</div> : null}
    </div>
  );
}
