"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  teethProductLineLabel,
  expandTeethDetails,
  isTeethDetailComplete,
  resolveTeethCatalogFromDraft,
  type TeethProductLine,
  type TeethLineDetail,
  type TeethKind,
  type TeethCatalogRef,
} from "@/lib/teeth/teeth-catalog";
import { TeethSpecFields, type TeethSpecFieldsDetail } from "@/components/teeth/TeethSpecFields";
import { cn } from "@/lib/cn";
import {
  panelChoiceChipClass,
  panelChoiceChipIdleClass,
  panelChoiceChipSelectedClass,
} from "@/lib/ui/ontime-theme";

/**
 * TeethPicker — wybór parametrów klapki/klapek (tryb inline, np. edycja).
 * W formularzu prośby preferowany jest TeethOrderBuilderModal.
 */
export function TeethPicker({
  productLine,
  manufacturer,
  quantity,
  details,
  onChange,
  disabled,
  defaultKind,
}: {
  productLine: TeethProductLine;
  manufacturer?: import("@/lib/teeth/teeth-catalog").TeethManufacturer;
  quantity: number;
  details: TeethLineDetail[] | undefined;
  onChange: (details: TeethLineDetail[]) => void;
  disabled?: boolean;
  defaultKind?: TeethKind | null;
}) {
  const catalog = useMemo(
    () => resolveTeethCatalogFromDraft({ teethProductLine: productLine, teethManufacturer: manufacturer ?? null })!,
    [productLine, manufacturer],
  );
  const safeQty = Math.max(1, quantity || 1);
  const label = teethProductLineLabel(productLine);

  const [allSame, setAllSame] = useState(true);
  const [activeKlapka, setActiveKlapka] = useState(0);
  const [qtyEpoch, setQtyEpoch] = useState(safeQty);
  if (safeQty !== qtyEpoch) {
    setQtyEpoch(safeQty);
    setAllSame(true);
    setActiveKlapka(0);
  }

  const expanded = useMemo(
    () => expandTeethDetails(details, safeQty),
    [details, safeQty],
  );

  useEffect(() => {
    if (defaultKind && expanded.some((d) => d.kind !== defaultKind)) {
      onChange(expanded.map((d) => ({ ...d, kind: defaultKind })));
    }
  }, [defaultKind, expanded, onChange]);

  const handleToggleAllSame = () => {
    if (allSame) {
      setAllSame(false);
    } else {
      const first = expanded[0] ?? { position: 1, color: "", mould: null, jaw: null };
      onChange(
        Array.from({ length: safeQty }, (_, i) => ({ ...first, position: i + 1 })),
      );
      setAllSame(true);
    }
  };

  const handleChangeOne = (idx: number, patch: Partial<TeethLineDetail>) => {
    const next = expanded.map((d, i) =>
      i === idx ? { ...d, ...patch } : d,
    );
    if (allSame) {
      onChange(
        Array.from({ length: safeQty }, (_, i) => ({ ...next[0]!, position: i + 1 })),
      );
    } else {
      onChange(next);
    }
  };

  const applySpecPatch = (idx: number, patch: Partial<TeethSpecFieldsDetail>) => {
    const rowPatch = { ...patch };
    delete rowPatch.jawMode;
    handleChangeOne(idx, rowPatch);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
          {label ?? "Zęby"}
          {safeQty > 1 && (
            <span className="ml-1.5 font-normal normal-case text-slate-400">
              ({safeQty} kl.)
            </span>
          )}
        </span>
        {safeQty > 1 && (
          <button
            type="button"
            disabled={disabled}
            onClick={handleToggleAllSame}
            className={cn(
              panelChoiceChipClass,
              "px-2 py-1 text-[11px]",
              allSame ? panelChoiceChipSelectedClass : panelChoiceChipIdleClass,
              disabled && "cursor-not-allowed opacity-50",
            )}
          >
            {allSame ? "Jednakowe" : "Różne klapki"}
          </button>
        )}
      </div>

      {allSame ? (
        <div className="rounded-md border border-slate-200 bg-white p-3">
          {safeQty > 1 ? (
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Wszystkie {safeQty} klapki
            </p>
          ) : null}
          <TeethSpecFields
            productLine={catalog.productLine}
            detail={expanded[0] ?? { position: 1, color: "", mould: null, jaw: null, kind: defaultKind ?? null }}
            lockedKind={defaultKind ?? null}
            disabled={disabled}
            allowJawBoth={false}
            onChange={(patch) => applySpecPatch(0, patch)}
          />
        </div>
      ) : (
        <KlapkaWizard
          expanded={expanded}
          catalog={catalog}
          disabled={disabled}
          defaultKind={defaultKind ?? null}
          activeKlapka={activeKlapka}
          onActiveChange={setActiveKlapka}
          onChangeOne={applySpecPatch}
        />
      )}
    </div>
  );
}

