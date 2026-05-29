"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
import { isSalesManager } from "@/lib/auth-roles";
import type { UserRole } from "@/types/database";

export function MobileSalesNav({
  navBadges = { salesMoje: 0, salesNotatnik: 0 },
  role = "sales",
}: {
  navBadges?: { salesMoje?: number; salesNotatnik?: number };
  role?: UserRole;
}) {
  const pathname = usePathname();
  const salesUpdates = useSalesUpdates();
  const navRole = isSalesManager(role) ? "sales_manager" : "sales";
  const items = navForRole(navRole, navBadges)[0]?.items ?? [];

  return (
    <nav
      className={mobileSalesNavClass}
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
          return (
            <li key={item.href} className="min-w-0 flex-1">
              <Link
                href={item.href}
                className={cn(
                  mobileNavLinkBaseClass,
                  "px-1",
                  active ? mobileNavLinkActiveClass : mobileNavLinkIdleClass
                )}
                aria-current={active ? "page" : undefined}
                title={item.label}
              >
                <span className="relative">
                  <NavIcon href={item.href} size={20} className="text-current" />
                  {attentionBadge > 0 && !active ? (
                    <span
                      className={cn(
                        "absolute -right-1.5 -top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full px-0.5 text-[8px] font-bold tabular-nums",
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
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
