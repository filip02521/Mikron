import { forwardRef } from "react";
import { cn } from "@/lib/cn";
import { buttonPrimaryClass } from "@/lib/ui/ontime-theme";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "outline";

const variants: Record<ButtonVariant, string> = {
  primary: buttonPrimaryClass,
  secondary:
    "border border-[var(--card-border)] bg-[var(--card)] text-slate-700 shadow-sm hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900",
  outline:
    "border border-indigo-200/90 bg-[var(--primary-muted)]/60 text-indigo-800 hover:bg-[var(--primary-muted)]",
  ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
  danger: "bg-red-600 text-white hover:bg-red-700",
};

const sizes = {
  sm: "px-2.5 py-1.5 text-xs rounded-md leading-none",
  md: "px-4 py-2 text-sm rounded-md",
  lg: "px-5 py-2.5 text-base rounded-md",
};

/** Klasy przycisku — także dla linku, który wygląda jak przycisk (np. „Przygotuj ZD” w wierszu). */
export function buttonClass(variant: ButtonVariant = "primary", size: "sm" | "md" | "lg" = "md", className?: string): string {
  return cn(
    "inline-flex cursor-pointer items-center justify-center gap-2 font-medium transition-[color,background-color,border-color,box-shadow,scale] duration-150 ease-out active:scale-[0.97] active:duration-75 motion-reduce:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-50",
    variants[variant],
    sizes[size],
    className
  );
}

export const Button = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: ButtonVariant;
    size?: "sm" | "md" | "lg";
  }
>(function Button(
  { children, variant = "primary", className, size = "md", type = "button", ...props },
  ref
) {
  return (
    <button
      ref={ref}
      className={buttonClass(variant, size, className)}
      type={type}
      {...props}
    >
      {children}
    </button>
  );
});
