import { cn } from "@/lib/cn";
import { sectionIconTileBrandClass, sectionIconTileBrandSoftClass } from "@/lib/ui/ontime-theme";

export type StrokeIconProps = {
  className?: string;
  size?: number;
  strokeWidth?: number;
};

function Svg({
  children,
  className,
  size = 20,
  strokeWidth = 2,
  viewBox = "0 0 24 24",
}: StrokeIconProps & { children: React.ReactNode; viewBox?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={viewBox}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("shrink-0", className)}
      aria-hidden
    >
      {children}
    </svg>
  );
}

/** Lista prośb — Moje zamówienia */
export function IconClipboardList(props: StrokeIconProps) {
  return (
    <Svg {...props}>
      <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
      <rect x="9" y="3" width="6" height="4" rx="1" />
      <path d="M9 12h6M9 16h6" />
    </Svg>
  );
}

/** Nowa prośba */
export function IconPlusCircle(props: StrokeIconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v8M8 12h8" />
    </Svg>
  );
}

/** Harmonogram / plan */
export function IconCalendar(props: StrokeIconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </Svg>
  );
}

/** Potwierdzenie od handlowca */
export function IconCircleCheck(props: StrokeIconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.2l2.2 2.2L16 9.5" />
    </Svg>
  );
}

/** Ostrzeżenie / brakujące pole */
export function IconAlertCircle(props: StrokeIconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v4" />
      <path d="M12 16h.01" />
    </Svg>
  );
}

/** Informacja — okrąg z „i” */
export function IconInfoCircle(props: StrokeIconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <path d="M12 8h.01" />
    </Svg>
  );
}

/** Zamówienie u dostawcy */
export function IconTruck(props: StrokeIconProps) {
  return (
    <Svg {...props}>
      <path d="M14 18V6.2a2 2 0 00-2-2H4" />
      <path d="M15 9h2.5a1 1 0 01.9.6L20 13v5h-2" />
      <circle cx="7" cy="18" r="2" />
      <circle cx="17" cy="18" r="2" />
      <path d="M5 18H3v-5h6v5H9" />
    </Svg>
  );
}

/** Informacja o dostępności (bez zamówienia) — „sprawdzamy” */
export function IconAvailability(props: StrokeIconProps) {
  return (
    <Svg {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="M16.5 16.5L21 21" />
    </Svg>
  );
}

/** W toku / oczekiwanie */
export function IconClock(props: StrokeIconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </Svg>
  );
}

/** Pusta skrzynka */
export function IconInbox(props: StrokeIconProps) {
  return (
    <Svg {...props}>
      <path d="M4 4h16v5l-2 2H6L4 9V4z" />
      <path d="M4 9v9a2 2 0 002 2h12a2 2 0 002-2V9" />
      <path d="M9 13h6" />
    </Svg>
  );
}

/** Archiwum / zakończone */
export function IconArchive(props: StrokeIconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="4" width="18" height="4" rx="1" />
      <path d="M5 8v11a2 2 0 002 2h10a2 2 0 002-2V8" />
      <path d="M10 12h4" />
    </Svg>
  );
}

/** Usuń / kosz */
export function IconTrash2(props: StrokeIconProps) {
  return (
    <Svg {...props}>
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </Svg>
  );
}

/** Telefon */
export function IconPhone(props: StrokeIconProps) {
  return (
    <Svg {...props}>
      <path d="M8 3h5l2 2v14l-2 2H8l-2-2V5l2-2z" />
      <path d="M11 17h2" />
    </Svg>
  );
}

/** Strona WWW */
export function IconGlobe(props: StrokeIconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a15 15 0 010 18M12 3a15 15 0 000 18" />
    </Svg>
  );
}

/** E-mail / powiadomienie */
export function IconMail(props: StrokeIconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </Svg>
  );
}

/** Odbiór z magazynu */
export function IconPackageCheck(props: StrokeIconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" />
      <path d="M12 12l8-4.5M12 12v9M12 12L4 7.5" />
      <path d="M9.5 11.5l1.8 1.8 3.4-3.6" />
    </Svg>
  );
}

