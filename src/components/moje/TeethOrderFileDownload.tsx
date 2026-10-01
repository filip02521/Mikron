"use client";

import { useState } from "react";
import { actionGetTeethOrderFileUrlForSales } from "@/app/actions/teeth-orders";
import { Spinner } from "@/components/ui/Spinner";
import { IconDownload } from "@/components/icons/StrokeIcons";
import { cn } from "@/lib/cn";

export function TeethOrderFileDownload({
  orderId,
  fileName,
  className,
}: {
  orderId: string;
  fileName?: string | null;
  className?: string;
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
        a.rel = "noopener noreferrer";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else {
        setError(result.error ?? "Nie udało się pobrać pliku.");
      }
    } catch {
      setError("Nie udało się pobrać pliku.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className={cn("flex min-w-0 flex-col gap-0.5", className)}>
      <button
        type="button"
        disabled={pending}
        onClick={handleDownload}
        className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-emerald-200/90 bg-gradient-to-b from-emerald-50 to-white px-2.5 py-1 text-[11px] font-semibold text-emerald-800 shadow-sm shadow-emerald-900/[0.03] transition-colors hover:border-emerald-300 hover:bg-emerald-50 disabled:opacity-50"
        title={`Pobierz plik zamówienia: ${fileName}`}
      >
        {pending ? (
          <Spinner size="sm" />
        ) : (
          <IconDownload size={13} strokeWidth={2.25} className="shrink-0" />
        )}
        <span className="min-w-0 truncate">Pobierz zamówienie</span>
      </button>
      {error ? (
        <span className="text-[10px] leading-snug text-red-600">{error}</span>
      ) : null}
    </div>
  );
}
