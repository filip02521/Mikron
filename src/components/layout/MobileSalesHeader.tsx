"use client";

import { MobileBrandBlock } from "@/components/layout/SidebarBrandBlock";
import { createClient } from "@/lib/supabase/client";
import type { UserRole } from "@/types/database";
import { mobileSalesHeaderClass } from "@/lib/ui/ontime-theme";

export function MobileSalesHeader({
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
  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.assign("/login");
  }

  return (
    <header className={mobileSalesHeaderClass}>
      <div className="flex min-w-0 flex-1 items-center">
        <MobileBrandBlock
          role={role}
          userEmail={userEmail}
          salesPersonName={salesPersonName}
          userAssignmentLabel={userAssignmentLabel}
        />
      </div>
      <button
        type="button"
        onClick={() => void signOut()}
        className="min-h-10 shrink-0 cursor-pointer rounded-md border border-slate-200/90 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm hover:bg-slate-50"
      >
        Wyloguj
      </button>
    </header>
  );
}
