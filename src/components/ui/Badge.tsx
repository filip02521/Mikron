import { cn } from "@/lib/cn";

/** Cichy tag statusu: płaskie tło, bez ringu; kolor tylko dla stanów semantycznych. */
export function Badge({
  children,
  variant = "default",
  className,
}: {
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "info" | "danger";
  className?: string;
}) {
  const styles = {
    default: "bg-slate-100 text-slate-700",
    success: "bg-emerald-50 text-emerald-800",
    warning: "bg-amber-50 text-amber-900",
    info: "bg-indigo-50 text-indigo-800",
    danger: "bg-red-50 text-red-800",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium tabular-nums",
        styles[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
