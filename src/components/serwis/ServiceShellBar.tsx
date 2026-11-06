"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AppBrandMark } from "@/components/ui/AppBrandMark";
import { OverflowMenu, OverflowMenuItem } from "@/components/ui/OverflowMenu";
import { NavIcon } from "@/components/icons/NavIcon";
import { IconCheck, IconLogOut, IconMonitor, IconMoon, IconPlus, IconSettings, IconSun, IconUsers } from "@/components/icons/StrokeIcons";
import { chooseTheme, useThemePreference } from "@/components/layout/use-theme-preference";
import { THEME_LABELS, THEME_ORDER } from "@/lib/auth/theme";
import { cn } from "@/lib/cn";
import { signOutToLogin } from "@/lib/auth/sign-out-client";
import { isNavItemActive, navForRole, type NavBadges } from "@/lib/nav";
import type { UserRole } from "@/types/database";

/** Kontrolka na ciemnym pasie: ten sam kształt co przycisk drugorzędny, kolory pasa. */
const THEME_ICON = { light: IconSun, dark: IconMoon, system: IconMonitor } as const;

const railControlClass =
  "border border-[var(--sv-rail-line)] bg-transparent text-[var(--sv-rail-ink)] shadow-none hover:border-[var(--sv-rail-muted)] hover:bg-[var(--sv-rail-hover)] focus-visible:ring-2 focus-visible:ring-[var(--sv-rail-active)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--sv-rail)]";

/**
 * Pas Serwisu: zamiast menu bocznego konto serwisanta ma u góry cztery widoki, „Przyjmij sprzęt” i konto.
 * Na telefonie widoki są w dolnym pasku (MobileOperationsNav), tu zostaje marka, przyjęcie i konto.
 */
export function ServiceShellBar({
  role,
  userEmail,
  userAssignmentLabel,
  navBadges,
}: {
  role: UserRole;
  userEmail?: string | null;
  userAssignmentLabel?: string | null;
  navBadges: NavBadges;
}) {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const items = navForRole(role, navBadges).flatMap((g) => g.items);
  const hrefs = items.map((i) => i.href);
  const theme = useThemePreference();
  const who = userAssignmentLabel || userEmail?.split("@")[0] || null;

  return (
    <header className="sticky top-0 z-30 shrink-0 bg-[var(--sv-rail)] pt-[env(safe-area-inset-top,0px)] text-[var(--sv-rail-ink)]">
      <div className="flex min-h-14 items-center gap-3 px-3 sm:px-5">
        <Link
          href="/serwis/zlecenia"
          className="flex min-h-11 shrink-0 items-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sv-rail-active)]"
          aria-label="Serwis — zlecenia"
        >
          <AppBrandMark size="sm" variant="dark" />
          <span className="flex flex-col leading-tight">
            <span className="font-display text-lg font-bold tracking-[-0.01em]">Serwis</span>
            {who ? <span className="text-[0.6875rem] text-[var(--sv-rail-muted)]">OnTime · {who}</span> : null}
          </span>
        </Link>

        <nav aria-label="Widoki serwisu" className="ml-2 hidden min-w-0 flex-1 items-center gap-1 md:flex">
          {items.map((item) => {
            const active = isNavItemActive(pathname, item.href, hrefs.filter((h) => h !== item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sv-rail-active)]",
                  active
                    ? "bg-[var(--sv-rail-active)] text-[var(--sv-rail-active-ink)]"
                    : "text-[var(--sv-rail-ink)] hover:bg-[var(--sv-rail-hover)]"
                )}
              >
                <NavIcon navKey={item.icon} size={18} />
                <span className="whitespace-nowrap">{item.mobileLabel ?? item.label}</span>
                {item.badge ? (
                  <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 text-[0.6875rem] font-semibold tabular-nums text-slate-950">
                    {item.badge}
                    <span className="sr-only"> po terminie</span>
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <Link
            href="/serwis/zlecenia?przyjmij=1"
            className="inline-flex min-h-11 items-center gap-2 rounded-md bg-[var(--sv-rail-active)] px-3 text-sm font-medium text-[var(--sv-rail-active-ink)] transition-colors duration-150 hover:bg-[var(--sv-rail-active-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sv-rail-active)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--sv-rail)] sm:px-4"
          >
            <IconPlus size={18} aria-hidden />
            <span className="hidden sm:inline">Przyjmij sprzęt</span>
            <span className="sr-only sm:hidden">Przyjmij sprzęt</span>
          </Link>
          <OverflowMenu
            label="Konto"
            iconOnly
            triggerLeading={<IconUsers size={18} />}
            triggerClassName={cn("h-11 w-11", railControlClass)}
          >
            {THEME_ORDER.map((option) => {
              const Icon = THEME_ICON[option];
              return (
                <OverflowMenuItem key={option} onClick={() => chooseTheme(option)}>
                  <span className="flex items-center gap-2">
                    <Icon size={16} />
                    <span className="flex-1">Motyw: {THEME_LABELS[option].toLowerCase()}</span>
                    {option === theme ? <IconCheck size={14} className="text-indigo-700" /> : null}
                  </span>
                </OverflowMenuItem>
              );
            })}
            <OverflowMenuItem onClick={() => router.push("/ustawienia")}>
              <span className="flex items-center gap-2">
                <IconSettings size={16} />
                Ustawienia
              </span>
            </OverflowMenuItem>
            <OverflowMenuItem onClick={() => void signOutToLogin()}>
              <span className="flex items-center gap-2">
                <IconLogOut size={16} />
                Wyloguj
              </span>
            </OverflowMenuItem>
          </OverflowMenu>
        </div>
      </div>
    </header>
  );
}
