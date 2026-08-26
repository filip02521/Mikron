import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Stos page-level powiadomień — równy gap, bez schodków mb na dzieciach.
 * Pusty (same null children) → `:empty` + `empty:hidden` (brak dziury).
 */
export function PageNoticeStack({
  children,
  spaceAfter = true,
  className,
  "aria-label": ariaLabel = "Powiadomienia",
}: {
  children: ReactNode;
  /** Odstęp pod stackiem od treści strony (AppShell). Panel tabs→toolbar: false. */
  spaceAfter?: boolean;
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <div
      role="region"
      aria-label={ariaLabel}
      className={cn(
        "flex flex-col gap-2 empty:hidden sm:gap-2.5",
        "[&>*]:mb-0",
        spaceAfter && "mb-3 sm:mb-4",
        className
      )}
    >
      {children}
    </div>
  );
}
