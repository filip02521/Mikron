"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isNavItemActive, navForRole } from "@/lib/nav";
import { useSalesUpdates } from "@/components/sales/SalesUpdatesContext";
import { cn } from "@/lib/cn";

const icons: Record<string, React.ReactNode> = {
  "/moje": (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
      <rect x="9" y="3" width="6" height="4" rx="1" />
      <path d="M9 12h6M9 16h6" />
    </svg>
  ),
  "/prosba": (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  ),
  "/plan": (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  ),
};

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
      className="fixed inset-x-0 bottom-0 z-50 border-t border-[var(--card-border)] bg-[var(--card)]/95 shadow-[0_-4px_12px_-4px_rgba(15,23,42,0.06)] backdrop-blur-md md:hidden"
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
                  "relative flex min-h-[3.25rem] flex-col items-center justify-center gap-0.5 px-2 py-2 text-[10px] font-semibold transition-colors",
                  active ? "text-indigo-600" : "text-slate-500"
                )}
              >
                <span className={cn("relative", active && "text-indigo-600")}>
                  {icons[item.href] ?? (
                    <span className="h-[22px] w-[22px] rounded-full bg-slate-200" />
                  )}
                  {attentionBadge > 0 && !active ? (
                    <span className="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-indigo-600 px-1 text-[9px] font-bold text-white">
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
                    className="absolute right-[calc(50%-1.25rem)] top-2 h-2 w-2 rounded-full bg-amber-300 ring-2 ring-white"
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
