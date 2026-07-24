import { loginAccountRoleDotClass } from "@/components/auth/login-account-picker-layout";
import { cn } from "@/lib/cn";
import type { UserRole } from "@/types/database";

export function LoginAccountRoleLine({
  role,
  roleLabel,
  assignmentLabel,
  compact = false,
  className,
}: {
  role: UserRole;
  roleLabel: string;
  assignmentLabel?: string | null;
  compact?: boolean;
  className?: string;
}) {
  const groups = assignmentLabel?.split(", ").filter(Boolean) ?? [];

  return (
    <span
      className={cn(
        "flex min-w-0 items-center gap-1.5 text-slate-500",
        compact ? "text-[10px] leading-tight" : "text-xs leading-tight",
        className
      )}
    >
      <span
        className={cn(
          "shrink-0 self-center rounded-full",
          compact ? "h-1 w-1" : "h-1.5 w-1.5",
          loginAccountRoleDotClass(role)
        )}
        aria-hidden
      />
      <span className="inline-flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0.5 leading-none">
        <span className="truncate">{roleLabel}</span>
        {groups.length > 0 ? (
          <>
            <span className="shrink-0 text-slate-300" aria-hidden>
              ·
            </span>
            {groups.map((g, i) => (
              <span
                key={`${g}-${i}`}
                className={cn(
                  "inline-flex items-center rounded bg-slate-100/80 font-medium text-slate-500",
                  compact ? "px-1 py-px text-[9px]" : "px-1.5 py-px text-[10px]"
                )}
              >
                {g}
              </span>
            ))}
          </>
        ) : null}
      </span>
    </span>
  );
}
