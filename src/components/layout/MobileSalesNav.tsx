"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  isNavItemActive,
  navForRole,
  navItemDisplayTone,
  navItemHasDueReminders,
  navMobileOverflowItems,
  navMobilePrimaryItems,
} from "@/lib/nav";
import { useSalesUpdates } from "@/components/sales/SalesUpdatesContext";
import { cn } from "@/lib/cn";
import { NavIcon } from "@/components/icons/NavIcon";
import { MobileNavOverflowSheet } from "@/components/layout/MobileNavOverflowSheet";
import {
  mobileNavAttentionIdleClass,
  mobileNavLinkBaseClass,
  mobileNavLinkIdleClass,
  mobileSalesNavClass,
  sidebarNavBadgeClassForTone,
  sidebarNavToneActiveClass,
} from "@/lib/ui/ontime-theme";
import { isSalesManager } from "@/lib/auth-roles";
import { hrefWithAdminSalesPreview, shouldPreserveSalesPreviewInNav } from "@/lib/nav/sales-preview-href";
import type { AdminPanelContext } from "@/lib/auth/admin-panel-context";
import type { UserRole } from "@/types/database";
import { useSalesNavLocked } from "@/components/sales/SalesOnboardingContext";

export function MobileSalesNav({
  navBadges = { salesMoje: 0, salesZkDue: 0, salesNotesDue: 0, salesTablica: 0 },
  role = "sales",
  realRole = null,
  adminPanelContext = "admin",
}: {
  navBadges?: {
    salesMoje?: number;
    salesZkDue?: number;
    salesNotesDue?: number;
    salesTablica?: number;
  };
  role?: UserRole;
  realRole?: UserRole | null;
  adminPanelContext?: AdminPanelContext;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const previewDla = searchParams.get("dla");
  const preservePreviewDla = shouldPreserveSalesPreviewInNav(
    realRole,
    adminPanelContext,
    previewDla
  );
  const navLocked = useSalesNavLocked();
  const salesUpdates = useSalesUpdates();
  const navRole = isSalesManager(role) ? "sales_manager" : "sales";
  const groups = navForRole(navRole, navBadges);
  const primaryItems = navMobilePrimaryItems(groups);
  const overflowItems = navMobileOverflowItems(groups);
  const allPrimaryHrefs = primaryItems.map((item) => item.href);

  return (
    <nav
      className={cn(mobileSalesNavClass, navLocked && "opacity-90")}
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      aria-label="Nawigacja handlowca"
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-around gap-0.5 px-0.5">
        {primaryItems.map((item) => {
          const active = isNavItemActive(pathname, item.href, allPrimaryHrefs);
          const attentionBadge =
            item.badge != null && item.badge > 0 ? item.badge : 0;
          const displayTone = navItemDisplayTone(item, active);
          const attentionIdle = navItemHasDueReminders(item) && !active;
          const label = item.mobileLabel ?? item.label;
          const href = hrefWithAdminSalesPreview(item.href, previewDla, preservePreviewDla);
          const linkClass = cn(
            mobileNavLinkBaseClass,
            "px-1",
            active
              ? sidebarNavToneActiveClass(item.tone)
              : attentionIdle
                ? mobileNavAttentionIdleClass
                : mobileNavLinkIdleClass,
            navLocked && !active && "pointer-events-none opacity-40"
          );

          const inner = (
            <>
              <span className="relative">
                <NavIcon navKey={item.icon} size={20} className="text-current" />
                {attentionBadge > 0 && !active ? (
                  <span
                    className={cn(
                      "absolute -right-1.5 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-0.5 tabular-nums text-[9px] font-bold lg:text-[10px]",
                      sidebarNavBadgeClassForTone(displayTone, false)
                    )}
                  >
                    {attentionBadge > 9 ? "9+" : attentionBadge}
                  </span>
                ) : null}
              </span>
              <span className="max-w-full truncate leading-tight">{label}</span>
              {item.href === "/moje" &&
              salesUpdates?.hasUpdates &&
              !active &&
              attentionBadge === 0 ? (
                <span
                  className="absolute right-[calc(50%-1.25rem)] top-2 h-2 w-2 rounded-full bg-amber-400 ring-2 ring-white"
                  aria-hidden
                />
              ) : null}
            </>
          );

          const isLockedItem = navLocked && !active;

          return (
            <li key={item.href} className="min-w-0 flex-1">
              <Link
                href={href}
                className={linkClass}
                aria-current={active ? "page" : undefined}
                aria-disabled={isLockedItem || undefined}
                tabIndex={isLockedItem ? -1 : undefined}
                title={
                  isLockedItem
                    ? "Dokończ wprowadzenie — użyj „Dalej” w panelu touru"
                    : item.label
                }
                onClick={isLockedItem ? (e) => e.preventDefault() : undefined}
              >
                {inner}
              </Link>
            </li>
          );
        })}
        <MobileNavOverflowSheet
          items={overflowItems}
          previewDla={previewDla}
          adminSalesPreview={preservePreviewDla}
          navLocked={navLocked}
        />
      </ul>
    </nav>
  );
}
