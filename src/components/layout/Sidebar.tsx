"use client";

import { useState, useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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
  sidebarNavCompactPaddingClass,
  sidebarNavAttentionIdleClass,
  sidebarNavBadgeClassForTone,
  sidebarNavToneActiveClass,
  sidebarNavToneHighlightIdleClass,
  navLinkDescriptionHoverClass,
  controlFocusClass,
  panelTypography,
  buttonPrimaryClass,
} from "@/lib/ui/ontime-theme";
import { ONTIME_AUTH_FOOTER } from "@/lib/ui/ontime-brand";
import type { UserRole, Workspace } from "@/types/database";
import { cn } from "@/lib/cn";
import { createClient } from "@/lib/supabase/client";
import { NavIcon, navIconTileActiveClassForTone, navIconTileClassForTone } from "@/components/icons/NavIcon";
import { IconSettings, IconChevronRight } from "@/components/icons/StrokeIcons";
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
  workspaceToneText,
  workspaceToneIconBg,
  workspaceToneAccent,
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
  const compact = item.tier === "compact";
  const indented = Boolean(item.indent);
  const hasBadge = item.badge != null && item.badge > 0;
  const showDescription = Boolean(item.description) && !compact;
  const displayTone = navItemDisplayTone(item, active);
  const attentionIdle = navItemHasDueReminders(item) && !active;
  const isMonthlyHref = item.href === MONTHLY_SUMMARY_HREF || href.split("?")[0] === MONTHLY_SUMMARY_HREF;
  const monthlyIdle = isMonthlyHref && monthlyAttention && !active;
  const showHighlight =
    !isMonthlyHref &&
    (item.tier === "primary" || Boolean(item.highlight));

  const className = cn(
    "group block rounded-md",
    compact ? sidebarNavCompactPaddingClass : "px-2.5 py-2",
    indented && "ml-5",
    controlFocusClass,
    active
      ? sidebarNavToneActiveClass(item.tone)
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
    <span className={cn("flex items-start justify-between gap-2", compact && "items-center")}>
      <span className={cn("flex min-w-0 flex-1", compact ? "items-center gap-2" : "items-start gap-2.5")}>
        {indented ? (
          <span className={cn("relative flex shrink-0 items-center", !compact && "mt-0.5")}>
            <span className="absolute -left-3 top-1/2 h-px w-3 bg-slate-300" />
            <span className="absolute -left-3 -top-2 bottom-1/2 w-px bg-slate-200" />
            <span
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-md",
                active
                  ? "bg-slate-100 text-slate-700 ring-1 ring-slate-200/80"
                  : "text-slate-400 group-hover:text-slate-600"
              )}
            >
              <NavIcon navKey={item.icon} size={item.icon === "teeth" ? 18 : 15} />
            </span>
          </span>
        ) : (
          <span
            className={cn(
              "flex shrink-0 items-center justify-center rounded-md",
              !compact && "mt-0.5",
              compact ? "h-7 w-7" : "h-8 w-8",
              active
                ? navIconTileActiveClassForTone(item.iconTone ?? item.tone)
                : navIconTileClassForTone(item.iconTone ?? displayTone)
            )}
          >
            <NavIcon navKey={item.icon} size={item.icon === "teeth" ? 19 : compact ? 16 : 17} />
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              compact ? "text-[13px] font-medium leading-snug" : panelTypography.rowTitle,
              active ? "font-semibold text-slate-900" : "text-slate-800"
            )}
          >
            {item.label}
          </span>
          {showDescription ? (
            <span
              className={cn(
                panelTypography.caption,
                "mt-0.5 block",
                active ? "text-slate-600" : cn("text-slate-400", navLinkDescriptionHoverClass)
              )}
            >
              {item.description}
            </span>
          ) : null}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-1.5 pt-0.5">
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
          ? "Dokończ wprowadzenie — użyj „Dalej” w panelu touru"
          : compact && item.description
            ? item.description
            : undefined
      }
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
          "group/section flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-all",
          controlFocusClass,
          collapsed
            ? "hover:bg-slate-50/70"
            : "bg-slate-50/40 hover:bg-slate-50/70",
          hasActiveItem && !collapsed && "bg-slate-50/60",
          hasMonthlyAttention && collapsed && "bg-violet-50/50"
        )}
        aria-expanded={!collapsed}
      >
        <span
          className={cn(
            "flex h-5 w-5 shrink-0 items-center justify-center rounded-md transition-all duration-200",
            collapsed
              ? "text-slate-300 group-hover/section:text-slate-400"
              : "text-slate-500 group-hover/section:text-slate-600"
          )}
        >
          <span
            className={cn(
              "transition-transform duration-200",
              collapsed ? "rotate-0" : "rotate-90"
            )}
          >
            <IconChevronRight size={13} aria-hidden />
          </span>
        </span>
        <h2
          className={cn(
            "flex-1 text-[10px] font-bold uppercase tracking-[0.12em]",
            collapsed ? "text-slate-400" : "text-slate-500"
          )}
        >
          {group.title}
        </h2>
        {hasMonthlyAttention && collapsed ? (
          <span
            className="h-2 w-2 shrink-0 rounded-full bg-violet-500 ring-2 ring-white"
            title="Nowe podsumowanie miesiąca"
          />
        ) : null}
        {totalBadge > 0 ? (
          <span className="shrink-0 rounded-md bg-slate-200/80 px-1.5 py-0.5 text-[9px] font-bold tabular-nums text-slate-600">
            {totalBadge > 99 ? "99+" : totalBadge}
          </span>
        ) : null}
      </button>
      {collapsed ? null : (
        <ul className="mt-1 space-y-0.5">
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
      <div className="flex items-center gap-2 px-2.5 pb-1.5 pt-2">
        <span className="h-5 w-5 shrink-0" aria-hidden />
        <h2 className={cn(sidebarNavSectionTitleClass, "flex-1 text-slate-500")}>{group.title}</h2>
      </div>
      <div className="mx-2.5 mb-1 h-px bg-slate-200/60" aria-hidden />
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
  const router = useRouter();
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
        )
      : filterNavGroupsByAccess(navForRole(role, navBadges), role, assignedWorkspaces, procurementWorkspace)
    : [];
  const workspaceSubtitle = subtitleForProcurementWorkspace(procurementWorkspace);

  async function signOut() {
    if (realRole && isAdmin(realRole)) {
      await actionClearAdminPanelContext();
    }
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 flex h-screen w-64 flex-col",
        brandSidebarShell
      )}
    >
      <header className={sidebarHeaderClass}>
        <SidebarBrandBlock
          role={realRole && isAdmin(realRole) ? realRole : role}
          workspaceSubtitle={workspaceSubtitle}
          userEmail={userEmail}
          salesPersonName={salesPersonName}
          userAssignmentLabel={userAssignmentLabel}
          activeDelegations={activeDelegations}
        />
      </header>

      {procurementWorkspace ? (
        <div className={cn(
          "mx-3 mt-3 mb-1 flex items-center gap-2 rounded-lg bg-slate-50/80 px-2.5 py-1.5 ring-1 ring-inset ring-slate-200/60",
        )}>
          <span
            className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
              workspaceToneIconBg(procurementWorkspace),
            )}
            aria-hidden
          >
            <NavIcon
              navKey={procurementWorkspace === "zeby" ? "teeth" : procurementWorkspace === "magazyn" ? "warehouse" : "dailyPanel"}
              size={15}
            />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">
              Obszar pracy
            </p>
            <p className={cn("truncate text-[12px] font-bold leading-tight", workspaceToneText(procurementWorkspace))}>
              {labelForProcurementWorkspace(procurementWorkspace)}
            </p>
          </div>
          <span
            className={cn(
              "shrink-0 h-1.5 w-1.5 rounded-full bg-current",
              workspaceToneAccent(procurementWorkspace),
            )}
            aria-hidden
          />
        </div>
      ) : null}

      <nav className={cn(brandSidebarNavScroll, navLocked && "opacity-80")}>
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

      <div className={brandSidebarFooter}>
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
            <p className="mt-2.5 text-center text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400">
              {ONTIME_AUTH_FOOTER}
            </p>
          </>
        )}
      </div>
    </aside>
  );
}
