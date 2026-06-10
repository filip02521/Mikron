import { cn } from "@/lib/cn";
import { salesTypography } from "@/lib/ui/ontime-theme";

export function LoginQuickAccountGreeting({
  displayName,
  className,
}: {
  displayName: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-md border border-indigo-100/90 bg-indigo-50/55 px-4 py-3.5 text-center",
        className
      )}
    >
      <p className={cn(salesTypography.sectionLabel, "text-indigo-700/85")}>Logowanie</p>
      <p className="mt-1 text-lg font-semibold tracking-tight text-slate-900 sm:text-xl">
        Cześć, {displayName}
      </p>
    </div>
  );
}
