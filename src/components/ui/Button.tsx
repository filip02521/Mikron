import { forwardRef } from "react";
import { cn } from "@/lib/cn";
import { buttonPrimaryClass } from "@/lib/ui/ontime-theme";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";

const variants: Record<Variant, string> = {
  primary: buttonPrimaryClass,
  secondary:
    "border border-[var(--card-border)] bg-[var(--card)] text-slate-700 shadow-sm hover:bg-slate-50",
  outline:
    "border border-indigo-200/90 bg-[var(--primary-muted)]/60 text-indigo-800 hover:bg-[var(--primary-muted)]",
  ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
  danger: "bg-red-600 text-white hover:bg-red-700",
};

export const Button = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: Variant;
    size?: "sm" | "md" | "lg";
  }
>(function Button(
  { children, variant = "primary", className, size = "md", type = "button", ...props },
  ref
) {
  const sizes = {
    sm: "px-3 py-1.5 text-xs rounded-xl",
    md: "px-4 py-2 text-sm rounded-xl",
    lg: "px-5 py-2.5 text-base rounded-xl",
  };
  return (
    <button
      ref={ref}
      className={cn(
        "inline-flex cursor-pointer items-center justify-center gap-2 font-medium transition-colors disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        sizes[size],
        className
      )}
      type={type}
      {...props}
    >
      {children}
    </button>
  );
});
