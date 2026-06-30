import {
  IconArchive,
  IconBuilding,
  IconCalendar,
  IconCalendarRange,
  IconClipboardList,
  IconClipboardPen,
  IconInbox,
  IconLayers,
  IconLayoutPanel,
  IconMessageSquare,
  IconNotepad,
  IconPackage,
  IconPackageCheck,
  IconPlusCircle,
  IconSettings,
  IconSun,
  IconUserCog,
  IconUserGroup,
  IconUsers,
  IconWarehouse,
  type StrokeIconProps,
} from "@/components/icons/StrokeIcons";
import type { NavIconKey, NavTone } from "@/lib/nav";

export type { NavIconKey } from "@/lib/nav";

const NAV_ICON_BY_KEY: Record<
  NavIconKey,
  (props: StrokeIconProps) => React.ReactElement
> = {
  dailyPanel: IconLayoutPanel,
  verification: IconClipboardPen,
  warehouse: IconWarehouse,
  history: IconArchive,
  suppliers: IconBuilding,
  schedule: IconCalendarRange,
  vacation: IconSun,
  groupOrder: IconLayers,
  admin: IconSettings,
  bugReport: IconMessageSquare,
  catalog: IconPackage,
  myOrders: IconClipboardList,
  newRequest: IconPlusCircle,
  plan: IconCalendar,
  notepad: IconNotepad,
  clientZk: IconPackageCheck,
  board: IconInbox,
  team: IconUsers,
  teamAccounts: IconUserCog,
  teamGroups: IconUserGroup,
  teeth: IconPackage,
};

const HREF_TO_NAV_ICON: Record<string, NavIconKey> = {
  "/podsumowanie": "dailyPanel",
  "/weryfikacja": "verification",
  "/kolejka": "warehouse",
  "/dostawy": "schedule",
  "/historia": "history",
  "/zakupy/dostawcy": "suppliers",
  "/admin/dostawcy": "suppliers",
  "/lokalizacje/POLSKA": "schedule",
  "/zakupy/urlopy": "vacation",
  "/admin/urlopy": "vacation",
  "/zamowienia/nowe": "groupOrder",
  "/admin": "admin",
  "/admin/zgloszenia": "bugReport",
  "/admin/produkty": "catalog",
  "/moje": "myOrders",
  "/prosba": "newRequest",
  "/plan": "plan",
  "/notatnik": "notepad",
  "/zk": "clientZk",
  "/notatki": "notepad",
  "/tablica": "board",
  "/zakupy/tablica": "board",
  "/zespol": "team",
  "/zespol/handlowcy": "teamAccounts",
  "/zespol/grupy": "teamGroups",
  "/zeby": "teeth",
};

export function navIconKeyFromHref(href: string): NavIconKey {
  const path = href.split("?")[0]!;
  if (HREF_TO_NAV_ICON[path]) return HREF_TO_NAV_ICON[path]!;
  if (HREF_TO_NAV_ICON[href]) return HREF_TO_NAV_ICON[href]!;
  if (path.startsWith("/lokalizacje/")) return "schedule";
  if (path.startsWith("/admin/dostawcy") || path.startsWith("/admin/urlopy")) {
    return path.includes("/urlopy") ? "vacation" : "suppliers";
  }
  if (path.startsWith("/zespol/handlowcy")) return "teamAccounts";
  if (path.startsWith("/zespol/grupy")) return "teamGroups";
  if (path.startsWith("/zespol")) return "team";
  if (path.startsWith("/admin")) return "admin";
  return "dailyPanel";
}

/** Kolor kafelka ikony — semantyka jak w panelu dziennym i na stronach modułów. */
export function navIconTileClassForTone(tone: NavTone): string {
  switch (tone) {
    case "amber":
      return "bg-amber-100 text-amber-800";
    case "orange":
      return "bg-orange-100 text-orange-900";
    case "emerald":
      return "bg-emerald-100 text-emerald-800";
    case "sky":
      return "bg-sky-100 text-sky-800";
    case "slate":
      return "bg-slate-100 text-slate-700";
    case "violet":
      return "bg-violet-100 text-violet-800";
    case "indigo":
    default:
      return "bg-indigo-100 text-indigo-800";
  }
}

/** Aktywny kafelek — ten sam ton, lekko mocniejszy kontrast + ring. */
export function navIconTileActiveClassForTone(tone: NavTone): string {
  switch (tone) {
    case "amber":
      return "bg-amber-100 text-amber-900 ring-1 ring-amber-200/80 shadow-sm shadow-amber-900/5";
    case "orange":
      return "bg-orange-100 text-orange-950 ring-1 ring-orange-200/80 shadow-sm shadow-orange-900/5";
    case "emerald":
      return "bg-emerald-100 text-emerald-900 ring-1 ring-emerald-200/80 shadow-sm shadow-emerald-900/5";
    case "sky":
      return "bg-sky-100 text-sky-900 ring-1 ring-sky-200/80 shadow-sm shadow-sky-900/5";
    case "slate":
      return "bg-slate-100 text-slate-800 ring-1 ring-slate-200/80";
    case "violet":
      return "bg-violet-100 text-violet-900 ring-1 ring-violet-200/80 shadow-sm shadow-violet-900/5";
    case "indigo":
    default:
      return "bg-indigo-100 text-indigo-900 ring-1 ring-indigo-200/70 shadow-sm shadow-indigo-900/5";
  }
}

/** @deprecated Użyj {@link navIconTileClassForTone} z tonem z NavItem. */
export function navIconTileIdleClass(key: NavIconKey): string {
  switch (key) {
    case "verification":
      return navIconTileClassForTone("amber");
    case "warehouse":
      return navIconTileClassForTone("emerald");
    case "suppliers":
    case "schedule":
    case "vacation":
      return navIconTileClassForTone("sky");
    case "history":
    case "groupOrder":
      return navIconTileClassForTone("slate");
    case "admin":
    case "bugReport":
    case "catalog":
      return navIconTileClassForTone("violet");
    default:
      return navIconTileClassForTone("indigo");
  }
}

export function NavIcon({
  href,
  navKey,
  className,
  size = 20,
}: {
  href?: string;
  navKey?: NavIconKey;
  className?: string;
  size?: number;
}) {
  const key = navKey ?? (href ? navIconKeyFromHref(href) : "dailyPanel");
  const Icon = NAV_ICON_BY_KEY[key];
  return <Icon className={className} size={size} />;
}
