"use client";

import { useState } from "react";
import { actionExportTeethSupplierCsv } from "@/app/actions/teeth-orders";
import { Spinner } from "@/components/ui/Spinner";
import { IconTruck } from "@/components/icons/StrokeIcons";

export function TeethCsvExportButton({
  supplierId,
  format = "batch",
  label = "CSV",
}: {
  supplierId: string;
  format?: "batch" | "detailed";
  label?: string;
}) {
  const [pending, setPending] = useState(false);

  const handleExport = async () => {
    setPending(true);
    try {
      const result = await actionExportTeethSupplierCsv(supplierId, format);
      if (!result.success || !result.csv) return;

      const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename ?? "export.csv";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    } finally {
      setPending(false);
    }
  };

  return (
    <button
      type="button"
      disabled={pending}
      onClick={handleExport}
      className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50"
      aria-label="Eksportuj CSV"
    >
      {pending ? <Spinner size="sm" /> : <IconTruck size={14} strokeWidth={2} />}
      {label}
    </button>
  );
}
