"use client";

import { Suspense } from "react";
import { usePathname } from "next/navigation";
import { LegacyProcurementRouteRedirect } from "@/components/layout/LegacyProcurementRouteRedirect";
import { AdminPanelPreviewProvider } from "./AdminPanelPreviewContext";
import { AdminPreviewBanner } from "./AdminPreviewBanner";
import { Sidebar } from "./Sidebar";
import { MobileSalesNav } from "./MobileSalesNav";
import { MobileSalesHeader } from "./MobileSalesHeader";
import {
  SalesUpdatesBanner,
  SalesUpdatesProvider,
} from "@/components/sales/SalesUpdatesContext";
import {
  SalesInboxFloatingBell,
} from "@/components/sales/SalesInboxBell";
import { SalesInboxProvider } from "@/components/sales/SalesInboxContext";
import {
  OperationsUpdatesBanner,
  OperationsUpdatesProvider,
} from "@/components/operations/OperationsUpdatesContext";
import {
  TeethUpdatesBanner,
  TeethUpdatesProvider,
} from "@/components/zeby/TeethUpdatesContext";
import { OperationsBoardQuestionsNotice } from "@/components/operations/OperationsBoardQuestionsNotice";
import { SalesOnboardingGate } from "@/components/sales/SalesOnboardingGate";
import { AppRoleProvider } from "@/components/layout/AppRoleContext";
import { useSalesCoachPaddingClass } from "@/components/sales/SalesOnboardingContext";
import { SalesOnboardingTourBanner, SalesOnboardingContentGuard } from "@/components/sales/SalesOnboardingTourBanner";
import { SalesBugReportTrigger } from "@/components/sales/SalesBugReportTrigger";
import { DepartmentBoardPinnedStrip } from "@/components/department-board/DepartmentBoardPinnedStrip";
import {
  procurementBoardAnnouncementHref,
  salesBoardAnnouncementHref,
  type SalesBoardAttentionSnapshot,
} from "@/lib/data/department-board";
import { cn } from "@/lib/cn";
import { salesMobileChromeRoot } from "@/lib/ui/sales-mobile-chrome";
import { appMainClass, appMainInsetClass, appShellClass } from "@/lib/ui/ontime-theme";
import type { AdminPanelContext } from "@/lib/auth/admin-panel-context";
import { isAdminOperationsPreviewReadOnly } from "@/lib/auth/admin-panel-context";
import type { ProcurementWorkspace } from "@/lib/auth/procurement-workspace";
import type { UserRole } from "@/types/database";
import { canAccessOperations, canAccessTeethPanel, isSalesAccount } from "@/lib/auth-roles";
import { MobileOperationsNav } from "./MobileOperationsNav";
import { MobileOperationsHeader } from "./MobileOperationsHeader";
import { useAppShellMetrics } from "./AppShellMetricsContext";
import { AppWorkspaceBackdrop } from "./AppWorkspaceBackdrop";
import { TeethExemptProvider } from "@/components/layout/TeethExemptContext";

function SalesGlobalPinnedStrip({
  attention,
}: {
  attention: SalesBoardAttentionSnapshot;
}) {
  if (!attention.pinnedAnnouncements.length) return null;

  return (
    <DepartmentBoardPinnedStrip
      pinned={attention.pinnedAnnouncements}
      announcementHref={salesBoardAnnouncementHref}
    />
  );
}

function OperationsGlobalPinnedStrip({
  pinned,
}: {
  pinned: Pick<SalesBoardAttentionSnapshot["pinnedAnnouncements"][number], "id" | "title" | "body">[];
}) {
  if (!pinned.length) return null;

  return (
    <DepartmentBoardPinnedStrip
      pinned={pinned}
      announcementHref={procurementBoardAnnouncementHref}
    />
  );
}

function AppShellMain({
  children,
  mobileChrome,
  topNotices,
}: {
  children: React.ReactNode;
  mobileChrome: boolean;
  topNotices?: React.ReactNode;
}) {
  const coachPadding = useSalesCoachPaddingClass();

  return (
    <main
      className={cn(
        appMainClass,
        "relative isolate",
        mobileChrome
          ? "ml-0 pb-[calc(3.5rem+env(safe-area-inset-bottom,0px))] md:ml-64 md:pb-0"
          : "ml-0 md:ml-64",
        coachPadding
      )}
    >
      <AppWorkspaceBackdrop />
      <div className={cn(appMainInsetClass, "relative z-[1]")}>
        {topNotices}
        <SalesOnboardingTourBanner />
        <SalesOnboardingContentGuard>{children}</SalesOnboardingContentGuard>
      </div>
    </main>
  );
}

