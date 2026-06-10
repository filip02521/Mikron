"use client";

import { cn } from "@/lib/cn";
import {
  mojeDestructiveOutlineControlClass,
  mojeDestructiveSubtleControlClass,
} from "@/lib/ui/ontime-theme";

/** Anulowanie pojedynczej pozycji — spójne z kontrolkami /moje. */
export function MyOrderCancelButton({
  children,
  onClick,
  disabled,
  className,
  title,
  ariaLabel,
  variant = "subtle",
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  title?: string;
  ariaLabel?: string;
  variant?: "subtle" | "outline";
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      title={title ?? ariaLabel}
      aria-label={ariaLabel}
      onClick={onClick}
      className={cn(
        variant === "outline"
          ? mojeDestructiveOutlineControlClass
          : mojeDestructiveSubtleControlClass,
        className
      )}
    >
      {children}
    </button>
  );
}
