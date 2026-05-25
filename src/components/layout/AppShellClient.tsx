"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { MobileSalesNav } from "./MobileSalesNav";
import { MobileSalesHeader } from "./MobileSalesHeader";
import {
  SalesUpdatesBanner,
  SalesUpdatesProvider,
} from "@/components/sales/SalesUpdatesContext";
import { cn } from "@/lib/cn";
import { salesMobileChromeRoot } from "@/lib/ui/sales-mobile-chrome";
import { appMainClass, appShellClass } from "@/lib/ui/ontime-theme";
import type { UserRole } from "@/types/database";
import { isSalesAccount } from "@/lib/auth-roles";

export function AppShellClient({
  children,
  role,
  userEmail,
  showLoginLink,
  navBadges = { nowe: 0, weryfikacja: 0, realizacja: 0 },
  salesActivityVersion = null,
}: {
  children: React.ReactNode;
  role: UserRole | null;
  userEmail?: string | null;
  showLoginLink?: boolean;
  navBadges?: {
    nowe?: number;
    weryfikacja?: number;
    realizacja?: number;
    salesMoje?: number;
  };
  salesActivityVersion?: string | null;
}) {
  const pathname = usePathname();
  const isAuthScreen =
    pathname === "/login" || pathname === "/setup" || pathname === "/ustaw-haslo";

  if (isAuthScreen) {
    return <div className="min-h-dvh overflow-x-hidden">{children}</div>;
  }

  const salesLive = role ? isSalesAccount(role) : false;

  return (
    <SalesUpdatesProvider enabled={salesLive} initialVersion={salesActivityVersion}>
      <div
        className={cn(
          appShellClass,
          salesLive && salesMobileChromeRoot
        )}
      >
        <div className="hidden md:block">
          <Sidebar
            role={role}
            userEmail={userEmail}
            showLoginLink={showLoginLink}
            navBadges={navBadges}
          />
        </div>
        {salesLive ? <MobileSalesHeader role={role} userEmail={userEmail} /> : null}
        <main
          className={cn(
            appMainClass,
            salesLive
              ? "ml-0 pb-[calc(3.5rem+env(safe-area-inset-bottom,0px))] md:ml-64 md:pb-0"
              : "ml-0 md:ml-64"
          )}
        >
          <div className="mx-auto max-w-7xl px-3 py-5 sm:px-6 sm:py-8 lg:px-8">
            {salesLive ? <SalesUpdatesBanner /> : null}
            {children}
          </div>
        </main>
        {salesLive ? <MobileSalesNav navBadges={navBadges} /> : null}
      </div>
    </SalesUpdatesProvider>
  );
}
