"use client";

import { usePathname } from "next/navigation";
import { isNavItemActive } from "@/lib/nav";
import { SectionTabNav } from "@/components/ui/SectionTabNav";

const SIBLING_HREFS = ["/zespol", "/zespol/handlowcy", "/zespol/grupy", "/zespol/urlopy"] as const;

const ITEMS = [
  { id: "/zespol", href: "/zespol", label: "Podgląd zespołu", hint: "Karty handlowców i skróty do próśb oraz ZK" },
  { id: "/zespol/handlowcy", href: "/zespol/handlowcy", label: "Handlowcy", hint: "Lista osób, konta i przypisanie do grup" },
  { id: "/zespol/grupy", href: "/zespol/grupy", label: "Grupy", hint: "Nazwy i kolejność grup w podglądzie" },
  { id: "/zespol/urlopy", href: "/zespol/urlopy", label: "Urlopy", hint: "Zastępstwa urlopowe handlowców" },
];

export function SalesTeamSubnav() {
  const pathname = usePathname();
  const active = ITEMS.find((item) => isNavItemActive(pathname, item.href, [...SIBLING_HREFS]))?.id ?? "/zespol";
  return <SectionTabNav activeTab={active} tabs={ITEMS} ariaLabel="Sekcje zespołu" embedded />;
}
