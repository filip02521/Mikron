"use client";

import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import {
  mojeAckSegmentOutlineClass,
  mojeAckSegmentPrimaryClass,
  panelSegmentLastClass,
  salesTouchTargetClass,
} from "@/lib/ui/ontime-theme";

/** Kompaktowe potwierdzenie odbioru / powiadomienia — spójne z kartami w /moje. */
export function MyOrderAckButton({
  children,
  onClick,
  disabled,
  variant = "inline",
  className,
  title,
  ariaLabel,
  preview,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  variant?: "banner" | "inline" | "action" | "segmentPrimary" | "segmentOutline";
  className?: string;
  title?: string;
  ariaLabel?: string;
  /** Tour — pełny wygląd przycisku bez akcji (podgląd). */
  preview?: boolean;
}) {
  const accessibleName = ariaLabel ?? title;

  if (preview) {
    const previewTitle = title ?? "Podgląd w tourze — po wprowadzeniu potwierdzisz odbiór tutaj";
    if (variant === "banner") {
      return (
        <span
          role="img"
          aria-label={previewTitle}
          title={previewTitle}
          className={cn(
            "shrink-0 rounded-md bg-white px-2 py-1 text-xs font-semibold text-emerald-800 shadow-sm ring-1 ring-white/90",
            className
          )}
        >
          {children}
        </span>
      );
    }
    if (variant === "action" || variant === "segmentPrimary") {
      return (
        <span
          role="img"
          aria-label={previewTitle}
          title={previewTitle}
          className={cn(
            "inline-flex min-h-8 shrink-0 items-center justify-center rounded-md border border-emerald-700 bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white shadow-sm",
            className
          )}
        >
          {children}
        </span>
      );
    }
    if (variant === "segmentOutline") {
      return (
        <span
          role="img"
          aria-label={previewTitle}
          title={previewTitle}
          className={cn(mojeAckSegmentOutlineClass, panelSegmentLastClass, className)}
        >
          {children}
        </span>
      );
    }
    return (
      <span
        role="img"
        aria-label={previewTitle}
        title={previewTitle}
        className={cn(
          "inline-flex min-h-8 items-center justify-center rounded-md border border-emerald-200 bg-white px-2.5 py-1 text-xs font-semibold text-emerald-800 shadow-sm",
          className
        )}
      >
        {children}
      </span>
    );
  }

  if (variant === "banner") {
    return (
      <button
        type="button"
        disabled={disabled}
        title={title}
        aria-label={accessibleName}
        onClick={onClick}
        className={cn(
          "min-h-11 shrink-0 cursor-pointer rounded-md bg-white px-2.5 py-1 text-xs font-semibold text-emerald-800 shadow-sm ring-1 ring-white/90 transition-colors hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-8",
          className
        )}
      >
        {children}
      </button>
    );
  }

  if (variant === "segmentPrimary") {
    return (
      <button
        type="button"
        disabled={disabled}
        title={title}
        aria-label={accessibleName}
        onClick={onClick}
        className={cn(mojeAckSegmentPrimaryClass, className)}
      >
        {children}
      </button>
    );
  }

  if (variant === "segmentOutline") {
    return (
      <button
        type="button"
        disabled={disabled}
        title={title}
        aria-label={accessibleName}
        onClick={onClick}
        className={cn(mojeAckSegmentOutlineClass, className)}
      >
        {children}
      </button>
    );
  }

  if (variant === "action") {
    return (
      <button
        type="button"
        disabled={disabled}
        title={title}
        aria-label={accessibleName}
        onClick={onClick}
        className={cn(
          "inline-flex min-h-11 shrink-0 cursor-pointer items-center justify-center rounded-md border border-emerald-700 bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-8",
          className
        )}
      >
        {children}
      </button>
    );
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={disabled}
      title={title}
      aria-label={accessibleName}
      onClick={onClick}
      className={cn(salesTouchTargetClass, "px-2.5 text-xs font-semibold", className)}
    >
      {children}
    </Button>
  );
}
