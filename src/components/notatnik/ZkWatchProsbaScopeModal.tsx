"use client";

import { useMemo, useState } from "react";
import { actionUpdateZkWatchProsbaScope } from "@/app/actions/sales-notepad";
import { Button } from "@/components/ui/Button";
import { ModalShell } from "@/components/ui/ModalShell";
import { cn } from "@/lib/cn";
import { formatZkWatchDisplayNumber } from "@/lib/sales/notepad-format";
import { buildZkWatchLineViews } from "@/lib/sales/zk-watch-lines";
import { getZkWatchProsbaScopeLineKeys } from "@/lib/sales/zk-watch-prosba-scope";
import { salesTypography } from "@/lib/ui/ontime-theme";
import type { SalesZkWatch } from "@/types/database";

function useInitialSelection(watch: SalesZkWatch, open: boolean) {
  const lineViews = useMemo(() => buildZkWatchLineViews(watch), [watch]);
  const productLines = useMemo(
    () => lineViews.filter((line) => line.key !== "summary"),
    [lineViews]
  );
  const existingScope = useMemo(
    () => getZkWatchProsbaScopeLineKeys(watch, lineViews),
    [watch, lineViews]
  );

  const [selection, setSelection] = useState<Set<string>>(() => new Set());
  const [appliedWatchId, setAppliedWatchId] = useState<string | null>(null);

  if (open && watch.id !== appliedWatchId) {
    setAppliedWatchId(watch.id);
    if (existingScope) {
      setSelection(new Set(existingScope));
    } else {
      setSelection(new Set());
    }
  }

  return { productLines, selection, setSelection };
}

export function ZkWatchProsbaScopeModal({
  watch,
  open,
  required = false,
  onClose,
  onSaved,
}: {
  watch: SalesZkWatch;
  open: boolean;
  /** Gdy true — nie można zamknąć bez zapisu (pierwsze dodanie ZK). */
  required?: boolean;
  onClose: () => void;
  onSaved: (watch: SalesZkWatch) => void;
}) {
  const { productLines, selection, setSelection } = useInitialSelection(watch, open);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const displayNumber = formatZkWatchDisplayNumber(watch.zk_number);

  function toggleLine(key: string) {
    setSelection((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function save() {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const { watch: updated } = await actionUpdateZkWatchProsbaScope(watch.id, [...selection]);
      onSaved(updated);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się zapisać zakresu.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell
      open={open}
      onClose={required ? () => {} : onClose}
      size="md"
      title={`${displayNumber} — co zamawiamy?`}
      description={watch.client_label}
      bodyClassName="space-y-4"
      footer={
        <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {!required ? (
            <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={saving}>
              Anuluj
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            disabled={saving}
            onClick={() => void save()}
          >
            {saving
              ? "Zapisuję…"
              : selection.size === 0
                ? "Zapisz — wszystko na stanie"
                : `Zapisz (${selection.size})`}
          </Button>
        </div>
      }
    >
      <div className="rounded-lg border border-indigo-200/80 bg-indigo-50/50 px-3 py-3 text-sm text-indigo-950">
        <p className="font-medium">Zaznacz tylko pozycje, których nie macie na stanie.</p>
        <p className="mt-1 text-xs leading-relaxed text-indigo-900/85">
          Pozycje bez zaznaczenia nie trafią do prośby — unikniesz zamawiania towaru, który już
          jest dostępny.
        </p>
      </div>

      <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200/90 bg-white">
        {productLines.map((line) => {
          const checked = selection.has(line.key);
          return (
            <li key={line.key}>
              <label
                className={cn(
                  "flex cursor-pointer items-start gap-3 px-3 py-2.5 transition",
                  checked ? "bg-indigo-50/40" : "hover:bg-slate-50/80"
                )}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={saving}
                  onChange={() => toggleLine(line.key)}
                  className="mt-0.5 size-4 shrink-0 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="min-w-0 flex-1">
                  <span className={cn(salesTypography.rowTitle, "block text-slate-900")}>
                    {line.product}
                  </span>
                  {(line.symbol || line.quantityLabel) && (
                    <span className={cn(salesTypography.rowMeta, "mt-0.5 block text-slate-600")}>
                      {[line.symbol, line.quantityLabel].filter(Boolean).join(" · ")}
                    </span>
                  )}
                </span>
                <span
                  className={cn(
                    salesTypography.kindTag,
                    "shrink-0 rounded-full px-1.5 py-0.5",
                    checked
                      ? "bg-indigo-100 text-indigo-900 ring-1 ring-indigo-200/70"
                      : "bg-slate-100 text-slate-500 ring-1 ring-slate-200/80"
                  )}
                >
                  {checked ? "Do zamówienia" : "Na stanie"}
                </span>
              </label>
            </li>
          );
        })}
      </ul>

      {selection.size === 0 ? (
        <p className={cn(salesTypography.rowMeta, "text-amber-800")}>
          Zaznacz co najmniej jedną pozycję do zamówienia albo zamknij sprawę, jeśli wszystko jest na
          stanie.
        </p>
      ) : null}

      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </ModalShell>
  );
}
