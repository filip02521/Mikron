"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { MobileSalesNav } from "./MobileSalesNav";
import { MobileSalesHeader } from "./MobileSalesHeader";
import {
  SalesUpdatesBanner,
  SalesUpdatesProvider,
} from "@/components/sales/SalesUpdatesContext";
import {
  OperationsUpdatesBanner,
  OperationsUpdatesProvider,
} from "@/components/operations/OperationsUpdatesContext";
import { SalesOnboardingGate } from "@/components/sales/SalesOnboardingGate";
import { AppRoleProvider } from "@/components/layout/AppRoleContext";
import { useSalesOnboardingOptional } from "@/components/sales/SalesOnboardingContext";
import { SalesOnboardingTourBanner, SalesOnboardingContentGuard } from "@/components/sales/SalesOnboardingTourBanner";
import { SalesBugReportTrigger } from "@/components/sales/SalesBugReportTrigger";
import { DepartmentBoardPinnedStrip } from "@/components/department-board/DepartmentBoardPinnedStrip";
import type { SalesBoardAttentionSnapshot } from "@/lib/data/department-board";
import { cn } from "@/lib/cn";
import { salesMobileChromeRoot } from "@/lib/ui/sales-mobile-chrome";
import { appMainClass, appMainInsetClass, appShellClass } from "@/lib/ui/ontime-theme";
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
      <div className={appMainInsetClass}>
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
  operationsDailyPanelVersion = null,
  salesPersonId = null,
  mustChangePassword = false,
  salesOnboardingCompletedAt = null,
  salesPersonName = null,
  salesBoardAttention = null,
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
    salesTablica?: number;
    operationsNotatki?: number;
    departmentBoardQuestions?: number;
    adminBugReports?: number;
  };
  salesActivityVersion?: string | null;
  operationsDailyPanelVersion?: string | null;
  salesPersonId?: string | null;
  mustChangePassword?: boolean;
  salesOnboardingCompletedAt?: string | null;
  salesPersonName?: string | null;
  salesBoardAttention?: SalesBoardAttentionSnapshot | null;
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
    <AppRoleProvider role={role}>
    <OperationsUpdatesProvider
      enabled={operationsLive && !salesLive}
      initialVersion={operationsDailyPanelVersion}
    >
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
            salesPersonName={salesPersonName}
            showLoginLink={showLoginLink}
            navBadges={navBadges}
          />
        </div>
        {salesLive ? (
          <MobileSalesHeader
            role={role}
            userEmail={userEmail}
            salesPersonName={salesPersonName}
          />
        ) : null}
        {operationsLive && !salesLive ? (
          <MobileOperationsHeader role={role} userEmail={userEmail} />
        ) : null}
        <AppShellMain mobileChrome={mobileChrome}>
          {salesLive && salesBoardAttention?.pinnedAnnouncements.length ? (
            <DepartmentBoardPinnedStrip pinned={salesBoardAttention.pinnedAnnouncements} />
          ) : null}
          {salesLive ? <SalesUpdatesBanner /> : null}
          {operationsLive && !salesLive ? <OperationsUpdatesBanner /> : null}
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
    </OperationsUpdatesProvider>
    </AppRoleProvider>
  );
}
