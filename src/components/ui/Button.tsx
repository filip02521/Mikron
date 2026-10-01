import { forwardRef } from "react";
import { cn } from "@/lib/cn";
import { buttonPrimaryClass } from "@/lib/ui/ontime-theme";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "outline";

const variants: Record<ButtonVariant, string> = {
  primary: buttonPrimaryClass,
  secondary:
    "border border-neutral-200 bg-[var(--card)] text-neutral-800 hover:bg-neutral-50",
  outline:
    "border border-neutral-200 bg-transparent text-neutral-800 hover:bg-neutral-50",
  ghost: "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900",
  danger: "bg-red-600 text-white hover:bg-red-700",
};

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
  const sizes = {
    sm: "px-2.5 py-1.5 text-xs rounded-md leading-none",
    md: "px-4 py-2 text-sm rounded-md",
    lg: "px-5 py-2.5 text-base rounded-md",
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
