"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isNavItemActive } from "@/lib/nav";
import { useSalesTeamUi } from "@/components/sales/SalesTeamUiContext";

const SIBLING_HREFS = ["/zespol", "/zespol/handlowcy", "/zespol/grupy"] as const;

export function SalesTeamSubnav() {
  const pathname = usePathname();
  const teamUi = useSalesTeamUi();

  const items = [
    { href: "/zespol", label: "Podgląd zespołu" },
    { href: "/zespol/handlowcy", label: "Handlowcy i konta" },
    {
      href: "/zespol/grupy",
      label: teamUi.isManager ? "Przypisane grupy" : "Grupy",
    },
  ] as const;

  return (
    <nav
      className="flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-slate-50/80 p-1"
      aria-label="Sekcje zespołu"
    >
      {items.map((item) => {
        const active = isNavItemActive(pathname, item.href, [...SIBLING_HREFS]);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              active
                ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/80"
                : "text-slate-600 hover:bg-white/60 hover:text-slate-900"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
