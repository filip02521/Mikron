"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { IconCircleCheck, IconAlertCircle } from "@/components/icons/StrokeIcons";
import { actionUpdateTeethSpecGroup } from "@/app/actions/teeth-orders";
import {
  colorOptions,
  mouldOptions,
  jawOptions,
  validateInlineSpec,
  validateCount,
  type SpecGroup,
} from "@/lib/teeth/teeth-verification-inline";
import type { TeethProductLine, TeethKind } from "@/lib/teeth/teeth-catalog-types";

type EditField = "color" | "mould" | "jaw" | "count" | null;

const JAW_LABELS: Record<string, string> = { upper: "Góra", lower: "Dół" };

const cellClass = "cursor-pointer rounded px-1.5 py-0.5 text-xs font-medium transition-colors hover:bg-slate-100/80";
const editControlClass = "rounded border border-slate-300 bg-white px-1.5 py-0.5 text-xs font-medium outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400 w-full";

export function TeethVerificationInlineRow({
  orderId,
  spec,
  productLine,
  showJaw,
  rowKey,
  isActive,
  isVisited,
  onSaved,
}: {
  orderId: string;
  spec: SpecGroup;
  productLine: TeethProductLine | null;
  showJaw: boolean;
  rowKey?: string;
  isActive?: boolean;
  isVisited?: boolean;
  onSaved?: () => void;
}) {
  const [editField, setEditField] = useState<EditField>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLSelectElement | HTMLInputElement | null>(null);
  const savedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (editField && inputRef.current) {
      inputRef.current.focus();
      if (inputRef.current instanceof HTMLInputElement) {
        inputRef.current.select();
      }
    }
  }, [editField]);

  useEffect(() => {
    return () => {
      if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
    };
  }, []);

  const canEdit = productLine != null;

  const startEdit = useCallback((field: EditField) => {
    if (!field) return;
    setError(null);
    if (field === "count") {
      setEditValue(String(spec.count));
    } else if (field === "color") {
      setEditValue(spec.color);
    } else if (field === "mould") {
      setEditValue(spec.mould ?? "");
    } else if (field === "jaw") {
      setEditValue(spec.jaw ?? "");
    } else if (field === "kind") {
      setEditValue(spec.kind ?? "");
    }
    setEditField(field);
  }, [spec]);

  const commitEdit = useCallback(async () => {
    if (!editField || !productLine) {
      setEditField(null);
      return;
    }

    const oldSpec = {
      color: spec.color,
      mould: spec.mould,
      jaw: spec.jaw,
      kind: spec.kind ?? "posterior",
    };

    const newSpec: Record<string, unknown> = {};
    let newCount: number | undefined;

    if (editField === "color") {
      if (editValue === spec.color) {
        setEditField(null);
        return;
      }
      newSpec.color = editValue;
    } else if (editField === "mould") {
      const val = editValue === "" ? null : editValue;
      if (val === spec.mould) {
        setEditField(null);
        return;
      }
      newSpec.mould = val;
    } else if (editField === "jaw") {
      const val = editValue === "" ? null : editValue;
      if (val === spec.jaw) {
        setEditField(null);
        return;
      }
      newSpec.jaw = val;
    } else if (editField === "count") {
      const numVal = parseInt(editValue, 10);
      if (Number.isNaN(numVal) || numVal === spec.count) {
        setEditField(null);
        return;
      }
      const countCheck = validateCount(numVal);
      if (!countCheck.ok) {
        setError(countCheck.error ?? "Nieprawidłowa ilość");
        setEditField(null);
        return;
      }
      newCount = numVal;
    }

    const patch: { color?: string; mould?: string | null; jaw?: string | null } = {};
    if (newSpec.color !== undefined) patch.color = newSpec.color as string;
    if (newSpec.mould !== undefined) patch.mould = newSpec.mould as string | null;
    if (newSpec.jaw !== undefined) patch.jaw = newSpec.jaw as string | null;

    if (Object.keys(patch).length > 0) {
      const validation = validateInlineSpec(patch, productLine);
      if (!validation.ok) {
        setError(validation.error ?? "Nieprawidłowa wartość");
        setEditField(null);
        return;
      }
    }

    if (Object.keys(patch).length === 0 && newCount === undefined) {
      setEditField(null);
      return;
    }

    setEditField(null);
    setSaving(true);
    setError(null);

    try {
      const result = await actionUpdateTeethSpecGroup(orderId, oldSpec, patch, newCount);
      if (!result.success) {
        setError(result.error ?? "Nie udało się zapisać");
      } else {
        setSavedFlash(true);
        if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
        savedTimeoutRef.current = setTimeout(() => setSavedFlash(false), 1500);
        onSaved?.();
      }
    } catch {
      setError("Nie udało się zapisać zmiany");
    } finally {
      setSaving(false);
    }
  }, [editField, editValue, productLine, spec, orderId, onSaved]);

  const cancelEdit = useCallback(() => {
    setEditField(null);
    setError(null);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        void commitEdit();
      } else if (e.key === "Escape") {
        e.preventDefault();
        cancelEdit();
      } else if (e.key === "Tab" && editField) {
        e.preventDefault();
        const order: EditField[] = ["color", "mould", ...(showJaw ? ["jaw" as const] : []), "count"];
        const currentIdx = order.indexOf(editField);
        const nextField = order[currentIdx + 1];
        if (nextField) {
          void commitEdit().then(() => startEdit(nextField));
        } else {
          void commitEdit();
        }
      }
    },
    [commitEdit, cancelEdit, editField, showJaw, startEdit],
  );

  const renderCell = (
    field: EditField,
    displayValue: string,
    editElement: React.ReactNode,
  ) => {
    if (editField === field) {
      return editElement;
    }
    return (
      <button
        type="button"
        disabled={!canEdit || saving}
        onClick={() => startEdit(field)}
        className={cn(cellClass, !canEdit && "cursor-default opacity-60 hover:bg-transparent")}
      >
        {displayValue}
      </button>
    );
  };

  const kindForOptions = (spec.kind ?? "posterior") as TeethKind;

  return (
    <>
      <tr
        data-row-key={rowKey}
        className={cn(
          "border-b border-slate-100 last:border-b-0 transition-colors",
          saving && "bg-indigo-50/30",
          error && "bg-red-50/20",
          isActive && "ring-1 ring-inset ring-indigo-300 bg-indigo-50/20",
          isVisited && !isActive && !saving && !error && "bg-emerald-50/40 border-l-2 border-l-emerald-400",
        )}
      >
        <td className="py-0.5 px-1">
          {renderCell(
            "color",
            spec.color || "—",
            <select
              ref={(el) => { inputRef.current = el; }}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={() => void commitEdit()}
              onKeyDown={handleKeyDown}
              className={editControlClass}
            >
              {colorOptions(productLine!).map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>,
          )}
        </td>
        <td className="py-0.5 px-1">
          {renderCell(
            "mould",
            spec.mould ?? "—",
            <select
              ref={(el) => { inputRef.current = el; }}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={() => void commitEdit()}
              onKeyDown={handleKeyDown}
              className={editControlClass}
            >
              {mouldOptions(productLine!, kindForOptions).map((m) => (
                <option key={m ?? "__none"} value={m ?? ""}>
                  {m ?? "(brak)"}
                </option>
              ))}
            </select>,
          )}
        </td>
        {showJaw ? (
          <td className="py-0.5 px-1">
            {renderCell(
              "jaw",
              spec.jaw ? JAW_LABELS[spec.jaw] ?? spec.jaw : "—",
              <select
                ref={(el) => { inputRef.current = el; }}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={() => void commitEdit()}
                onKeyDown={handleKeyDown}
                className={editControlClass}
                disabled={!jawRequiredForKindChecked(spec.kind)}
              >
                {jawOptions(spec.kind).map((opt) => (
                  <option key={opt.value ?? "__none"} value={opt.value ?? ""}>
                    {opt.label}
                  </option>
                ))}
              </select>,
            )}
          </td>
        ) : null}
        <td className="py-0.5 px-1 text-right">
          <div className="flex items-center justify-end gap-1">
            {renderCell(
              "count",
              String(spec.count),
              <input
                ref={(el) => { inputRef.current = el; }}
                type="number"
                min={1}
                max={200}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={() => void commitEdit()}
                onKeyDown={handleKeyDown}
                className={cn(editControlClass, "w-14 text-center tabular-nums")}
              />,
            )}
            {savedFlash ? (
              <IconCircleCheck size={14} className="shrink-0 text-emerald-500 transition-opacity" />
            ) : saving ? (
              <span className="text-[10px] text-indigo-500">…</span>
            ) : null}
          </div>
        </td>
      </tr>
      {error ? (
        <tr className="border-b border-slate-100 last:border-b-0">
          <td colSpan={showJaw ? 4 : 3} className="py-1 px-2">
            <div className="flex items-center gap-1 text-[10px] font-medium text-red-600">
              <IconAlertCircle size={11} className="shrink-0" />
              {error}
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}

function jawRequiredForKindChecked(kind: TeethKind | null): boolean {
  return kind === "posterior";
}
