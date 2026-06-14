"use client";

import Link from "next/link";
import { ProsbaFormHelp } from "@/components/orders/ProsbaFormHelp";
import { IconClipboardList } from "@/components/icons/StrokeIcons";
import { cn } from "@/lib/cn";
import { pageToolbarSizingClass, pageToolbarSurfaceClass } from "@/lib/ui/ontime-theme";

export function ProsbaPageToolbar({
  mojeHref,
  mojeLabel = "Moje zamówienia",
}: {
  mojeHref: string;
  mojeLabel?: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Link
        href={mojeHref}
        className={cn(
          pageToolbarSurfaceClass,
          pageToolbarSizingClass,
          "gap-1.5 no-underline hover:bg-slate-50"
        )}
      >
        <IconClipboardList size={15} aria-hidden />
        {mojeLabel}
      </Link>
      <ProsbaFormHelp mojeHref={mojeHref} mojeLabel={mojeLabel} />
    </div>
  );
}
