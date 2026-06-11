"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { isNavItemActive, navForRole } from "@/lib/nav";
import { useSalesUpdates } from "@/components/sales/SalesUpdatesContext";
import { cn } from "@/lib/cn";
import { NavIcon } from "@/components/icons/NavIcon";
import {
  mobileNavBadgeClass,
  mobileNavLinkActiveClass,
  mobileNavLinkBaseClass,
  mobileNavLinkIdleClass,
  mobileSalesNavClass,
} from "@/lib/ui/ontime-theme";
import { isAdmin, isSalesManager } from "@/lib/auth-roles";
import { hrefWithAdminSalesPreview } from "@/lib/nav/sales-preview-href";
import type { UserRole } from "@/types/database";
import { useSalesOnboardingOptional } from "@/components/sales/SalesOnboardingContext";

export function MobileSalesNav({
  navBadges = { salesMoje: 0, salesNotatnik: 0, salesTablica: 0 },
  role = "sales",
  realRole = null,
}: {
  navBadges?: { salesMoje?: number; salesNotatnik?: number; salesTablica?: number };
  role?: UserRole;
  realRole?: UserRole | null;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const previewDla = searchParams.get("dla");
  const preservePreviewDla = Boolean(realRole && isAdmin(realRole) && previewDla);
  const navLocked = useSalesOnboardingOptional()?.navLocked ?? false;
  const salesUpdates = useSalesUpdates();
  const navRole = isSalesManager(role) ? "sales_manager" : "sales";
  const groups = navForRole(navRole, navBadges);
  const items = [
    ...(groups[0]?.items ?? []),
    ...(isSalesManager(role) && groups[1]?.items[0] ? [groups[1].items[0]] : []),
  ];

  return (
    <nav
      className={cn(mobileSalesNavClass, navLocked && "opacity-90")}
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      aria-label="Nawigacja handlowca"
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-around gap-0.5 px-0.5">
        {items.map((item) => {
          const siblingHrefs = items.map((i) => i.href);
          const active = isNavItemActive(pathname, item.href, siblingHrefs);
          const attentionBadge =
            item.badge != null && item.badge > 0 ? item.badge : 0;
          const label = item.mobileLabel ?? item.label;
          const href = hrefWithAdminSalesPreview(item.href, previewDla, preservePreviewDla);
          const linkClass = cn(
            mobileNavLinkBaseClass,
            "px-1",
            active ? mobileNavLinkActiveClass : mobileNavLinkIdleClass,
            navLocked && !active && "pointer-events-none opacity-40"
          );

          const inner = (
            <>
              <span className="relative">
                <NavIcon href={item.href} size={20} className="text-current" />
                {attentionBadge > 0 && !active ? (
                  <span
                    className={cn(
                      "absolute -right-1.5 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-0.5 tabular-nums",
                      mobileNavBadgeClass
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

          return (
            <li key={item.href} className="min-w-0 flex-1">
              {navLocked && !active ? (
                <span
                  className={linkClass}
                  aria-disabled="true"
                  title="Dokończ wprowadzenie — użyj „Dalej” w panelu touru"
                >
                  {inner}
                </span>
              ) : (
                <Link
                  href={href}
                  className={linkClass}
                  aria-current={active ? "page" : undefined}
                  title={item.label}
                >
                  {inner}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
