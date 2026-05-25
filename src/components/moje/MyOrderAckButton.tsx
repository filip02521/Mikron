"use client";

import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

/** Kompaktowe potwierdzenie odbioru / powiadomienia — spójne z kartami w /moje. */
export function MyOrderAckButton({
  children,
  onClick,
  disabled,
  variant = "inline",
  className,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  variant?: "banner" | "inline" | "action";
  className?: string;
  title?: string;
}) {
  if (variant === "banner") {
    return (
      <button
        type="button"
        disabled={disabled}
        title={title}
        onClick={onClick}
        className={cn(
          "shrink-0 cursor-pointer rounded-lg bg-white px-2.5 py-1 text-xs font-semibold text-emerald-800 shadow-sm ring-1 ring-white/90 transition-colors hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
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
        onClick={onClick}
        className={cn(
          "inline-flex min-h-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-emerald-700 bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50",
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
      onClick={onClick}
      className={cn("min-h-8 font-semibold", className)}
    >
      {children}
    </Button>
  );
}
