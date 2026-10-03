"use client";

import { useState, useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  isNavItemActive,
  navForAppContext,
  navForRole,
  navItemDisplayTone,
  navItemHasDueReminders,
  filterNavGroupsByAccess,
  type NavGroup,
  type NavItem,
} from "@/lib/nav";
import { useSalesUpdates } from "@/components/sales/SalesUpdatesContext";
import { useOperationsUpdates } from "@/components/operations/OperationsUpdatesContext";
import { useTeethUpdates } from "@/components/zeby/TeethUpdatesContext";
import { SidebarBrandBlock } from "@/components/layout/SidebarBrandBlock";
import {
  brandSidebarFooter,
  brandSidebarNavScroll,
  brandSidebarShell,
} from "@/lib/ui/brand";
import {
  navLinkIdleClass,
  sidebarHeaderClass,
  sidebarNavSectionDividerClass,
  sidebarNavSectionTitleClass,
  sidebarNavAttentionIdleClass,
  sidebarNavBadgeClassForTone,
  sidebarNavToneActiveClass,
  sidebarNavToneHighlightIdleClass,
  buttonPrimaryClass,
} from "@/lib/ui/ontime-theme";
import type { UserRole, Workspace } from "@/types/database";
import { cn } from "@/lib/cn";
import { signOutToLogin } from "@/lib/auth/sign-out-client";
import { NavIcon, navIconTileActiveClassForTone, navIconTileClassForTone } from "@/components/icons/NavIcon";
import {
  IconChevronRight,
  IconLogOut,
  IconSettings,
  IconSidebarCollapse,
  IconSidebarExpand,
} from "@/components/icons/StrokeIcons";
import { AppBrandMark } from "@/components/ui/AppBrandMark";
import { useSidebarCollapsed, useSidebarCollapseShortcut } from "@/lib/ui/sidebar-collapse";
import type { VacationDelegationRow } from "@/lib/data/vacation-delegations";
import { useSalesNavLocked } from "@/components/sales/SalesOnboardingContext";
import { AdminPanelContextSwitcher } from "@/components/layout/AdminPanelContextSwitcher";
import { ProcurementWorkspaceSwitcher } from "@/components/layout/ProcurementWorkspaceSwitcher";
import { actionClearAdminPanelContext } from "@/app/actions/admin-panel-context";
import type { AdminPanelContext } from "@/lib/auth/admin-panel-context";
import type { ProcurementWorkspace } from "@/lib/auth/procurement-workspace";
import {
  PROCUREMENT_WORKSPACE_OPTIONS,
  subtitleForProcurementWorkspace,
  labelForProcurementWorkspace,
  grantedProcurementFunctions,
} from "@/lib/auth/procurement-workspace";
import { isAdmin } from "@/lib/auth-roles";
import { hrefWithAdminSalesPreview, shouldPreserveSalesPreviewInNav } from "@/lib/nav/sales-preview-href";
import { ChangelogTriggerIconButton } from "@/components/changelog/ChangelogTriggerIconButton";
import { useMonthlySummaryNeedsAttention } from "@/hooks/useMonthlySummaryAttention";
import { MONTHLY_SUMMARY_HREF } from "@/lib/monthly-summary-attention";

const emptySubscribe = () => () => {};
const clientSnapshot = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const serverSnapshot = () => null;

function useLocalStorageCollapsed(
  storageKey: string,
  defaultValue: boolean
): [boolean, (next: boolean) => void, boolean] {
  const stored = useSyncExternalStore(
    emptySubscribe,
    () => clientSnapshot(storageKey),
    serverSnapshot
  );
  const collapsed = stored === null ? defaultValue : stored === "1";
  const setCollapsed = useCallback(
    (next: boolean) => {
      try {
        localStorage.setItem(storageKey, next ? "1" : "0");
      } catch {
        // ignore
      }
    },
    [storageKey]
  );
  return [collapsed, setCollapsed, true];
}

