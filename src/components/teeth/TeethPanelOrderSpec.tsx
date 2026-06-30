"use client";

import {
  formatTeethGroupLabel,
  groupTeethDetails,
  TEETH_KIND_LABELS,
  type TeethLineDetail,
} from "@/lib/teeth/teeth-catalog";
import { TeethGroupChips } from "@/components/teeth/TeethGroupChips";
import {
  teethPanelIncompleteDetailClass,
  teethPanelIncompleteShellClass,
  teethPanelIncompleteTitleClass,
  teethPanelSpecInsetClass,
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

function jawLabel(jaw: IndividualOrderTeethDetail["jaw"]): string {
  if (jaw === "upper") return "Góra";
  if (jaw === "lower") return "Dół";
  return "—";
}

function kindLabel(kind: IndividualOrderTeethDetail["kind"]): string {
  if (!kind) return "—";
  return TEETH_KIND_LABELS[kind];
}

/** Specyfikacja zamówionych zębów — widoczna w panelu zakupów (kolejka + historia). */
export function TeethPanelOrderSpec({
  details,
  className,
  compact = true,
  showPieceTable = false,
  incomplete = false,
}: {
  details: IndividualOrderTeethDetail[] | null | undefined;
  className?: string;
  compact?: boolean;
  showPieceTable?: boolean;
  incomplete?: boolean;
}) {
  const lines = toLineDetails(details);
  const groups = groupTeethDetails(lines);
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

  if (compact && !showPieceTable) {
    return (
      <div
        className={cn(
          teethPanelSpecInsetClass,
          incomplete && "border-amber-200/80 bg-amber-50/30",
          className,
        )}
        role="region"
        aria-label="Specyfikacja zębów"
      >
        {incomplete ? (
          <p className="mb-1.5 text-xs text-amber-900" role="status">
            Niekompletna — brakuje koloru, fasonu, szczęki lub typu przy co najmniej jednej sztuce.
          </p>
        ) : (
          <p className="mb-1.5 text-xs text-slate-500">
            {total} {plPozycja(total)}
          </p>
        )}
        <TeethGroupChips groups={groups} compact variant="panel" />
        <details className="group mt-1.5">
          <summary className="cursor-pointer list-none text-[11px] font-medium text-slate-600 marker:content-none hover:text-slate-900 [&::-webkit-details-marker]:hidden">
            <span className="inline-flex items-center gap-1">
              <span className="transition-transform group-open:rotate-90" aria-hidden>
                ▸
              </span>
              Szczegóły sztuk
            </span>
          </summary>
          <PieceTable details={details!} className="mt-1.5 border-t border-slate-200/80 pt-1.5" />
        </details>
      </div>
    );
  }

  return (
    <div
      className={cn(teethPanelSpecInsetClass, className)}
      role="region"
      aria-label="Specyfikacja zębów"
    >
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-200/80 pb-2">
        <p className="text-xs font-semibold text-slate-800">Lista zębów</p>
        <span className="text-xs text-slate-500 tabular-nums">
          {total} {plPozycja(total)}
        </span>
      </div>

      <ul className="divide-y divide-slate-100">
        {groups.map((group, index) => (
          <li
            key={`${group.color}-${group.mould}-${group.jaw}-${group.kind}-${index}`}
            className="py-1.5 text-sm font-medium leading-snug text-slate-800"
          >
            {formatTeethGroupLabel(group)}
          </li>
        ))}
      </ul>

      {showPieceTable ? (
        <PieceTable details={details!} className="mt-2 border-t border-slate-200/80 pt-2" />
      ) : null}
    </div>
  );
}

function PieceTable({
  details,
  className,
}: {
  details: IndividualOrderTeethDetail[];
  className?: string;
}) {
  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full min-w-[14rem] text-left text-xs">
        <thead>
          <tr className="border-b border-slate-200/80 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            <th className="w-7 py-1 pr-2">#</th>
            <th className="py-1 pr-2">Kolor</th>
            <th className="py-1 pr-2">Fason</th>
            <th className="py-1 pr-2">Szcz.</th>
            <th className="py-1">Typ</th>
          </tr>
        </thead>
        <tbody>
          {details.map((row) => (
            <tr key={row.id} className="border-b border-slate-100 last:border-b-0">
              <td className="py-1 pr-2 tabular-nums text-slate-500">{row.position}</td>
              <td className="py-1 pr-2 font-medium text-slate-900">{row.color || "—"}</td>
              <td className="py-1 pr-2 text-slate-800">{row.mould?.trim() || "—"}</td>
              <td className="py-1 pr-2 text-slate-800">{jawLabel(row.jaw)}</td>
              <td className="py-1 text-slate-800">{kindLabel(row.kind)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
