"use client";

import { MobileBrandBlock } from "@/components/layout/SidebarBrandBlock";
import { createClient } from "@/lib/supabase/client";
import type { UserRole } from "@/types/database";
import { mobileSalesHeaderClass, sidebarBrandAccentClass } from "@/lib/ui/ontime-theme";
import { cn } from "@/lib/cn";

export function MobileOperationsHeader({
  role,
  userEmail,
}: {
  role: UserRole | null;
  userEmail?: string | null;
}) {
  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.assign("/login");
  }

  return (
    <header className={mobileSalesHeaderClass}>
      <div
        className={cn(sidebarBrandAccentClass, "absolute inset-x-0 top-0 rounded-none opacity-70")}
        aria-hidden
      />
      <div className="relative flex min-w-0 flex-1 items-center">
        <MobileBrandBlock role={role} userEmail={userEmail} />
      </div>
      <button
        type="button"
        onClick={() => void signOut()}
        className="relative min-h-10 shrink-0 cursor-pointer rounded-md border border-slate-200/90 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm hover:bg-slate-50"
      >
        Wyloguj
      </button>
    </header>
  );
}
