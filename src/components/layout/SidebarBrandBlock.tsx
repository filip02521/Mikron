import { AppBrandMark } from "@/components/ui/AppBrandMark";
import {
  ONTIME_APP_NAME,
  ONTIME_COMPANY,
  ONTIME_TAGLINE_SHORT,
} from "@/lib/ui/ontime-brand";
import { resolveUserDisplayName } from "@/lib/users/display-name";
import { ROLE_LABELS } from "@/lib/users/labels";
import type { UserRole } from "@/types/database";
import { cn } from "@/lib/cn";

const roleDotClass: Record<UserRole, string> = {
  admin: "bg-violet-500",
  zakupy: "bg-amber-500",
  magazyn: "bg-emerald-500",
  sales: "bg-indigo-500",
  sales_manager: "bg-indigo-400",
};

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function initialsFromEmail(email: string): string {
  const local = (email.split("@")[0] ?? "").trim();
  if (!local) return "?";
  const parts = local.split(/[._-]+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  return local.slice(0, 2).toUpperCase();
}

function OnTimeWordmark({
  className,
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md";
}) {
  const text =
    size === "sm"
      ? "text-sm font-semibold tracking-tight"
      : "text-[15px] font-semibold tracking-tight";

  return (
    <p className={cn(text, className)} aria-label={ONTIME_APP_NAME}>
      <span className="text-slate-800">On</span>
      <span className="text-indigo-600">Time</span>
    </p>
  );
}

function RoleLine({
  role,
  assignmentLabel,
  compact = false,
}: {
  role: UserRole;
  assignmentLabel?: string | null;
  compact?: boolean;
}) {
  return (
    <p
      className={cn(
        "flex min-w-0 items-center gap-1.5 leading-none text-slate-500",
        compact ? "text-[10px]" : "text-xs"
      )}
    >
      <span
        className={cn(
          "shrink-0 rounded-full",
          compact ? "h-1 w-1" : "h-1.5 w-1.5",
          roleDotClass[role]
        )}
        aria-hidden
      />
      <span className="min-w-0 truncate">{ROLE_LABELS[role]}</span>
      {assignmentLabel ? (
        <>
          <span className="shrink-0 text-slate-300" aria-hidden>
            ·
          </span>
          <span className="min-w-0 truncate text-slate-400">{assignmentLabel}</span>
        </>
      ) : null}
    </p>
  );
}

function SidebarUserRow({
  role,
  userEmail,
  salesPersonName,
  userAssignmentLabel,
  compact = false,
}: {
  role: UserRole | null;
  userEmail?: string | null;
  salesPersonName?: string | null;
  userAssignmentLabel?: string | null;
  compact?: boolean;
}) {
  if (!role && !userEmail && !salesPersonName) return null;

  const displayName = resolveUserDisplayName({
    salesPersonName,
    email: userEmail,
  });
  const primaryLabel = displayName || userEmail?.trim() || null;
  const initials = primaryLabel
    ? displayName
      ? initialsFromName(displayName)
      : userEmail
        ? initialsFromEmail(userEmail)
        : initialsFromName(primaryLabel)
    : "?";
  const hoverDetail = [
    primaryLabel,
    role ? ROLE_LABELS[role] : null,
    userAssignmentLabel,
    userEmail,
  ]
    .filter(Boolean)
    .join(" · ");

  if (compact) {
    return (
      <div
        className="mt-1 min-w-0"
        title={hoverDetail || undefined}
        {...(primaryLabel ? { "aria-label": `Zalogowany jako ${primaryLabel}` } : {})}
      >
        {primaryLabel ? (
          <p className="truncate text-[11px] font-semibold leading-tight text-slate-900">
            {primaryLabel}
          </p>
        ) : null}
        {role ? <RoleLine role={role} assignmentLabel={userAssignmentLabel} compact /> : null}
      </div>
    );
  }

  return (
    <div
      className="mt-4 border-t border-slate-100 pt-4"
      title={hoverDetail || undefined}
      {...(primaryLabel ? { "aria-label": `Zalogowany jako ${primaryLabel}` } : {})}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600 ring-1 ring-slate-200/80"
          aria-hidden
        >
          {initials}
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          {primaryLabel ? (
            <p className="truncate text-sm font-semibold leading-tight text-slate-900">
              {primaryLabel}
            </p>
          ) : (
            <p className="text-sm font-medium text-slate-500">Niezalogowany</p>
          )}
          {role ? <RoleLine role={role} assignmentLabel={userAssignmentLabel} /> : null}
        </div>
      </div>
    </div>
  );
}

/** Marka + użytkownik — sidebar desktop (bez osobnej karty). */
export function SidebarBrandBlock({
  role,
  userEmail,
  salesPersonName,
  userAssignmentLabel,
}: {
  role: UserRole | null;
  userEmail?: string | null;
  salesPersonName?: string | null;
  userAssignmentLabel?: string | null;
}) {
  return (
    <div>
      <div className="flex items-center gap-2.5">
        <AppBrandMark size="sm" variant="light" className="shrink-0" />
        <div className="min-w-0 flex-1">
          <OnTimeWordmark />
          <p className="mt-0.5 truncate text-[11px] leading-snug text-slate-500">
            {ONTIME_TAGLINE_SHORT}
          </p>
          <p className="truncate text-[10px] font-medium text-slate-400">{ONTIME_COMPANY}</p>
        </div>
      </div>
      <SidebarUserRow
        role={role}
        userEmail={userEmail}
        salesPersonName={salesPersonName}
        userAssignmentLabel={userAssignmentLabel}
      />
    </div>
  );
}

/** Kompaktowa marka — nagłówek mobilny. */
export function MobileBrandBlock({
  role,
  userEmail,
  salesPersonName,
  userAssignmentLabel,
}: {
  role: UserRole | null;
  userEmail?: string | null;
  salesPersonName?: string | null;
  userAssignmentLabel?: string | null;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <AppBrandMark size="sm" variant="light" className="shrink-0" />
      <div className="min-w-0 flex-1">
        <OnTimeWordmark size="sm" />
        <SidebarUserRow
          role={role}
          userEmail={userEmail}
          salesPersonName={salesPersonName}
          userAssignmentLabel={userAssignmentLabel}
          compact
        />
      </div>
    </div>
  );
}
