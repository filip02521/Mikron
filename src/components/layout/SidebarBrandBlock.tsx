import { AppBrandMark } from "@/components/ui/AppBrandMark";
import {
  ONTIME_APP_NAME,
  ONTIME_COMPANY,
  ONTIME_TAGLINE_SHORT,
} from "@/lib/ui/ontime-brand";
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
      : "text-base font-semibold tracking-tight";

  return (
    <p className={cn(text, className)} aria-label={ONTIME_APP_NAME}>
      <span className="text-slate-800">On</span>
      <span className="text-indigo-600">Time</span>
    </p>
  );
}

function RoleLine({ role, compact = false }: { role: UserRole; compact?: boolean }) {
  return (
    <p
      className={cn(
        "flex min-w-0 items-start gap-1.5 leading-snug text-slate-600",
        compact ? "text-[10px]" : "text-[11px]"
      )}
    >
      <span
        className={cn(
          "mt-[0.35rem] shrink-0 rounded-full",
          compact ? "h-1 w-1" : "h-1.5 w-1.5",
          roleDotClass[role]
        )}
        aria-hidden
      />
      <span className="min-w-0 [overflow-wrap:anywhere]">{ROLE_LABELS[role]}</span>
    </p>
  );
}

function UserEmailLine({ email, className }: { email: string; className?: string }) {
  return (
    <p
      className={cn(
        "break-all text-[10px] leading-snug text-slate-400 [overflow-wrap:anywhere]",
        className
      )}
      title={email}
    >
      {email}
    </p>
  );
}

function SidebarUserRow({
  role,
  userEmail,
  salesPersonName,
  compact = false,
}: {
  role: UserRole | null;
  userEmail?: string | null;
  salesPersonName?: string | null;
  compact?: boolean;
}) {
  if (!role && !userEmail && !salesPersonName) return null;

  const displayName = salesPersonName?.trim() || null;
  const initials = displayName
    ? initialsFromName(displayName)
    : userEmail
      ? initialsFromEmail(userEmail)
      : "?";

  if (compact) {
    return (
      <div
        className="mt-0.5 min-w-0"
        {...(displayName ? { "aria-label": `Zalogowany jako ${displayName}` } : {})}
      >
        {displayName ? (
          <p className="truncate text-[11px] font-semibold leading-tight text-slate-900">
            {displayName}
          </p>
        ) : null}
        {role ? <RoleLine role={role} compact /> : null}
        {!displayName && userEmail ? (
          <UserEmailLine email={userEmail} className="truncate break-normal" />
        ) : null}
      </div>
    );
  }

  return (
    <div
      className="border-t border-slate-200/90 pt-3"
      {...(displayName ? { "aria-label": `Zalogowany jako ${displayName}` } : {})}
    >
      <div className="flex min-w-0 items-start gap-2.5">
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700"
          aria-hidden
        >
          {initials}
        </span>
        <div className="min-w-0 flex-1 space-y-0.5">
          {displayName ? (
            <p className="text-sm font-semibold leading-snug text-slate-900 [overflow-wrap:anywhere]">
              {displayName}
            </p>
          ) : null}
          {role ? (
            <RoleLine role={role} />
          ) : !displayName ? (
            <p className="text-xs font-medium text-slate-500">Niezalogowany</p>
          ) : null}
          {userEmail ? <UserEmailLine email={userEmail} className="pt-0.5" /> : null}
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
}: {
  role: UserRole | null;
  userEmail?: string | null;
  salesPersonName?: string | null;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        <AppBrandMark size="sm" variant="light" className="mt-0.5" />
        <div className="min-w-0 flex-1">
          <OnTimeWordmark />
          <p className="mt-0.5 text-[11px] leading-snug text-slate-500">
            {ONTIME_TAGLINE_SHORT}
          </p>
          <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-sky-700/80">
            {ONTIME_COMPANY}
          </p>
        </div>
      </div>
      <div className="brand-accent-strip !mb-0 opacity-70" aria-hidden />
      <SidebarUserRow
        role={role}
        userEmail={userEmail}
        salesPersonName={salesPersonName}
      />
    </div>
  );
}

/** Kompaktowa marka — nagłówek mobilny. */
export function MobileBrandBlock({
  role,
  userEmail,
  salesPersonName,
}: {
  role: UserRole | null;
  userEmail?: string | null;
  salesPersonName?: string | null;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <AppBrandMark size="sm" variant="light" />
      <div className="min-w-0 flex-1">
        <OnTimeWordmark size="sm" />
        <SidebarUserRow
          role={role}
          userEmail={userEmail}
          salesPersonName={salesPersonName}
          compact
        />
      </div>
    </div>
  );
}
