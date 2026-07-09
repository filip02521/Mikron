import { cn } from "@/lib/cn";
import { IconCircleCheck } from "@/components/icons/StrokeIcons";

export function MyOrderSectionEmptyState({
  message,
  className,
}: {
  message: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 border-b border-slate-100 px-3 py-4 sm:px-4",
        className
      )}
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
        <IconCircleCheck size={16} />
      </span>
      <p className="text-sm leading-relaxed text-slate-500">
        {message}
      </p>
    </div>
  );
}
