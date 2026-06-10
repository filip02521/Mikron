"use client";

import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import {
  mojeAckSegmentOutlineClass,
  mojeAckSegmentPrimaryClass,
  mojeControlHeightClass,
  mojePickupControlClass,
  mojeSecondaryControlClass,
  panelSegmentLastClass,
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
          className={cn(mojeSecondaryControlClass, "text-emerald-800", className)}
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
          className={cn(mojePickupControlClass, className)}
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
        className={cn(mojeSecondaryControlClass, "text-emerald-800", className)}
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
        className={cn(mojeSecondaryControlClass, "text-emerald-800", className)}
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
        className={cn(mojePickupControlClass, className)}
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
      className={cn(mojeControlHeightClass, "px-3 text-xs font-semibold text-emerald-800", className)}
    >
      {children}
    </Button>
  );
}
