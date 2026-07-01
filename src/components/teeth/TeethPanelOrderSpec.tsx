"use client";

import {
  groupTeethDetails,
  type TeethLineDetail,
} from "@/lib/teeth/teeth-catalog";
import { TeethPanelSpecList } from "@/components/teeth/TeethPanelSpecList";
import {
  teethPanelIncompleteDetailClass,
  teethPanelIncompleteShellClass,
  teethPanelIncompleteTitleClass,
  teethPanelSpecIncludedHintClass,
} from "@/lib/teeth/teeth-panel-ui";
import { cn } from "@/lib/cn";
import { plPozycja } from "@/lib/ui/polish-plurals";
import type { IndividualOrderTeethDetail } from "@/types/database";

function toLineDetails(
  details: IndividualOrderTeethDetail[] | null | undefined,
): TeethLineDetail[] {
  if (!details?.length) return [];
  return details.map((d) => ({
    position: d.position,
    color: d.color,
    mould: d.mould,
    jaw: d.jaw,
    kind: d.kind,
  }));
}

/** Specyfikacja zamówionych zębów — widoczna w panelu zakupów (kolejka + historia). */
export function TeethPanelOrderSpec({
  details,
  className,
  incomplete = false,
  specIncludedInBatch = false,
}: {
  details: IndividualOrderTeethDetail[] | null | undefined;
  className?: string;
  incomplete?: boolean;
  /** Lista scalona w podsumowaniu grupy — nie powtarzaj tabeli. */
  specIncludedInBatch?: boolean;
}) {
  const lines = toLineDetails(details);
  const total = lines.length;

  if (total === 0) {
    return (
      <div
        className={cn(
          teethPanelIncompleteShellClass,
          "px-2.5 py-2 sm:px-3",
          className,
        )}
        role="status"
      >
        <p className={teethPanelIncompleteTitleClass}>Brak listy zębów</p>
        <p className={teethPanelIncompleteDetailClass}>
          Handlowiec nie uzupełnił specyfikacji. Sprawdź uwagi lub skontaktuj się przed
          zamówieniem.
        </p>
      </div>
    );
  }

  if (incomplete) {
    return (
      <div className={cn(teethPanelIncompleteShellClass, "px-2.5 py-2", className)} role="status">
        <p className={teethPanelIncompleteTitleClass}>Lista niekompletna</p>
        <p className={teethPanelIncompleteDetailClass}>
          Brakuje koloru, fasonu, szczęki lub typu przy co najmniej jednej sztuce.
        </p>
        <TeethPanelSpecList
          details={lines}
          className="mt-2 border-amber-200/60 bg-white/70"
          compact
        />
      </div>
    );
  }

  if (specIncludedInBatch) {
    const groups = groupTeethDetails(lines);
    const pieceCount = groups.reduce((sum, g) => sum + Math.max(1, g.count), 0);
    return (
      <p className={cn(teethPanelSpecIncludedHintClass, className)} role="status">
        {pieceCount} {plPozycja(pieceCount)} uwzględnione w podsumowaniu u góry
      </p>
    );
  }

  return (
    <TeethPanelSpecList
      details={lines}
      className={cn(className)}
      totalLabel={`${total} ${plPozycja(total)}`}
    />
  );
}