/** Weryfikacja prośb */
export function IconClipboardPen(props: StrokeIconProps) {
  return (
    <Svg {...props}>
      <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
      <rect x="9" y="3" width="6" height="4" rx="1" />
      <path d="M9 12h6M9 16h4" />
      <path d="M16 4.5l2.5 2.5M14.5 6l1.5 1.5" />
    </Svg>
  );
}

/** Terminy / harmonogram wielu dostawców */
export function IconCalendarRange(props: StrokeIconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
      <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" />
    </Svg>
  );
}

/** Magazyn / regał */
export function IconWarehouse(props: StrokeIconProps) {
  return (
    <Svg {...props}>
      <path d="M3 9h18M3 15h18M7 9v10M12 9v10M17 9v10" />
      <path d="M5 7h4v2H5zM10 7h4v2h-4zM15 7h4v2h-4z" />
    </Svg>
  );
}

/** Karty dostawców */
export function IconBuilding(props: StrokeIconProps) {
  return (
    <Svg {...props}>
      <path d="M4 21V9l8-4 8 4v12" />
      <path d="M9 21v-6h6v6M9 13h1M14 13h1M9 17h1M14 17h1" />
    </Svg>
  );
}

/** Urlopy */
export function IconSun(props: StrokeIconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </Svg>
  );
}

/** Zamówienie grupowe */
export function IconLayers(props: StrokeIconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3l8 4.5-8 4.5L4 7.5 12 3z" />
      <path d="M4 12.5l8 4.5 8-4.5M4 17.5l8 4.5 8-4.5" />
    </Svg>
  );
}

/** Zespół */
export function IconUsers(props: StrokeIconProps) {
  return (
    <Svg {...props}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20c0-3.3 2.7-5 6-5s6 1.7 6 5" />
      <path d="M16 11.5a2.5 2.5 0 010 5M19 20c0-2.2-1.3-3.5-3-4" />
    </Svg>
  );
}

/** Handlowcy i konta */
export function IconUserCog(props: StrokeIconProps) {
  return (
    <Svg {...props}>
      <circle cx="10" cy="8" r="3" />
      <path d="M4 20c0-3.3 2.4-5 6-5" />
      <circle cx="17.5" cy="17" r="2" />
      <path d="M17.5 14.8v.8M17.5 19.2v.8M15.3 17h.8M19.7 17h.8" />
    </Svg>
  );
}

/** Administracja */
export function IconSettings(props: StrokeIconProps) {
  return (
    <Svg {...props}>
      <path d="M12 15a3 3 0 100-6 3 3 0 000 6z" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </Svg>
  );
}

/** Menu „więcej” (pionowe kropki) */
export function IconMoreVertical(props: StrokeIconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="5" r="1.25" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.25" fill="currentColor" stroke="none" />
      <circle cx="12" cy="19" r="1.25" fill="currentColor" stroke="none" />
    </Svg>
  );
}

/** Uchwyt przeciągania (plan tygodnia) */
export function IconGripVertical(props: StrokeIconProps) {
  return (
    <Svg {...props}>
      <path d="M9 5v.01M9 12v.01M9 19v.01M15 5v.01M15 12v.01M15 19v.01" strokeWidth={2.5} />
    </Svg>
  );
}

export function IconChevronDown({
  open,
  className,
  size = 16,
}: StrokeIconProps & { open?: boolean }) {
  return (
    <Svg size={size} className={cn("transition-transform", open && "rotate-180", className)}>
      <path d="M6 9l6 6 6-6" />
    </Svg>
  );
}

export function IconChevronRight(props: StrokeIconProps) {
  return (
    <Svg {...props}>
      <path d="M9 6l6 6-6 6" />
    </Svg>
  );
}

export function IconChevronLeft(props: StrokeIconProps) {
  return (
    <Svg {...props}>
      <path d="M15 6l-6 6 6 6" />
    </Svg>
  );
}

