"use client";

import { useState, useCallback } from "react";
import { cn } from "@/lib/cn";
import { panelTypography } from "@/lib/ui/ontime-theme";

const STORAGE_KEY = "teeth-manual-eta";

type ManualEtaMap = Record<string, number>;

function loadManualEtas(): ManualEtaMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveManualEtas(map: ManualEtaMap) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

export function TeethManualEtaEditor({
  supplierId,
  supplierName,
  avgBusinessDays,
  lowConfidence,
}: {
  supplierId: string;
  supplierName: string;
  avgBusinessDays?: number;
  lowConfidence?: boolean;
}) {
  const [manualEtas, setManualEtas] = useState<ManualEtaMap>(() => loadManualEtas());
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");

  const manualDays = manualEtas[supplierId];
  const displayDays = manualDays ?? avgBusinessDays;
  const isManual = manualDays != null;

  const save = useCallback(() => {
    const days = parseInt(value, 10);
    if (isNaN(days) || days < 0) return;
    const next = { ...manualEtas, [supplierId]: days };
    setManualEtas(next);
    saveManualEtas(next);
    setEditing(false);
    setValue("");
  }, [manualEtas, supplierId, value]);

  const clear = useCallback(() => {
    const next = { ...manualEtas };
    delete next[supplierId];
    setManualEtas(next);
    saveManualEtas(next);
    setEditing(false);
    setValue("");
  }, [manualEtas, supplierId]);

  return (
    <span className={cn(panelTypography.caption, "inline-flex items-center gap-1")}>
      {editing ? (
        <>
          <input
            type="number"
            min={0}
            max={60}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-12 rounded-md border border-slate-200/80 bg-white px-1.5 py-0.5 text-xs shadow-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400"
            aria-label={`Ręczny ETA dla ${supplierName}`}
            autoFocus
          />
          <button
            type="button"
            onClick={save}
            className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
          >
            Zapisz
          </button>
          <button
            type="button"
            onClick={() => { setEditing(false); setValue(""); }}
            className="text-xs text-slate-500 hover:text-slate-700"
          >
            Anuluj
          </button>
        </>
      ) : (
        <>
          {isManual ? (
            <span className="font-semibold text-indigo-600">
              (ręczny: {displayDays} dni rob.)
            </span>
          ) : null}
          {lowConfidence && !isManual ? (
            <span className="text-amber-600" title="Mniej niż 3 próbki w historii">
              (mała próbka)
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => { setEditing(true); setValue(manualDays != null ? String(manualDays) : ""); }}
            className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
            title="Ustaw ręczny ETA"
          >
            {isManual ? "edytuj" : "ustaw ETA"}
          </button>
          {isManual ? (
            <button
              type="button"
              onClick={clear}
              className="text-xs text-slate-400 hover:text-slate-600"
            >
              wyczyść
            </button>
          ) : null}
        </>
      )}
    </span>
  );
}
