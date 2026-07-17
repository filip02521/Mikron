"use client";

import { MobileBrandBlock } from "@/components/layout/SidebarBrandBlock";
import { ChangelogTriggerIconButton } from "@/components/changelog/ChangelogTriggerIconButton";
import { createClient } from "@/lib/supabase/client";
import type { UserRole } from "@/types/database";
import { mobileSalesHeaderClass } from "@/lib/ui/ontime-theme";
import { NavIcon } from "@/components/icons/NavIcon";
import { labelForProcurementWorkspace, workspaceToneBg, workspaceToneRing, workspaceToneText, type ProcurementWorkspace } from "@/lib/auth/procurement-workspace";
import { cn } from "@/lib/cn";

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
  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.assign("/login");
  }

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
            className={cn(
              "ml-auto flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-bold ring-1 ring-inset",
              workspaceToneBg(procurementWorkspace),
              workspaceToneRing(procurementWorkspace),
              workspaceToneText(procurementWorkspace),
            )}
          >
            <NavIcon
              navKey={procurementWorkspace === "zeby" ? "teeth" : procurementWorkspace === "magazyn" ? "warehouse" : "dailyPanel"}
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
          onClick={() => void signOut()}
          className="min-h-10 shrink-0 cursor-pointer rounded-md border border-slate-200/90 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm hover:bg-slate-50"
        >
          Wyloguj
        </button>
      </div>
    </header>
  );
}
