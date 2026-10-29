"use client";

import { MobileBrandBlock } from "@/components/layout/SidebarBrandBlock";
import { ChangelogTriggerIconButton } from "@/components/changelog/ChangelogTriggerIconButton";
import { signOutToLogin } from "@/lib/auth/sign-out-client";
import type { UserRole } from "@/types/database";
import { mobileSalesHeaderClass } from "@/lib/ui/ontime-theme";
import { NavIcon } from "@/components/icons/NavIcon";
import {
  labelForProcurementWorkspace,
  type ProcurementWorkspace,
} from "@/lib/auth/procurement-workspace";

export function MobileOperationsHeader({
  role,
  userEmail,
  userAssignmentLabel,
  procurementWorkspace = null,
}: {
  role: UserRole | null;
  userEmail?: string | null;
  userAssignmentLabel?: string | null;
  procurementWorkspace?: ProcurementWorkspace | null;
}) {
  return (
    <header className={mobileSalesHeaderClass}>
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <MobileBrandBlock
          role={role}
          userEmail={userEmail}
          userAssignmentLabel={userAssignmentLabel}
        />
        {procurementWorkspace ? (
          <span
            className="ml-auto flex shrink-0 items-center gap-1.5 rounded-md bg-slate-100 px-2 py-1 text-[0.6875rem] font-semibold text-slate-700"
          >
            <NavIcon
              navKey={
                procurementWorkspace === "zeby"
                  ? "teeth"
                  : procurementWorkspace === "magazyn"
                    ? "warehouse"
                    : "dailyPanel"
              }
              size={14}
            />
            {labelForProcurementWorkspace(procurementWorkspace)}
          </span>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <ChangelogTriggerIconButton />
        <button
          type="button"
          onClick={() => void signOutToLogin()}
          className="min-h-11 shrink-0 cursor-pointer rounded-md border border-slate-200 bg-card px-3 py-2 text-xs font-medium text-slate-700 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50"
        >
          Wyloguj
        </button>
      </div>
    </header>
  );
}