/** Przypięta notatka / priorytet (pinezka) */
export function IconPin(props: StrokeIconProps) {
  return (
    <Svg {...props}>
      <path d="M12 17v5" />
      <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" />
    </Svg>
  );
}

/** Lupa wyszukiwania */
export function IconSearch(props: StrokeIconProps) {
  return (
    <Svg {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </Svg>
  );
}

/** Pomoc / instrukcja (okrąg z „?”) */
export function IconHelpCircle(props: StrokeIconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.5a2.5 2.5 0 114.5 1.5c0 2-2.5 2-2.5 3.5" />
      <path d="M12 17h.01" />
    </Svg>
  );
}

/** Klawiatura — skróty klawiszowe */
export function IconKeyboard(props: StrokeIconProps) {
  return (
    <Svg {...props} viewBox="0 0 24 24">
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M7 10h.01M11 10h.01M15 10h.01M19 10h.01M7 14h10" />
    </Svg>
  );
}

/** Legenda kolorów — cztery próbki (terminy / harmonogram). */
export function IconColorLegendSample({ className, size = 14 }: StrokeIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 14 14"
      fill="none"
      className={cn("shrink-0", className)}
      aria-hidden
    >
      <rect x="1" y="1" width="5" height="5" rx="1" fill="#eff6ff" stroke="#94a3b8" />
      <rect x="8" y="1" width="5" height="5" rx="1" fill="#fffde7" stroke="#94a3b8" />
      <rect x="1" y="8" width="5" height="5" rx="1" fill="#ffebee" stroke="#94a3b8" />
      <rect x="8" y="8" width="5" height="5" rx="1" fill="#e8f5e9" stroke="#94a3b8" />
    </svg>
  );
}

export type MojeSectionIconKind =
  | "action"
  | "teeth"
  | "zamowienie"
  | "before_order"
  | "informacja"
  | "archive";

export type PlanSectionIconKind = "calendar" | "prosby" | "search";

const MOJE_SECTION_ICON_MAP: Record<
  MojeSectionIconKind,
  (props: StrokeIconProps) => React.ReactElement
> = {
  action: IconCircleCheck,
  teeth: IconTooth,
  zamowienie: IconTruck,
  before_order: IconClipboardList,
  informacja: IconAvailability,
  archive: IconArchive,
};

export function MojeSectionIcon({
  kind,
  className,
  size = 18,
}: {
  kind: MojeSectionIconKind;
  className?: string;
  size?: number;
}) {
  const Icon = MOJE_SECTION_ICON_MAP[kind];
  return <Icon className={className} size={size} />;
}

export function mojeSectionIconTileClass(kind: MojeSectionIconKind): string {
  switch (kind) {
    case "action":
      return "bg-emerald-100 text-emerald-800";
    case "teeth":
      return "bg-violet-100 text-violet-800";
    case "zamowienie":
      return "bg-slate-100 text-slate-700";
    case "before_order":
      return "bg-indigo-50 text-indigo-800";
    case "informacja":
      return "bg-violet-100 text-violet-800";
    case "archive":
      return "bg-slate-200/80 text-slate-600";
  }
}

const PLAN_SECTION_ICON_MAP: Record<
  PlanSectionIconKind,
  (props: StrokeIconProps) => React.ReactElement
> = {
  calendar: IconCalendar,
  prosby: IconClipboardList,
  search: IconAvailability,
};

export function PlanSectionIcon({
  kind,
  className,
  size = 17,
}: {
  kind: PlanSectionIconKind;
  className?: string;
  size?: number;
}) {
  const Icon = PLAN_SECTION_ICON_MAP[kind];
  return <Icon className={className} size={size} />;
}

export function planSectionIconTileClass(kind: PlanSectionIconKind): string {
  switch (kind) {
    case "calendar":
      return sectionIconTileBrandClass;
    case "prosby":
      return sectionIconTileBrandClass;
    case "search":
      return "bg-violet-100 text-violet-800";
  }
}

/** Panel dzienny — nagłówek strony */
export function IconLayoutPanel(props: StrokeIconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </Svg>
  );
}

