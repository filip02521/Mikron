"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { isNavItemActive, navForRole, type NavGroup, type NavItem } from "@/lib/nav";
import { useSalesUpdates } from "@/components/sales/SalesUpdatesContext";
import { useOperationsUpdates } from "@/components/operations/OperationsUpdatesContext";
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
  sidebarNavBadgeClassForTone,
  sidebarNavToneActiveClass,
  sidebarNavToneHighlightIdleClass,
  controlFocusClass,
  panelTypography,
  buttonPrimaryClass,
} from "@/lib/ui/ontime-theme";
import { ONTIME_AUTH_FOOTER } from "@/lib/ui/ontime-brand";
import type { UserRole } from "@/types/database";
import { cn } from "@/lib/cn";
import { createClient } from "@/lib/supabase/client";
import { NavIcon, navIconTileActiveClassForTone, navIconTileClassForTone } from "@/components/icons/NavIcon";
import { useSalesNavLocked } from "@/components/sales/SalesOnboardingContext";
import { AdminPanelContextSwitcher } from "@/components/layout/AdminPanelContextSwitcher";
import { actionClearAdminPanelContext } from "@/app/actions/admin-panel-context";
import type { AdminPanelContext } from "@/lib/auth/admin-panel-context";
import { isAdmin } from "@/lib/auth-roles";
import { hrefWithAdminSalesPreview, shouldPreserveAdminSalesPreviewInNav } from "@/lib/nav/sales-preview-href";

function NavLink({
  item,
  active,
  showDot,
  locked,
  href,
}: {
  item: NavItem;
  active: boolean;
  showDot: boolean;
  locked?: boolean;
  href: string;
}) {
  const compact = item.tier === "compact";
  const hasBadge = item.badge != null && item.badge > 0;
  const showDescription = Boolean(item.description) && !compact;

  const className = cn(
    "group block rounded-md transition-colors",
    compact ? sidebarNavCompactPaddingClass : "px-2.5 py-2",
    controlFocusClass,
    active
      ? sidebarNavToneActiveClass(item.tone)
      : cn(
          navLinkIdleClass,
          item.tier === "primary" && sidebarNavToneHighlightIdleClass(item.tone)
        ),
    locked &&
      !active &&
      "cursor-not-allowed opacity-45 hover:border-transparent hover:bg-transparent hover:text-inherit"
  );

  const content = (
    <span className="flex items-start justify-between gap-2">
      <span className={cn("flex min-w-0 flex-1 items-start", compact ? "gap-2" : "gap-2.5")}>
        <span
          className={cn(
            "mt-0.5 flex shrink-0 items-center justify-center rounded-md transition-colors",
            compact ? "h-7 w-7" : "h-8 w-8",
            active
              ? navIconTileActiveClassForTone(item.tone)
              : cn(navIconTileClassForTone(item.tone), "group-hover:opacity-90")
          )}
        >
          <NavIcon navKey={item.icon} size={compact ? 16 : 17} />
        </span>
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
                active ? "text-slate-600" : "text-slate-400 group-hover:text-slate-500"
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
            className="h-2 w-2 rounded-full bg-amber-400 ring-2 ring-white"
            title="Nowe zmiany"
          />
        ) : null}
        {hasBadge ? (
          <span
            className={cn(
              "min-w-[1.25rem] rounded-md px-1.5 py-0.5 text-center text-[10px] font-semibold tabular-nums",
              sidebarNavBadgeClassForTone(item.tone, active)
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
  const salesUpdates = useSalesUpdates();
  const operationsUpdates = useOperationsUpdates();
  const allHrefs = group.items.map((item) => item.href);

  return (
    <section className={cn(!isFirst && sidebarNavSectionDividerClass)}>
      <h2 className={sidebarNavSectionTitleClass}>{group.title}</h2>
      <ul className="space-y-0.5">
        {group.items.map((item) => {
          const active = isNavItemActive(pathname, item.href, allHrefs);
          const showDot =
            (item.href === "/moje" && Boolean(salesUpdates?.hasUpdates) && !active) ||
            (item.href === "/podsumowanie" &&
              Boolean(operationsUpdates?.hasUpdates) &&
              !active);

          const href = hrefWithAdminSalesPreview(item.href, previewDla, adminSalesPreview);

          return (
            <li key={item.href}>
              <NavLink
                item={item}
                href={href}
                active={active}
                showDot={showDot}
                locked={navLocked}
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
  userEmail,
  salesPersonName,
  showLoginLink,
  navBadges = { nowe: 0, weryfikacja: 0, realizacja: 0, salesMoje: 0 },
}: {
  role: UserRole | null;
  realRole?: UserRole | null;
  adminPanelContext?: AdminPanelContext;
  userEmail?: string | null;
  salesPersonName?: string | null;
  showLoginLink?: boolean;
  navBadges?: {
    nowe?: number;
    weryfikacja?: number;
    realizacja?: number;
    salesMoje?: number;
    salesNotatnik?: number;
    salesTablica?: number;
    adminBugReports?: number;
    operationsNotatki?: number;
    departmentBoardQuestions?: number;
  };
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const previewDla = searchParams.get("dla");
  const adminSalesPreview = shouldPreserveAdminSalesPreviewInNav(
    realRole,
    adminPanelContext,
    previewDla
  );
  const navLocked = useSalesNavLocked();
  const groups = role ? navForRole(role, navBadges) : [];

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
          userEmail={userEmail}
          salesPersonName={salesPersonName}
        />
      </header>

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
            <button
              type="button"
              onClick={() => void signOut()}
              className="w-full min-h-10 rounded-md border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
            >
              Wyloguj
            </button>
            <p className="mt-2.5 text-center text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400">
              {ONTIME_AUTH_FOOTER}
            </p>
          </>
        )}
      </div>
    </aside>
  );
}