function KlapkaWizard({
  expanded,
  catalog,
  disabled,
  defaultKind,
  activeKlapka,
  onActiveChange,
  onChangeOne,
}: {
  expanded: TeethLineDetail[];
  catalog: TeethCatalogRef;
  disabled?: boolean;
  defaultKind: TeethKind | null;
  activeKlapka: number;
  onActiveChange: (idx: number) => void;
  onChangeOne: (idx: number, patch: Partial<TeethSpecFieldsDetail>) => void;
}) {
  const total = expanded.length;
  const current = expanded[activeKlapka] ?? expanded[0]!;
  const isLast = activeKlapka === total - 1;
  const isCurrentComplete = isTeethDetailComplete(current, catalog);

  const goNext = useCallback(() => {
    if (activeKlapka < total - 1) onActiveChange(activeKlapka + 1);
  }, [activeKlapka, total, onActiveChange]);

  const goPrev = useCallback(() => {
    if (activeKlapka > 0) onActiveChange(activeKlapka - 1);
  }, [activeKlapka, onActiveChange]);

  const completedCount = expanded.filter((d) => isTeethDetailComplete(d, catalog)).length;

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2">
        <div className="flex flex-wrap gap-1">
          {expanded.map((d, i) => {
            const complete = isTeethDetailComplete(d, catalog);
            const isActive = i === activeKlapka;
            return (
              <button
                key={i}
                type="button"
                disabled={disabled}
                onClick={() => onActiveChange(i)}
                aria-label={`Klapka ${i + 1}${complete ? " — gotowa" : " — do uzupełnienia"}`}
                className={cn(
                  "flex size-6 items-center justify-center rounded text-[11px] font-bold tabular-nums transition-colors",
                  isActive
                    ? "bg-violet-600 text-white ring-2 ring-violet-300"
                    : complete
                      ? "bg-violet-100 text-violet-700 hover:bg-violet-200"
                      : "bg-slate-100 text-slate-400 hover:bg-slate-200",
                  disabled && "cursor-not-allowed opacity-50",
                )}
              >
                {complete ? (
                  <svg className="h-3 w-3" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" />
                  </svg>
                ) : (
                  i + 1
                )}
              </button>
            );
          })}
        </div>
        <span className="ml-auto shrink-0 text-[11px] font-semibold text-slate-500 tabular-nums">
          {completedCount}/{total}
        </span>
      </div>

      <div className="rounded-md border border-slate-200 bg-white p-3">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Klapka {activeKlapka + 1} z {total}
        </p>
        <TeethSpecFields
          productLine={catalog.productLine}
          detail={current}
          lockedKind={defaultKind}
          disabled={disabled}
          allowJawBoth={false}
          onChange={(patch) => onChangeOne(activeKlapka, patch)}
        />
      </div>

      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          disabled={disabled || activeKlapka === 0}
          onClick={goPrev}
          className={cn(
            "rounded-md px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors",
            activeKlapka === 0
              ? "cursor-not-allowed opacity-40"
              : "hover:bg-slate-100 hover:text-slate-900",
          )}
        >
          ← Poprzednia
        </button>
        {!isLast ? (
          <button
            type="button"
            disabled={disabled}
            onClick={goNext}
            className={cn(
              "rounded-md bg-violet-600 px-4 py-1.5 text-xs font-semibold text-white transition-colors",
              "hover:bg-violet-700",
              disabled && "cursor-not-allowed opacity-50",
              !isCurrentComplete && "ring-2 ring-amber-300",
            )}
          >
            Następna →
          </button>
        ) : (
          <span className="rounded-md bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-700">
            Ostatnia klapka
          </span>
        )}
      </div>
    </div>
  );
}
