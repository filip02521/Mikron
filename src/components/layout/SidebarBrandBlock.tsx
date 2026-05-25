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
  sales: "bg-indigo-500",
  sales_manager: "bg-indigo-400",
};

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

function SidebarUserRow({
  role,
  userEmail,
  compact = false,
}: {
  role: UserRole | null;
  userEmail?: string | null;
  compact?: boolean;
}) {
  if (!role && !userEmail) return null;

  if (compact) {
    return (
      <p className="mt-0.5 flex min-w-0 items-center gap-1 text-[10px] leading-tight text-slate-600">
        {role ? (
          <>
            <span
              className={cn("h-1 w-1 shrink-0 rounded-full", roleDotClass[role])}
              aria-hidden
            />
            <span className="shrink-0 font-medium">{ROLE_LABELS[role]}</span>
          </>
        ) : null}
        {role && userEmail ? (
          <span className="shrink-0 text-slate-300" aria-hidden>
            ·
          </span>
        ) : null}
        {userEmail ? (
          <span className="truncate text-slate-500" title={userEmail}>
            {userEmail}
          </span>
        ) : null}
      </p>
    );
  }

  const initials = userEmail ? initialsFromEmail(userEmail) : "?";

  return (
    <div className="flex min-w-0 items-center gap-2.5 border-t border-slate-200/90 pt-3">
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700"
        aria-hidden
      >
        {initials}
      </span>
      <div className="min-w-0 flex-1">
        {role ? (
          <p className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-slate-700">
            <span
              className={cn("h-1.5 w-1.5 shrink-0 rounded-full", roleDotClass[role])}
              aria-hidden
            />
            <span className="truncate">{ROLE_LABELS[role]}</span>
          </p>
        ) : (
          <p className="text-xs font-medium text-slate-500">Niezalogowany</p>
        )}
        {userEmail ? (
          <p
            className="mt-0.5 truncate text-[11px] text-slate-500"
            title={userEmail}
          >
            {userEmail}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/** Marka + użytkownik — sidebar desktop (bez osobnej karty). */
export function SidebarBrandBlock({
  role,
  userEmail,
}: {
  role: UserRole | null;
  userEmail?: string | null;
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
      <SidebarUserRow role={role} userEmail={userEmail} />
    </div>
  );
}

/** Kompaktowa marka — nagłówek mobilny. */
export function MobileBrandBlock({
  role,
  userEmail,
}: {
  role: UserRole | null;
  userEmail?: string | null;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <AppBrandMark size="sm" variant="light" />
      <div className="min-w-0 flex-1">
        <OnTimeWordmark size="sm" />
        <SidebarUserRow role={role} userEmail={userEmail} compact />
      </div>
    </div>
  );
}