export function AppShellClient({
  children,
  role,
  realRole = null,
  adminPanelPreview = null,
  procurementWorkspace = null,
  canSwitchProcurementWorkspace = false,
  userEmail,
  showLoginLink,
  salesPersonId = null,
  mustChangePassword = false,
  salesOnboardingCompletedAt = null,
  salesOnboardingActive = false,
  teethProductInfo = [],
}: {
  children: React.ReactNode;
  role: UserRole | null;
  realRole?: UserRole | null;
  adminPanelPreview?: AdminPanelContext | null;
  procurementWorkspace?: ProcurementWorkspace | null;
  canSwitchProcurementWorkspace?: boolean;
  userEmail?: string | null;
  showLoginLink?: boolean;
  salesPersonId?: string | null;
  mustChangePassword?: boolean;
  salesOnboardingCompletedAt?: string | null;
  /** Tour onboarding — wyłącz live badge i polling zamówień. */
  salesOnboardingActive?: boolean;
  teethProductInfo?: { twId: number; manufacturer: string | null; productLine?: string | null; kind?: string | null }[];
}) {
  const {
    navBadges,
    salesActivityVersion,
    operationsDailyPanelVersion,
    teethPanelVersion,
    salesPersonName,
    userAssignmentLabel,
    salesBoardAttention,
    salesInboxSnapshot,
    operationsPinnedAnnouncements,
    ready: metricsReady,
  } = useAppShellMetrics();
  const pathname = usePathname();
  const isAuthScreen =
    pathname === "/login" ||
    pathname === "/setup" ||
    pathname === "/ustaw-haslo" ||
    pathname === "/auth/entering";

  if (isAuthScreen) {
    return <div className="min-h-dvh overflow-x-hidden">{children}</div>;
  }

  const salesLive = role ? isSalesAccount(role) : false;
  const inTeethWorkspace = procurementWorkspace === "zeby";
  const inDostawyWorkspace =
    procurementWorkspace === "dostawy" ||
    (procurementWorkspace == null && role != null && canAccessOperations(role) && !inTeethWorkspace);
  const operationsLive =
    Boolean(role && inDostawyWorkspace && canAccessOperations(role ?? "sales")) && !salesLive;
  const teethLive =
    Boolean(role && inTeethWorkspace && canAccessTeethPanel(role ?? "sales")) && !salesLive;
  const teethInitialVersion = teethPanelVersion;
  const mobileChrome = salesLive || operationsLive || teethLive;

  const salesInboxEnabled =
    salesLive && !salesOnboardingActive && !adminPanelPreview && metricsReady;

  return (
    <TeethExemptProvider teethProductInfo={teethProductInfo}>
    <AdminPanelPreviewProvider
      readOnly={isAdminOperationsPreviewReadOnly(realRole, adminPanelPreview)}
      panelContext={adminPanelPreview}
    >
    <AppRoleProvider role={role}>
    <OperationsUpdatesProvider
      enabled={operationsLive && !salesLive}
      initialVersion={operationsDailyPanelVersion}
      initialOpenBoardQuestions={navBadges.departmentBoardQuestions ?? 0}
      soundBaselineReady={metricsReady}
    >
    <TeethUpdatesProvider
      enabled={teethLive && !salesLive}
      initialVersion={teethInitialVersion}
    >
    <Suspense fallback={null}>
    <SalesUpdatesProvider
      enabled={salesLive && !salesOnboardingActive && !adminPanelPreview}
      initialVersion={salesActivityVersion}
      initialUnseenOwnAnswers={salesBoardAttention?.unseenOwnAnswerCount ?? 0}
      sessionSalesPersonId={salesPersonId}
      soundBaselineReady={metricsReady}
    >
    <SalesInboxProvider
      enabled={salesInboxEnabled}
      initialSnapshot={salesInboxSnapshot}
      sessionSalesPersonId={salesPersonId}
    >
      <SalesOnboardingGate
        role={role}
        salesPersonId={salesPersonId}
        mustChangePassword={mustChangePassword}
        salesOnboardingCompletedAt={salesOnboardingCompletedAt}
        salesPersonName={salesPersonName}
        adminPanelPreview={Boolean(adminPanelPreview)}
      >
      <LegacyProcurementRouteRedirect />
      <div
        className={cn(
          appShellClass,
          mobileChrome && salesMobileChromeRoot
        )}
      >
        <div className="hidden md:block">
          <Suspense fallback={null}>
            <Sidebar
              role={role}
              realRole={realRole}
              adminPanelContext={adminPanelPreview ?? "admin"}
              procurementWorkspace={procurementWorkspace}
              canSwitchProcurementWorkspace={canSwitchProcurementWorkspace}
              userEmail={userEmail}
              salesPersonName={salesPersonName}
              userAssignmentLabel={userAssignmentLabel}
              showLoginLink={showLoginLink}
              navBadges={navBadges}
            />
          </Suspense>
        </div>
        {salesLive ? (
          <MobileSalesHeader
            role={role}
            userEmail={userEmail}
            salesPersonName={salesPersonName}
            userAssignmentLabel={userAssignmentLabel}
            showInboxBell={salesInboxEnabled}
          />
        ) : null}
        {salesInboxEnabled ? <SalesInboxFloatingBell /> : null}
        {operationsLive && !salesLive ? (
          <MobileOperationsHeader
            role={role}
            userEmail={userEmail}
            userAssignmentLabel={userAssignmentLabel}
          />
        ) : null}
        {teethLive && !salesLive && !operationsLive ? (
          <MobileOperationsHeader
            role={role}
            userEmail={userEmail}
            userAssignmentLabel={userAssignmentLabel}
          />
        ) : null}
        <AppShellMain
          mobileChrome={mobileChrome}
          topNotices={
            adminPanelPreview ? (
              <>
                <AdminPreviewBanner
                  panelContext={adminPanelPreview}
                  previewSalesPersonName={
                    adminPanelPreview === "sales" ? salesPersonName : null
                  }
                />
                {operationsPinnedAnnouncements.length > 0 &&
                (adminPanelPreview === "admin" || adminPanelPreview === "zakupy") ? (
                  <OperationsGlobalPinnedStrip pinned={operationsPinnedAnnouncements} />
                ) : null}
                {adminPanelPreview === "admin" || adminPanelPreview === "zakupy" ? (
                  <OperationsBoardQuestionsNotice />
                ) : null}
              </>
            ) : salesLive ? (
              <>
                {salesBoardAttention ? (
                  <Suspense fallback={null}>
                    <SalesGlobalPinnedStrip attention={salesBoardAttention} />
                  </Suspense>
                ) : null}
                <SalesUpdatesBanner />
              </>
            ) : operationsLive && !salesLive ? (
              <>
                {operationsPinnedAnnouncements.length > 0 ? (
                  <OperationsGlobalPinnedStrip pinned={operationsPinnedAnnouncements} />
                ) : null}
                <OperationsBoardQuestionsNotice />
                <OperationsUpdatesBanner />
                <TeethUpdatesBanner />
              </>
            ) : teethLive && !salesLive ? (
              <TeethUpdatesBanner />
            ) : null
          }
        >
          {children}
        </AppShellMain>
        {salesLive ? (
          <Suspense fallback={null}>
            <MobileSalesNav
              navBadges={navBadges}
              role={role ?? "sales"}
              realRole={realRole}
              adminPanelContext={adminPanelPreview ?? "admin"}
            />
          </Suspense>
        ) : null}
        {salesLive && !adminPanelPreview ? <SalesBugReportTrigger /> : null}
        {operationsLive && !salesLive && role ? (
          <MobileOperationsNav
            role={role}
            realRole={realRole}
            procurementWorkspace={procurementWorkspace}
            navBadges={navBadges}
          />
        ) : null}
        {teethLive && !salesLive && role ? (
          <MobileOperationsNav
            role={role}
            realRole={realRole}
            procurementWorkspace={procurementWorkspace}
            navBadges={navBadges}
          />
        ) : null}
      </div>
      </SalesOnboardingGate>
    </SalesInboxProvider>
    </SalesUpdatesProvider>
    </Suspense>
    </TeethUpdatesProvider>
    </OperationsUpdatesProvider>
    </AppRoleProvider>
    </AdminPanelPreviewProvider>
    </TeethExemptProvider>
  );
}
