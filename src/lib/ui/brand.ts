import { cn } from "@/lib/cn";
import {
  brandMarkAppClass,
  sidebarFooterClass,
  sidebarNavScrollClass,
  sidebarShellClass,
} from "@/lib/ui/ontime-theme";
import { ONTIME_LOGO_SHAPE } from "@/lib/ui/ontime-brand";

/** Kolory marki — kształt (ONTIME_LOGO_SHAPE) ustawia AppBrandMark. */

export const brandMarkOnDarkClass = cn(
  ONTIME_LOGO_SHAPE,
  "bg-white/15 text-white shadow-lg shadow-black/20 ring-1 ring-white/20"
);

/** Logo OnTime na jasnym tle (sidebar, mobile). */
export const brandMarkOnLightClass = cn(ONTIME_LOGO_SHAPE, brandMarkAppClass);

/** @deprecated użyj brandMarkOnDarkClass — zachowane dla kompatybilności */
export const brandMarkClass = cn(
  "flex shrink-0 items-center justify-center text-sm font-bold",
  brandMarkOnDarkClass
);

export const brandSidebarShell = sidebarShellClass;

export const brandSidebarNavScroll = sidebarNavScrollClass;

export const brandSidebarFooter = sidebarFooterClass;
