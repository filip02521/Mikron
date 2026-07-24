"use client";

import { useState } from "react";
import { actionGetTeethOrderFileUrlForSales } from "@/app/actions/teeth-orders";
import { Spinner } from "@/components/ui/Spinner";
import { IconFilePlus } from "@/components/icons/StrokeIcons";

export function TeethOrderFileDownload({
  orderId,
  fileName,
}: {
  orderId: string;
  fileName?: string | null;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!fileName) return null;

  const handleDownload = async () => {
    setPending(true);
    setError(null);
    try {
      const result = await actionGetTeethOrderFileUrlForSales(orderId);
      if (result.url) {
        const a = document.createElement("a");
        a.href = result.url;
        a.download = result.fileName ?? fileName;
        a.target = "_blank";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else {
        setError("Nie udało się pobrać pliku.");
      }
    } catch {
      setError("Nie udało się pobrać pliku.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={handleDownload}
        className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 transition-colors hover:bg-emerald-100 disabled:opacity-50"
        title={`Pobierz plik zamówienia: ${fileName}`}
      >
        {pending ? <Spinner size="sm" /> : <IconFilePlus size={12} strokeWidth={2} />}
        Pobierz zamówienie
      </button>
      {error ? (
        <span className="text-[10px] text-red-600">{error}</span>
      ) : null}
    </div>
  );
}
