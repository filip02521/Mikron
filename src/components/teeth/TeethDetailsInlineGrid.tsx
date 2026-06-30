"use client";

import { useEffect, useMemo, useState } from "react";
import {
  teethProductLineLabel,
  teethColorsFor,
  toothMouldsFor,
  hasMouldsForKind,
  expandTeethDetails,
  resolveTeethCatalog,
  type TeethProductLine,
  type TeethKind,
  type TeethLineDetail,
} from "@/lib/teeth/teeth-catalog";
import { Badge } from "@/components/ui/Badge";
import { fieldControlClass } from "@/components/ui/Field";
import { cn } from "@/lib/cn";
import { panelTypography } from "@/lib/ui/ontime-theme";

export function TeethDetailsInlineGrid({
  productLine,
  quantity,
  details,
  onChange,
  disabled,
  kind = "anterior",
}: {
  productLine: TeethProductLine;
  quantity: number;
  details: TeethLineDetail[] | undefined;
  onChange: (details: TeethLineDetail[]) => void;
  disabled?: boolean;
  kind?: TeethKind;
}) {
  const [allSame, setAllSame] = useState(true);
  const catalog = useMemo(
    () => resolveTeethCatalog({ adminProductLine: productLine })!,
    [productLine],
  );
  const showMoulds = hasMouldsForKind(catalog, kind);
  const colors = useMemo(() => teethColorsFor(catalog), [catalog]);
  const moulds = useMemo(() => toothMouldsFor(catalog, kind), [catalog, kind]);

  const safeQty = Math.max(1, quantity || 1);

  const expanded = useMemo(
    () => expandTeethDetails(details, allSame ? 1 : safeQty),
    [details, allSame, safeQty],
  );

  useEffect(() => {
    if (allSame) {
      if (details && details.length > 0 && details.length !== safeQty) {
        const first = details[0]!;
        onChange(
          Array.from({ length: safeQty }, (_, i) => ({
            position: i + 1,
            color: first.color,
            mould: first.mould ?? null,
            jaw: first.jaw ?? null,
            kind: first.kind ?? kind,
          })),
        );
      }
      return;
    }
    const next = expandTeethDetails(details, safeQty);
    if (next.length !== details?.length) {
      onChange(next);
    }
  }, [safeQty, allSame, details, onChange, kind]);

  const updateRow = (index: number, patch: Partial<TeethLineDetail>) => {
    const next = expanded.map((d, i) =>
      i === index ? { ...d, ...patch } : d,
    );
    if (allSame) {
      onChange(
        Array.from({ length: safeQty }, (_, i) => ({
          position: i + 1,
          color: next[0]!.color,
          mould: next[0]!.mould ?? null,
          jaw: next[0]!.jaw ?? null,
          kind: next[0]!.kind ?? kind,
        })),
      );
    } else {
      onChange(next);
    }
  };

  const copyToAll = () => {
    if (allSame || expanded.length === 0) return;
    const first = expanded[0]!;
    onChange(
      Array.from({ length: safeQty }, (_, i) => ({
        position: i + 1,
        color: first.color,
        mould: first.mould ?? null,
        jaw: first.jaw ?? null,
        kind: first.kind ?? kind,
      })),
    );
  };

  const label = teethProductLineLabel(productLine);

  if (safeQty === 1 && allSame) {
    return (
      <div className="rounded-md border border-slate-200/80 bg-slate-50/30 p-3 shadow-sm" role="status" aria-live="polite">
        <div className="mb-2 flex items-center gap-2">
          <span className={cn(panelTypography.rowTitle, "text-sm")}>Ząb — {label}</span>
          <Badge variant="purple" className="text-[10px]">{label}</Badge>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <TeethSelect
            label="Kolor"
            value={expanded[0]?.color ?? ""}
            options={colors}
            disabled={disabled}
            onChange={(v) => updateRow(0, { color: v })}
          />
          {showMoulds ? (
            <TeethSelect
              label="Fason"
              value={expanded[0]?.mould ?? ""}
              options={moulds}
              disabled={disabled}
              onChange={(v) => updateRow(0, { mould: v })}
            />
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-slate-200/80 bg-slate-50/30 p-3 shadow-sm" role="status" aria-live="polite">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={cn(panelTypography.rowTitle, "text-sm")}>
            Zęby — {label}
          </span>
          <Badge variant="purple" className="text-[10px]">{label}</Badge>
        </div>
        <div className="flex items-center gap-3">
          {!allSame ? (
            <button
              type="button"
              className="text-xs font-medium text-indigo-700 hover:text-indigo-900"
              onClick={copyToAll}
              disabled={disabled}
            >
              Kopiuj 1. wiersz na wszystkie
            </button>
          ) : null}
          <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
            <input
              type="checkbox"
              checked={allSame}
              onChange={(e) => {
                setAllSame(e.target.checked);
                if (e.target.checked && expanded.length > 0) {
                  const first = expanded[0]!;
                  onChange(
                    Array.from({ length: safeQty }, (_, i) => ({
                      position: i + 1,
                      color: first.color,
                      mould: first.mould ?? null,
                      jaw: first.jaw ?? null,
                      kind: first.kind ?? kind,
                    })),
                  );
                }
              }}
              disabled={disabled}
              className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            Wszystkie takie same
          </label>
        </div>
      </div>

      {allSame ? (
        <div className="grid gap-2 sm:grid-cols-3">
          <TeethSelect
            label="Kolor (wszystkie)"
            value={expanded[0]?.color ?? ""}
            options={colors}
            disabled={disabled}
            onChange={(v) => updateRow(0, { color: v })}
          />
          {showMoulds ? (
            <TeethSelect
              label="Fason (wszystkie)"
              value={expanded[0]?.mould ?? ""}
              options={moulds}
              disabled={disabled}
              onChange={(v) => updateRow(0, { mould: v })}
            />
          ) : null}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs font-medium text-slate-500">
                <th className="w-8 py-1.5 pr-2">#</th>
                <th className="py-1.5 pr-2">Kolor</th>
                {showMoulds ? <th className="py-1.5 pr-2">Fason</th> : null}
              </tr>
            </thead>
            <tbody>
              {expanded.map((row, i) => (
                <tr key={i} className="border-b border-slate-100 last:border-0">
                  <td className="py-1.5 pr-2 text-xs tabular-nums text-slate-500">
                    {i + 1}
                  </td>
                  <td className="py-1.5 pr-2">
                    <TeethSelect
                      label={`Kolor zęba ${i + 1}`}
                      value={row.color}
                      options={colors}
                      disabled={disabled}
                      onChange={(v) => updateRow(i, { color: v })}
                      compact
                    />
                  </td>
                  {showMoulds ? (
                    <td className="py-1.5 pr-2">
                      <TeethSelect
                        label={`Fason zęba ${i + 1}`}
                        value={row.mould ?? ""}
                        options={moulds}
                        disabled={disabled}
                        onChange={(v) => updateRow(i, { mould: v })}
                        compact
                      />
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TeethSelect({
  label,
  value,
  options,
  onChange,
  disabled,
  compact,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        fieldControlClass(),
        compact && "min-h-[2rem] py-1 text-sm",
        !value && "text-slate-400",
      )}
    >
      <option value="">— wybierz —</option>
      {options.map((opt) => (
        <option key={opt} value={opt}>{opt}</option>
      ))}
    </select>
  );
}
