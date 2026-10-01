import { cn } from "@/lib/cn";

export function Badge({
  children,
  variant = "default",
  className,
}: {
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "info" | "purple" | "danger";
  className?: string;
}) {
  const styles = {
    default: "border-neutral-200 bg-white text-neutral-600",
    success: "border-neutral-200 bg-white text-emerald-700",
    warning: "border-neutral-200 bg-white text-amber-700",
    info: "border-neutral-200 bg-white text-neutral-700",
    purple: "border-neutral-200 bg-white text-neutral-700",
    danger: "border-neutral-200 bg-white text-red-700",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
        styles[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
