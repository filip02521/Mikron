"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { isNavItemActive, navForRole, type NavGroup, type NavItem } from "@/lib/nav";
import { useSalesUpdates } from "@/components/sales/SalesUpdatesContext";
import { SidebarBrandBlock } from "@/components/layout/SidebarBrandBlock";
import {
  brandSidebarFooter,
  brandSidebarNavScroll,
  brandSidebarShell,
} from "@/lib/ui/brand";
import {
  navLinkActiveClass,
  navLinkIdleClass,
  sidebarBrandAccentClass,
  sidebarHeaderClass,
} from "@/lib/ui/ontime-theme";
import { ONTIME_AUTH_FOOTER } from "@/lib/ui/ontime-brand";
import { buttonPrimaryClass } from "@/lib/ui/ontime-theme";
import type { UserRole } from "@/types/database";
import { cn } from "@/lib/cn";
import { createClient } from "@/lib/supabase/client";
import {
  NavIcon,
  navIconKeyFromHref,
  navIconTileIdleClass,
} from "@/components/icons/NavIcon";
import { useSalesOnboardingOptional } from "@/components/sales/SalesOnboardingContext";

function NavLink({
  item,
  active,
  showDot,
  locked,
}: {
  item: NavItem;
  active: boolean;
  showDot: boolean;
  locked?: boolean;
}) {
  const hasBadge = item.badge != null && item.badge > 0;
  const isVerificationNav = item.href === "/weryfikacja";
  const iconKey = navIconKeyFromHref(item.href);

  const className = cn(
    "group block rounded-md px-3 py-2.5 transition-colors",
    active ? navLinkActiveClass : navLinkIdleClass,
    locked && !active && "cursor-not-allowed opacity-45 hover:bg-transparent hover:text-inherit"
  );

  const content = (
    <span className="flex items-start justify-between gap-2">
        <span className="flex min-w-0 flex-1 items-start gap-2.5">
          <span
            className={cn(
              "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md transition-colors",
              active
                ? "bg-white/15 text-white"
                : cn(navIconTileIdleClass(iconKey), "group-hover:opacity-90")
            )}
          >
            <NavIcon navKey={iconKey} size={18} />
          </span>
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
                active
                  ? "bg-white/20 text-white"
                  : isVerificationNav
                    ? "bg-amber-200 text-amber-950"
                    : "bg-slate-200 text-slate-700"
              )}
            >
              {item.badge! > 99 ? "99+" : item.badge}
            </span>
          ) : null}
        </span>
      </span>
  );

  if (locked && !active) {
    return (
      <span
        className={className}
        aria-disabled="true"
        title="Dokończ wprowadzenie — użyj przycisku Dalej w panelu touru"
      >
        {content}
      </span>
    );
  }

  return (
    <Link href={item.href} className={className} aria-current={active ? "page" : undefined}>
      {content}
    </Link>
  );
}

function NavSection({
  group,
  isFirst,
  navLocked,
}: {
  group: NavGroup;
  isFirst: boolean;
  navLocked: boolean;
}) {
  const pathname = usePathname();
  const salesUpdates = useSalesUpdates();

  return (
    <section className={cn(!isFirst && "mt-3 border-t border-slate-100 pt-3")}>
      <h2 className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-indigo-400/90">
        {group.title}
      </h2>
      <ul className="space-y-0.5">
        {group.items.map((item) => {
          const siblingHrefs = group.items.map((i) => i.href);
          const active = isNavItemActive(pathname, item.href, siblingHrefs);
          const showDot =
            item.href === "/moje" && Boolean(salesUpdates?.hasUpdates) && !active;

          return (
            <li key={item.href}>
              <NavLink item={item} active={active} showDot={showDot} locked={navLocked} />
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
    salesNotatnik?: number;
    adminBugReports?: number;
  };
}) {
  const router = useRouter();
  const navLocked = useSalesOnboardingOptional()?.navLocked ?? false;
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
      <header className={sidebarHeaderClass}>
        <div className={sidebarBrandAccentClass} aria-hidden />
        <SidebarBrandBlock role={role} userEmail={userEmail} />
      </header>

      <nav className={cn(brandSidebarNavScroll, navLocked && "opacity-80")}>
        {groups.map((g, index) => (
          <NavSection key={g.title} group={g} isFirst={index === 0} navLocked={navLocked} />
        ))}
      </nav>

      <div className={brandSidebarFooter}>
        {showLoginLink ? (
          <Link
            href="/login"
            className={cn(
              "inline-flex w-full min-h-10 items-center justify-center rounded-md px-4 py-2.5 text-sm font-medium transition-colors",
              buttonPrimaryClass
            )}
          >
            Zaloguj się
          </Link>
        ) : (
          <>
            <button
              type="button"
              onClick={() => void signOut()}
              className="w-full min-h-10 rounded-md border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
            >
              Wyloguj
            </button>
            <p className="mt-2.5 text-center text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400">
              {ONTIME_AUTH_FOOTER}
            </p>
          </>
        )}
      </div>
    </aside>
  );
}
