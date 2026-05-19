"use client";

import { useRouter } from "next/navigation";
import { AppBrandMark } from "@/components/ui/AppBrandMark";
import { createClient } from "@/lib/supabase/client";

export function MobileSalesHeader({ userEmail }: { userEmail?: string | null }) {
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-30 flex min-h-14 items-center justify-between gap-3 border-b border-indigo-100/80 bg-white/95 px-4 pt-[env(safe-area-inset-top,0px)] backdrop-blur-md md:hidden">
      <HeaderBrand userEmail={userEmail} />
      <button
        type="button"
        onClick={() => void signOut()}
        className="min-h-10 shrink-0 cursor-pointer rounded-lg px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
      >
        Wyloguj
      </button>
    </header>
  );
}

function HeaderBrand({ userEmail }: { userEmail?: string | null }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <AppBrandMark
        size="sm"
        className="bg-indigo-600 shadow-indigo-600/20 ring-indigo-500/25"
      />
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-slate-900">System Dostaw</p>
        {userEmail ? (
          <p className="truncate text-[10px] text-slate-500" title={userEmail}>
            {userEmail}
          </p>
        ) : null}
      </div>
    </div>
  );
}
