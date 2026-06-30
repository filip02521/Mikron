"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import {
  teethManufacturerLabel,
  teethColorsFor,
  toothMouldsFor,
  hasMouldsForKind,
  expandTeethDetails,
  isTeethDetailComplete,
  TEETH_KIND_LABELS,
  type TeethManufacturer,
  type TeethLineDetail,
  type TeethJaw,
  type TeethKind,
} from "@/lib/teeth/teeth-catalog";
import { cn } from "@/lib/cn";
import {
  panelChoiceChipClass,
  panelChoiceChipIdleClass,
  panelChoiceChipSelectedClass,
  controlFocusClass,
} from "@/lib/ui/ontime-theme";

/**
 * TeethPicker — wybór parametrów klapki/klapek.
 *
 * `quantity` = liczba klapek (np. 4).
 * `details`  = tablica TeethLineDetail o długości quantity (jedna per klapka).
 * `onChange` = callback z nową tablicą details.
 *
 * Tryb "wszystkie takie same": jeden picker kopiowany na wszystkie pozycje.
 * Tryb "każda inna": N osobnych pickerów.
 */
export function TeethPicker({
  manufacturer,
  quantity,
  details,
  onChange,
  disabled,
  defaultKind,
}: {
  manufacturer: TeethManufacturer;
  quantity: number;
  details: TeethLineDetail[] | undefined;
  onChange: (details: TeethLineDetail[]) => void;
  disabled?: boolean;
  defaultKind?: TeethKind | null;
}) {
  const safeQty = Math.max(1, quantity || 1);
  const label = teethManufacturerLabel(manufacturer);

  const [allSame, setAllSame] = useState(true);
  const [activeKlapka, setActiveKlapka] = useState(0);

  useEffect(() => {
    setAllSame(true);
    setActiveKlapka(0);
  }, [safeQty]);

  const expanded = useMemo(
    () => expandTeethDetails(details, safeQty),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [details, safeQty],
  );

  useEffect(() => {
    if (defaultKind && expanded.some((d) => d.kind !== defaultKind)) {
      onChange(expanded.map((d) => ({ ...d, kind: defaultKind })));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultKind]);

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
        <SingleKlapkaPicker
          label={safeQty > 1 ? `Wszystkie ${safeQty} klapki` : undefined}
          manufacturer={manufacturer}
          detail={expanded[0] ?? { position: 1, color: "", mould: null, jaw: null, kind: defaultKind ?? null }}
          onChange={(patch) => handleChangeOne(0, patch)}
          disabled={disabled}
          lockedKind={defaultKind ?? null}
        />
      ) : (
        <KlapkaWizard
          expanded={expanded}
          manufacturer={manufacturer}
          disabled={disabled}
          defaultKind={defaultKind ?? null}
          activeKlapka={activeKlapka}
          onActiveChange={setActiveKlapka}
          onChangeOne={handleChangeOne}
        />
      )}
    </div>
  );
}

