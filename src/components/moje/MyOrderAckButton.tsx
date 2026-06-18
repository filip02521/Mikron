"use client";

import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import {
  mojeAckSegmentCancelClass,
  mojeAckSegmentInformacjaClass,
  mojeAckSegmentLabelClass,
  mojeAckSegmentOutlineClass,
  mojeAckSegmentPrimaryClass,
  mojeCancelAckControlClass,
  mojeControlHeightClass,
  mojeInformacjaAckControlClass,
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
  variant?:
    | "banner"
    | "bannerInformacja"
    | "inline"
    | "action"
    | "informacjaAck"
    | "segmentPrimary"
    | "segmentInformacja"
    | "segmentCancel"
    | "segmentOutline"
    | "cancelAck";
  className?: string;
  title?: string;
  ariaLabel?: string;
  /** Tour — pełny wygląd przycisku bez akcji (podgląd). */
  preview?: boolean;
}) {
  const accessibleName = ariaLabel ?? title;

  const segmentLabel = (content: React.ReactNode) => (
    <span className={mojeAckSegmentLabelClass}>{content}</span>
  );

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
    if (variant === "informacjaAck" || variant === "segmentInformacja") {
      return (
        <span
          role="img"
          aria-label={previewTitle}
          title={previewTitle}
          className={cn(mojeInformacjaAckControlClass, className)}
        >
          {children}
        </span>
      );
    }
    if (variant === "cancelAck" || variant === "segmentCancel") {
      return (
        <span
          role="img"
          aria-label={previewTitle}
          title={previewTitle}
          className={cn(mojeCancelAckControlClass, className)}
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

  if (variant === "bannerInformacja") {
    return (
      <button
        type="button"
        disabled={disabled}
        title={title}
        aria-label={accessibleName}
        onClick={onClick}
        className={cn(mojeSecondaryControlClass, "text-violet-800", className)}
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
        {segmentLabel(children)}
      </button>
    );
  }

  if (variant === "segmentInformacja") {
    return (
      <button
        type="button"
        disabled={disabled}
        title={title}
        aria-label={accessibleName}
        onClick={onClick}
        className={cn(mojeAckSegmentInformacjaClass, className)}
      >
        {segmentLabel(children)}
      </button>
    );
  }

  if (variant === "segmentCancel") {
    return (
      <button
        type="button"
        disabled={disabled}
        title={title}
        aria-label={accessibleName}
        onClick={onClick}
        className={cn(mojeAckSegmentCancelClass, className)}
      >
        {segmentLabel(children)}
      </button>
    );
  }

  if (variant === "cancelAck") {
    return (
      <button
        type="button"
        disabled={disabled}
        title={title}
        aria-label={accessibleName}
        onClick={onClick}
        className={cn(mojeCancelAckControlClass, className)}
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
        {segmentLabel(children)}
      </button>
    );
  }

  if (variant === "informacjaAck") {
    return (
      <button
        type="button"
        disabled={disabled}
        title={title}
        aria-label={accessibleName}
        onClick={onClick}
        className={cn(mojeInformacjaAckControlClass, className)}
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
