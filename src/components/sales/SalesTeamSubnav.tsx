"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { isNavItemActive } from "@/lib/nav";
import {
  controlFocusClass,
  panelChoiceChipClass,
  panelChoiceChipIdleClass,
  panelChoiceChipSelectedClass,
  salesChromeInsetClass,
} from "@/lib/ui/ontime-theme";

const SIBLING_HREFS = ["/zespol", "/zespol/handlowcy", "/zespol/grupy"] as const;

const TAB_CHIP_CLASS = cn(
  panelChoiceChipClass,
  "inline-flex min-h-11 shrink-0 items-center py-2 sm:min-h-9",
  controlFocusClass
);

export function SalesTeamSubnav() {
  const pathname = usePathname();

  const items = [
    { href: "/zespol", label: "Podgląd zespołu", title: "Karty handlowców i skróty do prośb oraz ZK" },
    { href: "/zespol/handlowcy", label: "Handlowcy", title: "Lista osób, konta i przypisanie do grup" },
    { href: "/zespol/grupy", label: "Grupy", title: "Nazwy i kolejność grup w podglądzie" },
  ] as const;

  return (
    <nav
      className={cn(
        "flex flex-wrap gap-2 border-b border-slate-100 bg-slate-50/60 py-2.5",
        salesChromeInsetClass
      )}
      aria-label="Sekcje zespołu"
    >
      {items.map((item) => {
        const active = isNavItemActive(pathname, item.href, [...SIBLING_HREFS]);
        return (
          <Link
            key={item.href}
            href={item.href}
            title={item.title}
            aria-current={active ? "page" : undefined}
            className={cn(
              TAB_CHIP_CLASS,
              active ? panelChoiceChipSelectedClass : panelChoiceChipIdleClass
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
