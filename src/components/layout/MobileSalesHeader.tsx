"use client";

import { useRouter } from "next/navigation";
import { MobileBrandBlock } from "@/components/layout/SidebarBrandBlock";
import { createClient } from "@/lib/supabase/client";
import type { UserRole } from "@/types/database";

export function MobileSalesHeader({
  role,
  userEmail,
}: {
  role: UserRole | null;
  userEmail?: string | null;
}) {
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-30 flex min-h-14 items-center justify-between gap-3 border-b border-[var(--card-border)] bg-[var(--card)]/95 px-4 pt-[env(safe-area-inset-top,0px)] shadow-[var(--shadow-card)] backdrop-blur-md md:hidden">
      <MobileBrandBlock role={role} userEmail={userEmail} />
      <button
        type="button"
        onClick={() => void signOut()}
        className="min-h-10 shrink-0 cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm hover:bg-slate-50"
      >
        Wyloguj
      </button>
    </header>
  );
}
