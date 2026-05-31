"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { MobileSalesNav } from "./MobileSalesNav";
import { MobileSalesHeader } from "./MobileSalesHeader";
import {
  SalesUpdatesBanner,
  SalesUpdatesProvider,
} from "@/components/sales/SalesUpdatesContext";
import { SalesOnboardingGate } from "@/components/sales/SalesOnboardingGate";
import { useSalesOnboardingOptional } from "@/components/sales/SalesOnboardingContext";
import { SalesOnboardingTourBanner, SalesOnboardingContentGuard } from "@/components/sales/SalesOnboardingTourBanner";
import { SalesBugReportTrigger } from "@/components/sales/SalesBugReportTrigger";
import { cn } from "@/lib/cn";
import { salesMobileChromeRoot } from "@/lib/ui/sales-mobile-chrome";
import { appMainClass, appShellClass } from "@/lib/ui/ontime-theme";
import type { UserRole } from "@/types/database";
import { canAccessOperations, isSalesAccount } from "@/lib/auth-roles";
import { MobileOperationsNav } from "./MobileOperationsNav";
import { MobileOperationsHeader } from "./MobileOperationsHeader";

function AppShellMain({
  children,
  mobileChrome,
}: {
  children: React.ReactNode;
  mobileChrome: boolean;
}) {
  const onboarding = useSalesOnboardingOptional();
  const coachPadding = onboarding?.coachPaddingClass ?? "";

  return (
    <main
      className={cn(
        appMainClass,
        mobileChrome
          ? "ml-0 pb-[calc(3.5rem+env(safe-area-inset-bottom,0px))] md:ml-64 md:pb-0"
          : "ml-0 md:ml-64",
        coachPadding
      )}
    >
      <div className="mx-auto max-w-7xl px-3 py-5 sm:px-6 sm:py-8 lg:px-8">
        <SalesOnboardingTourBanner />
        <SalesOnboardingContentGuard>
          {children}
        </SalesOnboardingContentGuard>
      </div>
    </main>
  );
}

export function AppShellClient({
  children,
  role,
  userEmail,
  showLoginLink,
  navBadges = { nowe: 0, weryfikacja: 0, realizacja: 0 },
  salesActivityVersion = null,
  salesPersonId = null,
  mustChangePassword = false,
  salesOnboardingCompletedAt = null,
  salesPersonName = null,
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
    salesNotatnik?: number;
    adminBugReports?: number;
  };
  salesActivityVersion?: string | null;
  salesPersonId?: string | null;
  mustChangePassword?: boolean;
  salesOnboardingCompletedAt?: string | null;
  salesPersonName?: string | null;
}) {
  const pathname = usePathname();
  const isAuthScreen =
    pathname === "/login" || pathname === "/setup" || pathname === "/ustaw-haslo";

  if (isAuthScreen) {
    return <div className="min-h-dvh overflow-x-hidden">{children}</div>;
  }

  const salesLive = role ? isSalesAccount(role) : false;
  const operationsLive = role ? canAccessOperations(role) : false;
  const mobileChrome = salesLive || operationsLive;

  return (
    <SalesUpdatesProvider enabled={salesLive} initialVersion={salesActivityVersion}>
      <SalesOnboardingGate
        role={role}
        salesPersonId={salesPersonId}
        mustChangePassword={mustChangePassword}
        salesOnboardingCompletedAt={salesOnboardingCompletedAt}
        salesPersonName={salesPersonName}
      >
      <div
        className={cn(
          appShellClass,
          mobileChrome && salesMobileChromeRoot
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
        {operationsLive && !salesLive ? (
          <MobileOperationsHeader role={role} userEmail={userEmail} />
        ) : null}
        <AppShellMain mobileChrome={mobileChrome}>
          {salesLive ? <SalesUpdatesBanner /> : null}
          {children}
        </AppShellMain>
        {salesLive ? <MobileSalesNav navBadges={navBadges} role={role ?? "sales"} /> : null}
        {salesLive ? <SalesBugReportTrigger /> : null}
        {operationsLive && !salesLive && role ? (
          <MobileOperationsNav role={role} navBadges={navBadges} />
        ) : null}
      </div>
      </SalesOnboardingGate>
    </SalesUpdatesProvider>
  );
}