/** Fokus tylko z klawiatury: klik myszą nie zostawia ramki na pozycji menu. */
const sidebarFocusClass =
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40";

function NavLink({
  item,
  active,
  showDot,
  locked,
  href,
  monthlyAttention = false,
}: {
  item: NavItem;
  active: boolean;
  showDot: boolean;
  locked?: boolean;
  href: string;
  monthlyAttention?: boolean;
}) {
  const [railCollapsed] = useSidebarCollapsed();
  const indented = Boolean(item.indent);
  const hasBadge = item.badge != null && item.badge > 0;
  const displayTone = navItemDisplayTone(item, active);
  const attentionIdle = navItemHasDueReminders(item) && !active;
  const isMonthlyHref = item.href === MONTHLY_SUMMARY_HREF || href.split("?")[0] === MONTHLY_SUMMARY_HREF;
  const monthlyIdle = isMonthlyHref && monthlyAttention && !active;
  const showHighlight =
    !isMonthlyHref &&
    (item.tier === "primary" || Boolean(item.highlight));

  const className = cn(
    "sb-link group block rounded-md",
    "px-2.5 py-1.5",
    indented && "ml-5",
    sidebarFocusClass,
    active
      ? cn(sidebarNavToneActiveClass(item.tone), "sb-link-active")
      : attentionIdle
        ? sidebarNavAttentionIdleClass
        : monthlyIdle
          ? cn(
              "border border-violet-200/70 bg-violet-50/80 text-slate-800 shadow-sm",
              "hover:border-violet-300/80 hover:bg-violet-50"
            )
          : showHighlight
            ? cn(
                "border border-transparent text-slate-700",
                sidebarNavToneHighlightIdleClass(item.tone) ?? navLinkIdleClass
              )
            : navLinkIdleClass,
    locked &&
      !active &&
      "cursor-not-allowed opacity-45 hover:border-transparent hover:bg-transparent hover:text-inherit"
  );

  const content = (
    <span className="flex items-center justify-between gap-2">
      <span className="flex min-w-0 flex-1 items-center gap-2.5">
        {indented ? (
          <span className="sb-link-icon relative flex shrink-0 items-center">
            <span className="sb-full absolute -left-3 top-1/2 h-px w-3 bg-slate-300" />
            <span className="sb-full absolute -left-3 -top-2 bottom-1/2 w-px bg-slate-200" />
            <span
              className={cn(
                "flex h-6 w-6 items-center justify-center",
                active ? "text-indigo-700" : "text-slate-400 group-hover:text-slate-600"
              )}
            >
              <NavIcon navKey={item.icon} size={item.icon === "teeth" ? 18 : 15} />
            </span>
          </span>
        ) : (
          <span
            className={cn(
              "sb-link-icon flex h-6 w-6 shrink-0 items-center justify-center",
              active
                ? navIconTileActiveClassForTone(item.iconTone ?? item.tone)
                : navIconTileClassForTone(item.iconTone ?? displayTone)
            )}
          >
            <NavIcon navKey={item.icon} size={item.icon === "teeth" ? 18 : 16} />
          </span>
        )}
        <span className="sb-full min-w-0 flex-1">
          <span
            className={cn(
              "block truncate text-[13px] leading-6",
              active ? "font-semibold text-slate-900" : "font-medium text-slate-700"
            )}
          >
            {item.label}
          </span>
        </span>
      </span>
      {hasBadge || showDot ? (
        // Wąski pasek: licznik / nowości jako kropka na ikonie (liczba w dymku).
        <span
          className={cn(
            "sb-rail absolute right-1.5 top-1 h-2 w-2 rounded-full ring-2 ring-white",
            monthlyIdle ? "bg-violet-500" : hasBadge ? "bg-indigo-500" : "bg-amber-400"
          )}
          aria-hidden
        />
      ) : null}
      <span className="sb-full flex shrink-0 items-center gap-1.5">
        {showDot ? (
          <span
            className={cn(
              "h-2 w-2 rounded-full ring-2 ring-white",
              monthlyIdle ? "bg-violet-500" : "bg-amber-400"
            )}
            title={monthlyIdle ? "Nowe podsumowanie miesiąca" : "Nowe zmiany"}
          />
        ) : null}
        {hasBadge ? (
          <span
            className={cn(
              "min-w-[1.25rem] rounded-md px-1.5 py-0.5 text-center text-[10px] font-semibold tabular-nums",
              sidebarNavBadgeClassForTone(displayTone, active)
            )}
          >
            {item.badge! > 99 ? "99+" : item.badge}
          </span>
        ) : null}
      </span>
    </span>
  );

  const isLockedItem = Boolean(locked && !active);

  return (
    <Link
      href={href}
      className={className}
      aria-current={active ? "page" : undefined}
      aria-disabled={isLockedItem || undefined}
      tabIndex={isLockedItem ? -1 : undefined}
      title={
        isLockedItem
          ? "Dokończ wprowadzenie - użyj „Dalej” w panelu touru"
          : railCollapsed
            ? `${item.label}${hasBadge ? ` (${item.badge! > 99 ? "99+" : item.badge})` : ""}`
            : item.description
              ? item.description
              : undefined
      }
      aria-label={railCollapsed ? item.label : undefined}
      onClick={isLockedItem ? (e) => e.preventDefault() : undefined}
    >
      {content}
    </Link>
  );
}

