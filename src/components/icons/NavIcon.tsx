import {
  IconAlertCircle,
  IconArchive,
  IconBuilding,
  IconCalendar,
  IconCalendarRange,
  IconChartTrend,
  IconClipboardList,
  IconClipboardPen,
  IconFilePlus,
  IconGlobe,
  IconInbox,
  IconLayers,
  IconLayoutPanel,
  IconMagazynGadki,
  IconMail,
  IconMessageSquare,
  IconNotepad,
  IconPackage,
  IconPackageCheck,
  IconPhone,
  IconPlusCircle,
  IconTooth,
  IconSettings,
  IconSun,
  IconTruck,
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
  magazynGadki: IconMagazynGadki,
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
  teeth: IconTooth,
  chartTrend: IconChartTrend,
  phone: IconPhone,
  truck: IconTruck,
  zdCreator: IconFilePlus,
  stockWatch: IconAlertCircle,
  customs: IconGlobe,
  mail: IconMail,
};

const HREF_TO_NAV_ICON: Record<string, NavIconKey> = {
  "/podsumowanie": "dailyPanel",
  "/podsumowanie-miesieczne": "chartTrend",
  "/weryfikacja": "verification",
  "/kolejka": "warehouse",
  "/zakupy/gadki": "magazynGadki",
  "/zakupy/szacunek": "zdCreator",
  "/zakupy/braki": "stockWatch",
  "/zakupy/odprawy": "customs",
  "/admin/wysylki": "mail",
  "/admin/mail": "mail",
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
  "/zespol/urlopy": "vacation",
  "/ustawienia": "admin",
  "/zeby": "teeth",
  "/kurierzy": "phone",
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
  if (path.startsWith("/zespol/urlopy")) return "vacation";
  if (path.startsWith("/zespol")) return "team";
  if (path.startsWith("/ustawienia")) return "admin";
  if (path.startsWith("/admin")) return "admin";
  return "dailyPanel";
}

/** Kolor kafelka ikony — semantyka jak w panelu dziennym i na stronach modułów. */
export function navIconTileClassForTone(tone: NavTone): string {
  // Ikony menu w jednym, neutralnym tonie (bez kolorowych kafelków).
  void tone;
  return "text-slate-500";
}

/** Aktywny kafelek — ten sam ton, lekko mocniejszy kontrast + ring. */
export function navIconTileActiveClassForTone(tone: NavTone): string {
  void tone;
  return "text-indigo-700";
}

/** @deprecated Użyj {@link navIconTileClassForTone} z tonem z NavItem. */
export function navIconTileIdleClass(key: NavIconKey): string {
  switch (key) {
    case "verification":
      return navIconTileClassForTone("amber");
    case "warehouse":
    case "magazynGadki":
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
