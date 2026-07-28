"use client";

import { IconAlertCircle } from "@/components/icons/StrokeIcons";
import {
  formatTeethShortageHitLabel,
  type TeethShortageMatchHit,
} from "@/lib/teeth/teeth-shortage-match";
import { TEETH_SHORTAGE_BANNER_TITLE } from "@/lib/teeth/teeth-shortage-copy";
import {
  teethProsbaIncompleteDetailClass,
  teethProsbaIncompleteIconClass,
  teethProsbaIncompleteTitleClass,
  teethProsbaStatusRowClass,
  teethProsbaShellIncompleteClass,
} from "@/lib/teeth/teeth-prosba-ui";
import { cn } from "@/lib/cn";

export function TeethShortageWarningBanner({
  hits,
  className,
}: {
  hits: TeethShortageMatchHit[];
  className?: string;
  /** Zachowane dla wywołań w builderze — treść jest taka sama. */
  compact?: boolean;
}) {
  if (hits.length === 0) return null;

  return (
    <div
      role="status"
      className={cn(
        teethProsbaStatusRowClass,
        teethProsbaShellIncompleteClass,
        className,
      )}
    >
      <IconAlertCircle
        size={18}
        strokeWidth={2.25}
        className={teethProsbaIncompleteIconClass}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <p className={teethProsbaIncompleteTitleClass}>{TEETH_SHORTAGE_BANNER_TITLE}</p>
        <ul className={cn(teethProsbaIncompleteDetailClass, "mt-1 space-y-0.5")}>
          {hits.map((hit) => {
            const note = hit.shortage.note?.trim();
            return (
              <li key={hit.shortage.id}>
                <span className="font-medium">{formatTeethShortageHitLabel(hit)}</span>
                {" — "}
                {hit.message}
                {note ? (
                  <span className="mt-0.5 block text-[11px] leading-snug text-amber-900/90">
                    {note}
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
        <p className="mt-1 text-[11px] leading-relaxed text-amber-800/80">
          Możesz wysłać prośbę mimo braku — to tylko ostrzeżenie.
        </p>
      </div>
    </div>
  );
}
