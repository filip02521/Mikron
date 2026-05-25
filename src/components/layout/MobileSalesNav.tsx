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

export function MobileSalesNav({
  navBadges = { salesMoje: 0 },
}: {
  navBadges?: { salesMoje?: number };
}) {
  const pathname = usePathname();
  const salesUpdates = useSalesUpdates();
  const items = navForRole("sales", navBadges)[0]?.items ?? [];

  return (
    <nav
      className={mobileSalesNavClass}
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      aria-label="Nawigacja handlowca"
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-around">
        {items.map((item) => {
          const siblingHrefs = items.map((i) => i.href);
          const active = isNavItemActive(pathname, item.href, siblingHrefs);
          const attentionBadge =
            item.badge != null && item.badge > 0 ? item.badge : 0;
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                className={cn(
                  mobileNavLinkBaseClass,
                  active ? mobileNavLinkActiveClass : mobileNavLinkIdleClass
                )}
                aria-current={active ? "page" : undefined}
              >
                <span className="relative">
                  <NavIcon href={item.href} size={22} className="text-current" />
                  {attentionBadge > 0 && !active ? (
                    <span
                      className={cn(
                        "absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold tabular-nums",
                        mobileNavBadgeClass
                      )}
                    >
                      {attentionBadge > 9 ? "9+" : attentionBadge}
                    </span>
                  ) : null}
                </span>
                <span className="max-w-full truncate">{item.label}</span>
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
