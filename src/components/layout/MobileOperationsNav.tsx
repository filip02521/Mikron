"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  isNavItemActive,
  navForRole,
  navMobileOverflowItems,
  navMobilePrimaryItems,
} from "@/lib/nav";
import { useOperationsUpdates } from "@/components/operations/OperationsUpdatesContext";
import { cn } from "@/lib/cn";
import { NavIcon, navIconTileActiveClassForTone, navIconTileClassForTone } from "@/components/icons/NavIcon";
import { MobileNavOverflowSheet } from "@/components/layout/MobileNavOverflowSheet";
import {
  mobileNavBadgeClass,
  mobileNavLinkActiveClass,
  mobileNavLinkBaseClass,
  mobileNavLinkIdleClass,
  mobileSalesNavClass,
} from "@/lib/ui/ontime-theme";
import type { UserRole } from "@/types/database";

export function MobileOperationsNav({
  role,
  navBadges = { nowe: 0, weryfikacja: 0, realizacja: 0 },
}: {
  role: UserRole;
  navBadges?: {
    nowe?: number;
    weryfikacja?: number;
    realizacja?: number;
    operationsNotatki?: number;
    departmentBoardQuestions?: number;
  };
}) {
  const pathname = usePathname();
  const operationsUpdates = useOperationsUpdates();
  const groups = navForRole(role, navBadges);
  const primaryItems = navMobilePrimaryItems(groups);
  const overflowItems = navMobileOverflowItems(groups);
  const allPrimaryHrefs = primaryItems.map((item) => item.href);

  return (
    <nav
      className={mobileSalesNavClass}
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      aria-label={
        role === "magazyn" ? "Nawigacja magazynu" : "Nawigacja działu zakupów"
      }
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-around gap-0.5 px-0.5">
        {primaryItems.map((item) => {
          const active = isNavItemActive(pathname, item.href, allPrimaryHrefs);
          const attentionBadge = item.badge != null && item.badge > 0 ? item.badge : 0;
          const showLiveDot =
            item.href === "/podsumowanie" &&
            Boolean(operationsUpdates?.hasUpdates) &&
            !active;
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
                title={item.description ?? item.label}
              >
                <span className="relative flex flex-col items-center gap-0.5">
                  <span
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
                      active
                        ? navIconTileActiveClassForTone(item.tone)
                        : navIconTileClassForTone(item.tone)
                    )}
                  >
                    <NavIcon navKey={item.icon} size={18} />
                  </span>
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
                  {showLiveDot ? (
                    <span
                      className={cn(
                        "absolute h-2 w-2 rounded-full bg-amber-400 ring-2 ring-white",
                        attentionBadge > 0 && !active ? "-left-1 top-0" : "-right-1.5 -top-1"
                      )}
                      title="Nowe zmiany w panelu"
                    />
                  ) : null}
                </span>
                <span className="max-w-full truncate leading-tight">{label}</span>
              </Link>
            </li>
          );
        })}
        <MobileNavOverflowSheet items={overflowItems} />
      </ul>
    </nav>
  );
}
