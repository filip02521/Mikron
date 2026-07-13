"use client";

import { MobileBrandBlock } from "@/components/layout/SidebarBrandBlock";
import { ChangelogTriggerIconButton } from "@/components/changelog/ChangelogTriggerIconButton";
import { createClient } from "@/lib/supabase/client";
import type { UserRole } from "@/types/database";
import { mobileSalesHeaderClass } from "@/lib/ui/ontime-theme";
import { NavIcon } from "@/components/icons/NavIcon";
import { labelForProcurementWorkspace, type ProcurementWorkspace } from "@/lib/auth/procurement-workspace";
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
              "ml-auto flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-bold ring-1 ring-inset",
              procurementWorkspace === "zeby"
                ? "bg-sky-50 text-sky-900 ring-sky-200/60"
                : procurementWorkspace === "magazyn"
                  ? "bg-emerald-50 text-emerald-900 ring-emerald-200/60"
                  : "bg-indigo-50 text-indigo-900 ring-indigo-200/60"
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
