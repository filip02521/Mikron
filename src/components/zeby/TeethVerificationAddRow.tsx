"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import { IconPlusCircle, IconAlertCircle } from "@/components/icons/StrokeIcons";
import { actionAddTeethSpecGroup } from "@/app/actions/teeth-orders";
import {
  colorOptions,
  mouldOptions,
  jawOptions,
  kindOptions,
} from "@/lib/teeth/teeth-verification-inline";
import type { TeethProductLine, TeethKind } from "@/lib/teeth/teeth-catalog-types";

const selectClass = "rounded border border-slate-300 bg-white px-1.5 py-1 text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-400";

export function TeethVerificationAddRow({
  orderId,
  productLine,
  onSaved,
}: {
  orderId: string;
  productLine: TeethProductLine | null;
  onSaved?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [color, setColor] = useState("");
  const [mould, setMould] = useState<string>("");
  const [jaw, setJaw] = useState<string>("");
  const [kind, setKind] = useState<string>("anterior");
  const [count, setCount] = useState("1");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const colorRef = useRef<HTMLSelectElement | null>(null);

  useEffect(() => {
    if (open && colorRef.current) {
      colorRef.current.focus();
    }
  }, [open]);

  if (!productLine) return null;

  const handleOpen = () => {
    const colors = colorOptions(productLine);
    const kinds = kindOptions();
    if (colors.length > 0) setColor(colors[0]);
    if (kinds.length > 0) setKind(kinds[0].value);
    setMould("");
    setJaw("");
    setCount("1");
    setError(null);
    setOpen(true);
  };

  const handleKindChange = (newKind: string) => {
    setKind(newKind);
    setMould("");
    setJaw("");
  };

  const handleAdd = async () => {
    if (!productLine) return;
    setError(null);
    setSaving(true);
    try {
      const result = await actionAddTeethSpecGroup(
        orderId,
        {
          color,
          mould: mould || null,
          jaw: jaw || null,
          kind,
        },
        parseInt(count, 10) || 1,
      );
      if (!result.success) {
        setError(result.error ?? "Nie udało się dodać pozycji");
      } else {
        setOpen(false);
        setColor("");
        setMould("");
        setJaw("");
        setKind("anterior");
        setCount("1");
        onSaved?.();
      }
    } catch (e) {
      console.error("[TeethVerificationAddRow] addTeethSpecGroup failed:", e);
      setError("Nie udało się dodać pozycji");
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => handleOpen()}
      >
        <IconPlusCircle size={14} />
        Dodaj pozycję
      </Button>
    );
  }

  const kindTyped = kind as TeethKind;

  return (
    <div ref={containerRef} className="border-t border-slate-100 px-2 py-2">
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-0.5">
          <span className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">Kolor</span>
          <select
            ref={colorRef}
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className={selectClass}
          >
            {colorOptions(productLine).map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">Fason</span>
          <select
            value={mould}
            onChange={(e) => setMould(e.target.value)}
            className={selectClass}
          >
            {mouldOptions(productLine, kindTyped).map((m) => (
              <option key={m ?? "__none"} value={m ?? ""}>
                {m ?? "(brak)"}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">Szczęka</span>
          <select
            value={jaw}
            onChange={(e) => setJaw(e.target.value)}
            className={selectClass}
            disabled={!jawOptions(kindTyped).some((o) => o.value !== null)}
          >
            {jawOptions(kindTyped).map((opt) => (
              <option key={opt.value ?? "__none"} value={opt.value ?? ""}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">Typ</span>
          <select
            value={kind}
            onChange={(e) => handleKindChange(e.target.value)}
            className={selectClass}
          >
            {kindOptions().map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">Szt.</span>
          <input
            type="number"
            min={1}
            max={200}
            value={count}
            onChange={(e) => setCount(e.target.value)}
            className={cn(selectClass, "w-14 text-center tabular-nums")}
          />
        </label>
        <div className="flex items-center gap-1.5 pb-0.5">
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => void handleAdd()}
            disabled={saving}
          >
            {saving ? "…" : "Dodaj"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => { setOpen(false); setError(null); }}
          >
            Anuluj
          </Button>
        </div>
      </div>
      {error ? (
        <div className="mt-1.5 flex items-center gap-1 text-[10px] font-medium text-red-600">
          <IconAlertCircle size={11} className="shrink-0" />
          {error}
        </div>
      ) : null}
    </div>
  );
}
