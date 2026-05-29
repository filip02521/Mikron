import {
  IconArchive,
  IconBuilding,
  IconCalendar,
  IconCalendarRange,
  IconClipboardList,
  IconClipboardPen,
  IconLayers,
  IconLayoutPanel,
  IconPlusCircle,
  IconSettings,
  IconSun,
  IconUserCog,
  IconUsers,
  IconWarehouse,
  IconNotepad,
  type StrokeIconProps,
} from "@/components/icons/StrokeIcons";

export type NavIconKey =
  | "dailyPanel"
  | "verification"
  | "warehouse"
  | "history"
  | "suppliers"
  | "schedule"
  | "vacation"
  | "groupOrder"
  | "admin"
  | "myOrders"
  | "newRequest"
  | "plan"
  | "notepad"
  | "team"
  | "teamAccounts";

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
  myOrders: IconClipboardList,
  newRequest: IconPlusCircle,
  plan: IconCalendar,
  notepad: IconNotepad,
  team: IconUsers,
  teamAccounts: IconUserCog,
};

const HREF_TO_NAV_ICON: Record<string, NavIconKey> = {
  "/podsumowanie": "dailyPanel",
  "/weryfikacja": "verification",
  "/kolejka": "warehouse",
  "/historia": "history",
  "/zakupy/dostawcy": "suppliers",
  "/lokalizacje/POLSKA": "schedule",
  "/zakupy/urlopy": "vacation",
  "/zamowienia/nowe": "groupOrder",
  "/admin": "admin",
  "/moje": "myOrders",
  "/prosba": "newRequest",
  "/plan": "plan",
  "/notatnik": "notepad",
  "/zespol": "team",
  "/zespol/handlowcy": "teamAccounts",
  "/zespol/grupy": "teamAccounts",
};

export function navIconKeyFromHref(href: string): NavIconKey {
  if (HREF_TO_NAV_ICON[href]) return HREF_TO_NAV_ICON[href]!;
  if (href.startsWith("/lokalizacje/")) return "schedule";
  if (href.startsWith("/zespol/handlowcy")) return "teamAccounts";
  if (href.startsWith("/zespol")) return "team";
  if (href.startsWith("/admin")) return "admin";
  return "dailyPanel";
}

export function navIconTileIdleClass(key: NavIconKey): string {
  switch (key) {
    case "dailyPanel":
    case "myOrders":
    case "newRequest":
    case "plan":
    case "notepad":
    case "schedule":
    case "team":
      return "bg-indigo-100 text-indigo-700";
    case "verification":
      return "bg-amber-100 text-amber-800";
    case "warehouse":
      return "bg-emerald-100 text-emerald-800";
    case "history":
      return "bg-indigo-50 text-indigo-700";
    case "suppliers":
      return "bg-sky-50 text-sky-800";
    case "teamAccounts":
      return "bg-indigo-50/90 text-indigo-700";
    case "vacation":
      return "bg-sky-100 text-sky-800";
    case "groupOrder":
    case "admin":
      return "bg-violet-100 text-violet-800";
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
