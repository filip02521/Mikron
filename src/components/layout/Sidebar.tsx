"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { navForRole, sidebarSubtitle, type NavGroup, type NavItem } from "@/lib/nav";
import { useSalesUpdates } from "@/components/sales/SalesUpdatesContext";
import { AppBrandMark } from "@/components/ui/AppBrandMark";
import {
  brandMarkOnLightClass,
  brandSidebarFooter,
  brandSidebarNavScroll,
  brandSidebarShell,
} from "@/lib/ui/brand";
import type { UserRole } from "@/types/database";
import { cn } from "@/lib/cn";
import { createClient } from "@/lib/supabase/client";

function NavLink({
  item,
  active,
  showDot,
}: {
  item: NavItem;
  active: boolean;
  showDot: boolean;
}) {
  const hasBadge = item.badge != null && item.badge > 0;

  return (
    <Link
      href={item.href}
      className={cn(
        "group block rounded-lg px-3 py-2.5 transition-colors",
        active
          ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/20"
          : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
      )}
      aria-current={active ? "page" : undefined}
    >
      <span className="flex items-start justify-between gap-2">
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              "block text-sm leading-snug",
              active ? "font-semibold" : "font-medium"
            )}
          >
            {item.label}
          </span>
          {item.description ? (
            <span
              className={cn(
                "mt-0.5 block text-xs leading-snug",
                active ? "text-indigo-100" : "text-slate-400 group-hover:text-slate-500"
              )}
            >
              {item.description}
            </span>
          ) : null}
        </span>
        <span className="flex shrink-0 items-center gap-1.5 pt-0.5">
          {showDot ? (
            <span
              className="h-2 w-2 rounded-full bg-amber-400 ring-2 ring-white"
              title="Nowe zmiany"
            />
          ) : null}
          {hasBadge ? (
            <span
              className={cn(
                "min-w-[1.25rem] rounded-md px-1.5 py-0.5 text-center text-[10px] font-semibold tabular-nums",
                active ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"
              )}
            >
              {item.badge! > 99 ? "99+" : item.badge}
            </span>
          ) : null}
        </span>
      </span>
    </Link>
  );
}

function NavSection({
  group,
  isFirst,
}: {
  group: NavGroup;
  isFirst: boolean;
}) {
  const pathname = usePathname();
  const salesUpdates = useSalesUpdates();

  return (
    <section className={cn(!isFirst && "mt-3 border-t border-slate-100 pt-3")}>
      <h2 className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">
        {group.title}
      </h2>
      <ul className="space-y-0.5">
        {group.items.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          const showDot =
            item.href === "/moje" && Boolean(salesUpdates?.hasUpdates) && !active;

          return (
            <li key={item.href}>
              <NavLink item={item} active={active} showDot={showDot} />
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function Sidebar({
  role,
  userEmail,
  showLoginLink,
  navBadges = { nowe: 0, weryfikacja: 0, realizacja: 0, salesMoje: 0 },
}: {
  role: UserRole | null;
  userEmail?: string | null;
  showLoginLink?: boolean;
  navBadges?: {
    nowe?: number;
    weryfikacja?: number;
    realizacja?: number;
    salesMoje?: number;
  };
}) {
  const router = useRouter();
  const groups = role ? navForRole(role, navBadges) : [];

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 flex h-screen w-64 flex-col",
        brandSidebarShell
      )}
    >
      <header className="shrink-0 border-b border-slate-100 px-4 pb-4 pt-5">
        <div className="flex items-center gap-3">
          <AppBrandMark size="sm" className={brandMarkOnLightClass} />
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold tracking-tight text-slate-900">
              System Dostaw
            </p>
            <p className="text-xs text-slate-500">
              {role ? sidebarSubtitle(role) : "Niezalogowany"}
            </p>
          </div>
        </div>
        {userEmail ? (
          <p
            className="mt-3 truncate rounded-lg bg-slate-100 px-2.5 py-1.5 text-[11px] text-slate-600"
            title={userEmail}
          >
            {userEmail}
          </p>
        ) : null}
      </header>

      <nav className={brandSidebarNavScroll}>
        {groups.map((g, index) => (
          <NavSection key={g.title} group={g} isFirst={index === 0} />
        ))}
      </nav>

      <div className={brandSidebarFooter}>
        {showLoginLink ? (
          <Link
            href="/login"
            className="flex w-full min-h-10 items-center justify-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700"
          >
            Zaloguj się
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => void signOut()}
            className="w-full min-h-10 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Wyloguj
          </button>
        )}
        <p className="mt-2 text-center text-[10px] font-medium text-slate-400">
          Mikran
        </p>
      </div>
    </aside>
  );
}
