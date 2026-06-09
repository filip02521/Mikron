import { cn } from "@/lib/cn";

export function MyOrderSectionEmptyState({
  message,
  className,
}: {
  message: string;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "border-b border-slate-100 px-3 py-4 text-sm leading-relaxed text-slate-500 sm:px-4",
        className
      )}
    >
      {message}
    </p>
  );
}
