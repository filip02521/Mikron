"use client";

import { cn } from "@/lib/cn";

const links = [
  { href: "#dzis", label: "Do obsługi" },
  { href: "#plan", label: "Plan tygodnia" },
] as const;

export function DailyPanelNav() {
  return (
    <nav
      aria-label="Sekcje panelu"
      className="flex gap-1 rounded-xl border border-slate-200 bg-slate-50/80 p-1"
    >
      {links.map((link) => (
        <a
          key={link.href}
          href={link.href}
          className={cn(
            "flex-1 rounded-md px-3 py-2 text-center text-sm font-medium text-slate-600 sm:flex-none",
            "hover:bg-white hover:text-slate-900 hover:shadow-sm"
          )}
        >
          {link.label}
        </a>
      ))}
    </nav>
  );
}