/** Powiązanie z Subiektem (aktywne) */
export function IconLink(props: StrokeIconProps) {
  return (
    <Svg {...props}>
      <path d="M10 13a5 5 0 007.07 0l1.41-1.41a5 5 0 00-7.07-7.07L10 5.93" />
      <path d="M14 11a5 5 0 00-7.07 0L5.52 12.41a5 5 0 007.07 7.07L14 18.07" />
    </Svg>
  );
}

/** Brak powiązania z Subiektem */
export function IconLinkOff(props: StrokeIconProps) {
  return (
    <Svg {...props}>
      <path d="M9 9l6 6" />
      <path d="M10.5 6.5l1.41-1.41a5 5 0 017.07 7.07L16.5 13.5" />
      <path d="M13.5 17.5l-1.41 1.41a5 5 0 01-7.07-7.07L7.5 10.5" />
    </Svg>
  );
}

/** Notatnik handlowca */
export function IconNotepad(props: StrokeIconProps) {
  return (
    <Svg {...props}>
      <path d="M8 2h8a2 2 0 012 2v16l-4-2-4 2-4-2-4 2V4a2 2 0 012-2z" />
      <path d="M9 7h6" />
      <path d="M9 11h6" />
    </Svg>
  );
}

/** Zgłoszenia / uwagi od użytkowników */
export function IconMessageSquare(props: StrokeIconProps) {
  return (
    <Svg {...props}>
      <path d="M21 15a2 2 0 01-2 2H8l-5 3V5a2 2 0 012-2h14a2 2 0 012 2z" />
      <path d="M8 9h8M8 13h5" />
    </Svg>
  );
}

/** Katalog produktów */
export function IconPackage(props: StrokeIconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" />
      <path d="M12 12l8-4.5M12 12v9M12 12L4 7.5" />
    </Svg>
  );
}

/** Grupy zespołu */
export function IconUserGroup(props: StrokeIconProps) {
  return (
    <Svg {...props}>
      <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 00-3-3.87" />
      <path d="M16 3.13a4 4 0 010 7.75" />
    </Svg>
  );
}

export type DailySectionIconKind = "dzis" | "prosby" | "harmonogram" | "plan" | "hidden";

const DAILY_SECTION_ICON_MAP: Record<
  DailySectionIconKind,
  (props: StrokeIconProps) => React.ReactElement
> = {
  dzis: IconCircleCheck,
  prosby: IconClipboardList,
  harmonogram: IconTruck,
  plan: IconCalendar,
  hidden: IconArchive,
};

export function DailySectionIcon({
  kind,
  className,
  size = 17,
}: {
  kind: DailySectionIconKind;
  className?: string;
  size?: number;
}) {
  const Icon = DAILY_SECTION_ICON_MAP[kind];
  return <Icon className={className} size={size} />;
}

/** Ząb — prosty zaryst zęba */
export function IconTooth(props: StrokeIconProps) {
  return (
    <Svg {...props}>
      <path d="M7 3c-2 0-3.5 1.5-3.5 4 0 2 .5 3.5 1 5.5s.5 4 1 6c.3 1.2.8 2 1.5 2s1-.8 1-2c0-1.5.5-3 2-3s2 1.5 2 3c0 1.2.3 2 1 2s1.2-.8 1.5-2c.5-2 .5-4 1-6s1-3.5 1-5.5c0-2.5-1.5-4-3.5-4-1.5 0-2 .5-3 .5S8.5 3 7 3z" transform="translate(2 0)" />
    </Svg>
  );
}

export function dailySectionIconTileClass(kind: DailySectionIconKind): string {
  switch (kind) {
    case "dzis":
      return "bg-emerald-100 text-emerald-800";
    case "prosby":
      return sectionIconTileBrandClass;
    case "harmonogram":
      return "bg-amber-100 text-amber-800";
    case "plan":
      return sectionIconTileBrandSoftClass;
    case "hidden":
      return "bg-indigo-100/70 text-indigo-800/90";
  }
}