function KlapkaWizard({
  expanded,
  manufacturer,
  disabled,
  defaultKind,
  activeKlapka,
  onActiveChange,
  onChangeOne,
}: {
  expanded: TeethLineDetail[];
  manufacturer: TeethManufacturer;
  disabled?: boolean;
  defaultKind: TeethKind | null;
  activeKlapka: number;
  onActiveChange: (idx: number) => void;
  onChangeOne: (idx: number, patch: Partial<TeethLineDetail>) => void;
}) {
  const total = expanded.length;
  const current = expanded[activeKlapka] ?? expanded[0]!;
  const isLast = activeKlapka === total - 1;

  const isCurrentComplete = isTeethDetailComplete(current, manufacturer);

  const goNext = useCallback(() => {
    if (activeKlapka < total - 1) onActiveChange(activeKlapka + 1);
  }, [activeKlapka, total, onActiveChange]);

  const goPrev = useCallback(() => {
    if (activeKlapka > 0) onActiveChange(activeKlapka - 1);
  }, [activeKlapka, onActiveChange]);

  const completedCount = expanded.filter((d) => isTeethDetailComplete(d, manufacturer)).length;

  return (
    <div className="space-y-2.5">
      {/* Pasek nawigacji — doty statusu + licznik */}
      <div className="flex items-center gap-2">
        <div className="flex flex-wrap gap-1">
          {expanded.map((d, i) => {
            const complete = isTeethDetailComplete(d, manufacturer);
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
                    ? complete
                      ? "bg-violet-600 text-white ring-2 ring-violet-300"
                      : "bg-violet-600 text-white ring-2 ring-violet-300"
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

      {/* Aktywny picker */}
      <SingleKlapkaPicker
        label={`Klapka ${activeKlapka + 1} z ${total}`}
        manufacturer={manufacturer}
        detail={current}
        onChange={(patch) => onChangeOne(activeKlapka, patch)}
        disabled={disabled}
        lockedKind={defaultKind}
      />

      {/* Nawigacja prev/next */}
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

function SingleKlapkaPicker({
  label,
  manufacturer,
  detail,
  onChange,
  disabled,
  lockedKind,
}: {
  label?: string;
  manufacturer: TeethManufacturer;
  detail: TeethLineDetail;
  onChange: (patch: Partial<TeethLineDetail>) => void;
  disabled?: boolean;
  lockedKind?: TeethKind | null;
}) {
  const colors = useMemo(() => teethColorsFor(manufacturer), [manufacturer]);
  const jaw = (detail.jaw ?? null) as TeethJaw | null;
  const kind = (detail.kind ?? null) as TeethKind | null;
  const moulds = useMemo(
    () => (kind ? toothMouldsFor(manufacturer, kind) : []),
    [manufacturer, kind],
  );
  const showMoulds = kind != null && hasMouldsForKind(manufacturer, kind);

  const handleJaw = (j: TeethJaw) => {
    if (disabled) return;
    const next: Partial<TeethLineDetail> = { jaw: j };
    onChange(next);
  };

  const handleKind = (k: TeethKind) => {
    if (disabled) return;
    const next: Partial<TeethLineDetail> = { kind: k };
    if (k !== kind) next.mould = null;
    onChange(next);
  };

  const isComplete = !!jaw && !!kind && !!detail.color && (!showMoulds || !!detail.mould);

  return (
    <div className={cn(
      "rounded-md border bg-white p-3 space-y-3 transition-colors",
      isComplete ? "border-indigo-200/80" : "border-slate-200",
    )}>
      {label && (
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      )}

      {/* Szczęka */}
      <div>
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Szczęka{!jaw && <span className="ml-1 text-rose-500">*</span>}
        </p>
        <div className="flex gap-2">
          <JawButton label="Górna" value="upper" selected={jaw === "upper"} disabled={disabled} onSelect={handleJaw} />
          <JawButton label="Dolna" value="lower" selected={jaw === "lower"} disabled={disabled} onSelect={handleJaw} />
        </div>
      </div>

      {/* Typ zęba */}
      {lockedKind ? (
        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Typ
          </p>
          <div className="flex gap-2">
            <span className={cn(panelChoiceChipClass, "px-4 py-1.5 text-sm", panelChoiceChipSelectedClass)}>
              {TEETH_KIND_LABELS[lockedKind]}
            </span>
          </div>
        </div>
      ) : (
        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Typ{!kind && <span className="ml-1 text-rose-500">*</span>}
          </p>
          <div className="flex gap-2">
            <KindButton label={TEETH_KIND_LABELS.anterior} value="anterior" selected={kind === "anterior"} disabled={disabled} onSelect={handleKind} />
            <KindButton label={TEETH_KIND_LABELS.posterior} value="posterior" selected={kind === "posterior"} disabled={disabled} onSelect={handleKind} />
          </div>
        </div>
      )}

      {/* Kolor */}
      <div>
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Kolor{!detail.color && <span className="ml-1 text-rose-500">*</span>}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {colors.map((c) => (
            <ChipButton
              key={c}
              label={c}
              selected={detail.color === c}
              disabled={disabled}
              onSelect={() => !disabled && onChange({ color: c })}
            />
          ))}
        </div>
      </div>

      {/* Fason */}
      {showMoulds ? (
        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Fason / Wielkość{!detail.mould && <span className="ml-1 text-rose-500">*</span>}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {moulds.map((m) => (
              <ChipButton
                key={m}
                label={m}
                selected={detail.mould === m}
                disabled={disabled}
                onSelect={() => !disabled && onChange({ mould: m })}
              />
            ))}
          </div>
        </div>
      ) : kind != null ? (
        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Fason / Wielkość</p>
          <input
            type="text"
            value={detail.mould ?? ""}
            disabled={disabled}
            onChange={(e) => onChange({ mould: e.target.value || null })}
            placeholder="Wpisz fason lub zostaw puste"
            className={cn(
              "w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm",
              controlFocusClass,
              "disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400",
            )}
          />
        </div>
      ) : null}

      {/* Podsumowanie */}
      <KlapkaSummary detail={detail} complete={isComplete} />
    </div>
  );
}

function JawButton({
  label,
  value,
  selected,
  disabled,
  onSelect,
}: {
  label: string;
  value: TeethJaw;
  selected: boolean;
  disabled?: boolean;
  onSelect: (v: TeethJaw) => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onSelect(value)}
      aria-pressed={selected}
      className={cn(
        panelChoiceChipClass,
        "px-4 py-1.5 text-sm",
        selected ? panelChoiceChipSelectedClass : panelChoiceChipIdleClass,
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      {label}
    </button>
  );
}

function KindButton({
  label,
  value,
  selected,
  disabled,
  onSelect,
}: {
  label: string;
  value: TeethKind;
  selected: boolean;
  disabled?: boolean;
  onSelect: (v: TeethKind) => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onSelect(value)}
      aria-pressed={selected}
      className={cn(
        panelChoiceChipClass,
        "px-4 py-1.5 text-sm",
        selected ? panelChoiceChipSelectedClass : panelChoiceChipIdleClass,
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      {label}
    </button>
  );
}

function ChipButton({
  label,
  selected,
  disabled,
  onSelect,
}: {
  label: string;
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        panelChoiceChipClass,
        "px-2 py-0.5 text-xs",
        selected ? panelChoiceChipSelectedClass : panelChoiceChipIdleClass,
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      {label}
    </button>
  );
}

function KlapkaSummary({ detail, complete }: { detail: TeethLineDetail; complete: boolean }) {
  const parts: string[] = [];
  if (detail.jaw === "upper") parts.push("Górna");
  else if (detail.jaw === "lower") parts.push("Dolna");
  if (detail.kind) parts.push(TEETH_KIND_LABELS[detail.kind]);
  if (detail.color) parts.push(detail.color);
  if (detail.mould) parts.push(detail.mould);
  if (parts.length === 0) return null;
  return (
    <div className={cn(
      "flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium",
      complete
        ? "bg-indigo-50 text-indigo-800"
        : "bg-slate-50 text-slate-600",
    )}>
      {complete && (
        <svg className="h-3.5 w-3.5 shrink-0 text-indigo-500" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" />
        </svg>
      )}
      <span>{parts.join(" · ")}</span>
    </div>
  );
}
