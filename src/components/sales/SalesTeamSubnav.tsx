"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { isNavItemActive } from "@/lib/nav";
import {
  controlFocusClass,
  navLinkIdleClass,
  sidebarNavToneActiveClass,
} from "@/lib/ui/ontime-theme";

const SIBLING_HREFS = ["/zespol", "/zespol/handlowcy", "/zespol/grupy"] as const;

export function SalesTeamSubnav() {
  const pathname = usePathname();

  const items = [
    { href: "/zespol", label: "Podgląd zespołu" },
    { href: "/zespol/handlowcy", label: "Handlowcy" },
    {
      href: "/zespol/grupy",
      label: "Grupy",
    },
  ] as const;

  return (
    <nav
      className="flex flex-wrap gap-1 rounded-md bg-slate-50/35 p-1"
      aria-label="Sekcje zespołu"
    >
      {items.map((item) => {
        const active = isNavItemActive(pathname, item.href, [...SIBLING_HREFS]);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-md px-2.5 py-2 text-xs font-medium transition-colors",
              controlFocusClass,
              active
                ? sidebarNavToneActiveClass("slate")
                : cn(navLinkIdleClass, "text-slate-600")
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