function CollapsibleNavSection({
  group,
  isFirst,
  navLocked,
  previewDla,
  adminSalesPreview,
}: {
  group: NavGroup;
  isFirst: boolean;
  navLocked: boolean;
  previewDla: string | null;
  adminSalesPreview: boolean;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeSearch = searchParams.toString() ? `?${searchParams.toString()}` : "";
  const salesUpdates = useSalesUpdates();
  const operationsUpdates = useOperationsUpdates();
  const teethUpdates = useTeethUpdates();
  const monthlyNeedsAttention = useMonthlySummaryNeedsAttention();
  const allHrefs = group.items.map((item) => item.href);

  const storageKey = `nav-collapsed:${group.title}`;
  const [storedCollapsed, setStoredCollapsed] = useLocalStorageCollapsed(
    storageKey,
    group.defaultCollapsed ?? false
  );
  const autoExpandedRef = useRef(false);

  const hasActiveItem = allHrefs.some((href) =>
    isNavItemActive(pathname, href, allHrefs, activeSearch)
  );
  const hasMonthlyAttention = group.items.some(
    (item) => item.href === MONTHLY_SUMMARY_HREF && monthlyNeedsAttention
  );

  const [overrideCollapsed, setOverrideCollapsed] = useState<boolean | null>(null);
  const collapsed = overrideCollapsed ?? storedCollapsed;

  useEffect(() => {
    if ((hasActiveItem || hasMonthlyAttention) && collapsed && !autoExpandedRef.current) {
      autoExpandedRef.current = true;
      setOverrideCollapsed(false);
      setStoredCollapsed(false);
    }
  }, [hasActiveItem, hasMonthlyAttention, collapsed, setStoredCollapsed]);

  const toggle = useCallback(() => {
    autoExpandedRef.current = true;
    setOverrideCollapsed((prev) => {
      const next = !(prev ?? storedCollapsed);
      setStoredCollapsed(next);
      return next;
    });
  }, [storedCollapsed, setStoredCollapsed]);

  const totalBadge = group.items.reduce(
    (sum, item) => sum + (item.badge != null && item.badge > 0 ? item.badge : 0),
    0
  );

  return (
    <section className={cn(!isFirst && sidebarNavSectionDividerClass)}>
      <button
        type="button"
        onClick={toggle}
        className={cn(
          "sb-full group/section flex w-full items-center gap-1.5 rounded-md px-2.5 py-1 text-left transition-colors hover:bg-slate-50",
          sidebarFocusClass
        )}
        aria-expanded={!collapsed}
      >
        <h2 className={cn(sidebarNavSectionTitleClass, "flex-1 px-0 text-slate-500")}>
          {group.title}
        </h2>
        {hasMonthlyAttention && collapsed ? (
          <span
            className="h-2 w-2 shrink-0 rounded-full bg-violet-500 ring-2 ring-white"
            title="Nowe podsumowanie miesiąca"
          />
        ) : null}
        {totalBadge > 0 ? (
          <span className="shrink-0 text-[10px] font-semibold tabular-nums text-slate-500">
            {totalBadge > 99 ? "99+" : totalBadge}
          </span>
        ) : null}
        <span
          className={cn(
            "shrink-0 text-slate-400 transition-transform duration-200 group-hover/section:text-slate-600 motion-reduce:transition-none",
            collapsed ? "rotate-0" : "rotate-90"
          )}
          aria-hidden
        >
          <IconChevronRight size={12} />
        </span>
      </button>
      {/* Zwinięta sekcja: ukryta w pełnym menu, ale w wąskim pasku pozycje są zawsze dostępne. */}
      {(
        <ul className={cn("mt-1 space-y-0.5", collapsed && "hidden sb-rail-show")}>
          {group.items.map((item) => {
            const active = isNavItemActive(pathname, item.href, allHrefs, activeSearch);
            const monthlyAttention = item.href === MONTHLY_SUMMARY_HREF && monthlyNeedsAttention;
            const showDot =
              (item.href === "/moje" && Boolean(salesUpdates?.hasUpdates) && !active) ||
              (item.href === "/podsumowanie" &&
                Boolean(operationsUpdates?.hasUpdates) &&
                !active) ||
              (item.href === "/zeby/kolejka" &&
                Boolean(teethUpdates?.hasUpdates) &&
                !active) ||
              (monthlyAttention && !active);

            const href = hrefWithAdminSalesPreview(item.href, previewDla, adminSalesPreview);

            return (
              <li key={item.href}>
                <NavLink
                  item={item}
                  href={href}
                  active={active}
                  showDot={showDot}
                  locked={navLocked}
                  monthlyAttention={monthlyAttention}
                />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function NavSection({
  group,
  isFirst,
  navLocked,
  previewDla,
  adminSalesPreview,
}: {
  group: NavGroup;
  isFirst: boolean;
  navLocked: boolean;
  previewDla: string | null;
  adminSalesPreview: boolean;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeSearch = searchParams.toString() ? `?${searchParams.toString()}` : "";
  const salesUpdates = useSalesUpdates();
  const operationsUpdates = useOperationsUpdates();
  const teethUpdates = useTeethUpdates();
  const monthlyNeedsAttention = useMonthlySummaryNeedsAttention();
  const allHrefs = group.items.map((item) => item.href);

  if (group.collapsible) {
    return (
      <CollapsibleNavSection
        group={group}
        isFirst={isFirst}
        navLocked={navLocked}
        previewDla={previewDla}
        adminSalesPreview={adminSalesPreview}
      />
    );
  }

  return (
    <section className={cn(!isFirst && sidebarNavSectionDividerClass)}>
      <div className="sb-full px-2.5 pb-1 pt-1">
        <h2 className={cn(sidebarNavSectionTitleClass, "px-0 text-slate-500")}>{group.title}</h2>
      </div>
      <ul className="space-y-0.5">
        {group.items.map((item) => {
          const active = isNavItemActive(pathname, item.href, allHrefs, activeSearch);
          const monthlyAttention = item.href === MONTHLY_SUMMARY_HREF && monthlyNeedsAttention;
          const showDot =
            (item.href === "/moje" && Boolean(salesUpdates?.hasUpdates) && !active) ||
            (item.href === "/podsumowanie" &&
              Boolean(operationsUpdates?.hasUpdates) &&
              !active) ||
            (item.href === "/zeby/kolejka" &&
              Boolean(teethUpdates?.hasUpdates) &&
              !active) ||
            (monthlyAttention && !active);

          const href = hrefWithAdminSalesPreview(item.href, previewDla, adminSalesPreview);

          return (
            <li key={item.href}>
              <NavLink
                item={item}
                href={href}
                active={active}
                showDot={showDot}
                locked={navLocked}
                monthlyAttention={monthlyAttention}
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function Sidebar({
  role,
  realRole = null,
  adminPanelContext = "admin",
  procurementWorkspace = null,
  canSwitchProcurementWorkspace = false,
  assignedWorkspaces = [],
  adminModules = [],
  userEmail,
  salesPersonName,
  userAssignmentLabel,
  showLoginLink,
  navBadges = { nowe: 0, weryfikacja: 0, realizacja: 0, salesMoje: 0 },
  activeDelegations = [],
}: {
  role: UserRole | null;
  realRole?: UserRole | null;
  adminPanelContext?: AdminPanelContext;
  procurementWorkspace?: ProcurementWorkspace | null;
  canSwitchProcurementWorkspace?: boolean;
  assignedWorkspaces?: Workspace[];
  adminModules?: string[];
  userEmail?: string | null;
  salesPersonName?: string | null;
  userAssignmentLabel?: string | null;
  showLoginLink?: boolean;
  navBadges?: {
    nowe?: number;
    weryfikacja?: number;
    realizacja?: number;
    salesMoje?: number;
    salesZkDue?: number;
    salesNotesDue?: number;
    salesTablica?: number;
    adminBugReports?: number;
    operationsNotatki?: number;
    departmentBoardQuestions?: number;
    teethQueue?: number;
  };
  activeDelegations?: VacationDelegationRow[];
}) {
  const searchParams = useSearchParams();
  const previewDla = searchParams.get("dla");
  const adminSalesPreview = shouldPreserveSalesPreviewInNav(
    realRole,
    adminPanelContext,
    previewDla
  );
  const navLocked = useSalesNavLocked();
  const groups = role
    ? realRole && !isAdmin(realRole)
      ? filterNavGroupsByAccess(
          navForAppContext({
            realRole,
            navRole: role,
            procurementWorkspace,
            badges: navBadges,
          }),
          role,
          assignedWorkspaces,
          procurementWorkspace,
          adminModules
        )
      : filterNavGroupsByAccess(navForRole(role, navBadges), role, assignedWorkspaces, procurementWorkspace, adminModules)
    : [];
  const workspaceSubtitle = subtitleForProcurementWorkspace(procurementWorkspace);
  const [railCollapsed, toggleRail] = useSidebarCollapsed();
  useSidebarCollapseShortcut();
  const toggleLabel = railCollapsed ? "Rozwiń menu ( [ )" : "Zwiń menu ( [ )";

  async function signOut() {
    if (realRole && isAdmin(realRole)) {
      await actionClearAdminPanelContext();
    }
    await signOutToLogin();
  }

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 flex h-screen w-[var(--app-sidebar-w)] flex-col md:transition-[width] md:duration-200 md:ease-out motion-reduce:transition-none",
        brandSidebarShell
      )}
      data-collapsed={railCollapsed ? "true" : undefined}
    >
      <header className={cn(sidebarHeaderClass, "sb-full relative")}>
        <button
          type="button"
          onClick={toggleRail}
          title={toggleLabel}
          aria-label="Zwiń menu boczne"
          className={cn(
            "absolute right-2 top-2 rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700",
            sidebarFocusClass
          )}
        >
          <IconSidebarCollapse size={16} />
        </button>
        <SidebarBrandBlock
          role={realRole && isAdmin(realRole) ? realRole : role}
          workspaceSubtitle={workspaceSubtitle}
          userEmail={userEmail}
          salesPersonName={salesPersonName}
          userAssignmentLabel={userAssignmentLabel}
          activeDelegations={activeDelegations}
        />
      </header>
      <header className="sb-rail flex shrink-0 flex-col items-center gap-2 border-b border-slate-200 bg-slate-50 px-2 pb-3 pt-4">
        <Link href="/" aria-label="Strona główna" title="OnTime">
          <AppBrandMark size="sm" />
        </Link>
        <button
          type="button"
          onClick={toggleRail}
          title={toggleLabel}
          aria-label="Rozwiń menu boczne"
          className={cn(
            "rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700",
            sidebarFocusClass
          )}
        >
          <IconSidebarExpand size={16} />
        </button>
      </header>

      {procurementWorkspace ? (
        <div className={cn(
          "sb-full mx-2.5 mt-3 mb-1 flex items-center gap-2.5 rounded-md border border-slate-200 px-2.5 py-1.5",
        )}>
          <span
            className={cn(
              "flex h-6 w-6 shrink-0 items-center justify-center text-slate-500",
            )}
            aria-hidden
          >
            <NavIcon
              navKey={procurementWorkspace === "zeby" ? "teeth" : procurementWorkspace === "magazyn" ? "warehouse" : "dailyPanel"}
              size={15}
            />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] leading-tight text-slate-500">
              Obszar pracy
            </p>
            <p className="truncate text-[13px] font-semibold leading-tight text-slate-900">
              {labelForProcurementWorkspace(procurementWorkspace)}
            </p>
          </div>
        </div>
      ) : null}

      <nav className={cn(brandSidebarNavScroll, "sb-nav", navLocked && "opacity-80")}>
        {groups.map((g, index) => (
          <NavSection
            key={g.title}
            group={g}
            isFirst={index === 0}
            navLocked={navLocked}
            previewDla={previewDla}
            adminSalesPreview={adminSalesPreview}
          />
        ))}
      </nav>

      <div className={cn(brandSidebarFooter, "sb-rail")}>
        <div className="flex flex-col items-center gap-2">
          <ChangelogTriggerIconButton />
          <Link
            href="/ustawienia"
            className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700"
            aria-label="Ustawienia"
            title="Ustawienia"
          >
            <IconSettings size={16} />
          </Link>
          {showLoginLink ? null : (
            <button
              type="button"
              onClick={() => void signOut()}
              className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700"
              aria-label="Wyloguj"
              title="Wyloguj"
            >
              <IconLogOut size={16} />
            </button>
          )}
        </div>
      </div>
      <div className={cn(brandSidebarFooter, "sb-full")}>
        {realRole && isAdmin(realRole) ? (
          <AdminPanelContextSwitcher current={adminPanelContext} />
        ) : null}
        {canSwitchProcurementWorkspace && procurementWorkspace ? (
          <ProcurementWorkspaceSwitcher
            current={procurementWorkspace}
            options={PROCUREMENT_WORKSPACE_OPTIONS.filter((opt) =>
              grantedProcurementFunctions(realRole ?? role ?? "zakupy", assignedWorkspaces).includes(opt.value)
            )}
          />
        ) : null}
        {showLoginLink ? (
          <Link
            href="/login"
            className={cn(
              "inline-flex w-full min-h-10 items-center justify-center rounded-md px-4 py-2.5 text-sm font-medium transition-colors",
              buttonPrimaryClass
            )}
          >
            Zaloguj się
          </Link>
        ) : (
          <>
            <div className="flex items-stretch gap-2">
              <ChangelogTriggerIconButton />
              <Link
                href="/ustawienia"
                className="flex min-h-10 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white px-3 text-slate-500 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700"
                aria-label="Ustawienia"
              >
                <IconSettings size={16} />
              </Link>
              <button
                type="button"
                onClick={() => void signOut()}
                className="min-h-10 flex-1 rounded-md border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
              >
                Wyloguj
              </button>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
