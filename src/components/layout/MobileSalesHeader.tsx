"use client";

import { MobileBrandBlock } from "@/components/layout/SidebarBrandBlock";
import { SalesInboxBellTrigger } from "@/components/sales/SalesInboxBell";
import { ChangelogTriggerIconButton } from "@/components/changelog/ChangelogTriggerIconButton";
import { signOutToLogin } from "@/lib/auth/sign-out-client";
import type { UserRole } from "@/types/database";
import type { VacationDelegationRow } from "@/lib/data/vacation-delegations";
import { mobileSalesHeaderClass } from "@/lib/ui/ontime-theme";

export function MobileSalesHeader({
  role,
  userEmail,
  salesPersonName,
  userAssignmentLabel,
  showInboxBell = false,
  delegations = [],
}: {
  role: UserRole | null;
  userEmail?: string | null;
  salesPersonName?: string | null;
  userAssignmentLabel?: string | null;
  showInboxBell?: boolean;
  delegations?: VacationDelegationRow[];
}) {
  return (
    <header className={mobileSalesHeaderClass}>
      <div className="flex min-w-0 flex-1 items-center">
        <MobileBrandBlock
          role={role}
          userEmail={userEmail}
          salesPersonName={salesPersonName}
          userAssignmentLabel={userAssignmentLabel}
          delegations={delegations}
        />
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <ChangelogTriggerIconButton />
        {showInboxBell ? <SalesInboxBellTrigger className="md:hidden" /> : null}
        <button
          type="button"
          onClick={() => void signOutToLogin()}
          className="min-h-10 shrink-0 cursor-pointer rounded-md border border-slate-200/90 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm hover:bg-slate-50"
        >
          Wyloguj
        </button>
      </div>
    </header>
  );
}
