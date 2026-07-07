import { AppBrandMark } from "@/components/ui/AppBrandMark";
import { UserSettingsMenu } from "@/components/layout/UserSettingsMenu";
import {
  ONTIME_APP_NAME,
  ONTIME_COMPANY,
  ONTIME_TAGLINE_SHORT,
} from "@/lib/ui/ontime-brand";
import type { UserRole } from "@/types/database";
import type { VacationDelegationRow } from "@/lib/data/vacation-delegations";
import { cn } from "@/lib/cn";

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

function SidebarUserRow({
  role,
  workspaceSubtitle = null,
  userEmail,
  salesPersonName,
  userAssignmentLabel,
  compact = false,
  delegations = [],
}: {
  role: UserRole | null;
  workspaceSubtitle?: string | null;
  userEmail?: string | null;
  salesPersonName?: string | null;
  userAssignmentLabel?: string | null;
  compact?: boolean;
  delegations?: VacationDelegationRow[];
}) {
  return (
    <UserSettingsMenu
      role={role}
      workspaceSubtitle={workspaceSubtitle}
      userEmail={userEmail}
      salesPersonName={salesPersonName}
      userAssignmentLabel={userAssignmentLabel}
      compact={compact}
      delegations={delegations}
    />
  );
}

/** Marka + użytkownik — sidebar desktop (bez osobnej karty). */
export function SidebarBrandBlock({
  role,
  workspaceSubtitle = null,
  userEmail,
  salesPersonName,
  userAssignmentLabel,
  activeDelegations = [],
}: {
  role: UserRole | null;
  workspaceSubtitle?: string | null;
  userEmail?: string | null;
  salesPersonName?: string | null;
  userAssignmentLabel?: string | null;
  activeDelegations?: VacationDelegationRow[];
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
        workspaceSubtitle={workspaceSubtitle}
        userEmail={userEmail}
        salesPersonName={salesPersonName}
        userAssignmentLabel={userAssignmentLabel}
        delegations={activeDelegations}
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
  delegations = [],
}: {
  role: UserRole | null;
  userEmail?: string | null;
  salesPersonName?: string | null;
  userAssignmentLabel?: string | null;
  delegations?: VacationDelegationRow[];
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
          delegations={delegations}
        />
      </div>
    </div>
  );
}
