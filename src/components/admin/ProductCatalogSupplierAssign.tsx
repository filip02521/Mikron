"use client";

import { useEffect, useState } from "react";
import type { ProductCatalogRow } from "@/lib/data/product-catalog-queries";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Field";
import { cn } from "@/lib/cn";

export function ProductCatalogSupplierAssign({
  row,
  suppliers,
  disabled,
  onAssign,
}: {
  row: ProductCatalogRow;
  suppliers: Array<{ id: string; name: string; subiektKhId: number | null }>;
  disabled?: boolean;
  onAssign: (subiektTwId: number, supplierId: string) => void;
}) {
  const [supplierId, setSupplierId] = useState(row.topSupplier?.id ?? "");

  useEffect(() => {
    setSupplierId(row.topSupplier?.id ?? "");
  }, [row.subiektTwId, row.topSupplier?.id]);

  const unchanged = Boolean(row.topSupplier?.id && row.topSupplier.id === supplierId);
  const canSave = Boolean(supplierId) && !unchanged;

  return (
    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50/80 p-3">
      <p className="text-xs font-semibold text-slate-700">
        {row.topSupplier ? "Dostawca w katalogu" : "Przypisz dostawcę ręcznie"}
      </p>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <label className="sr-only" htmlFor={`supplier-${row.subiektTwId}`}>
            Dostawca
          </label>
          <Select
            id={`supplier-${row.subiektTwId}`}
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            disabled={disabled}
            className="w-full"
          >
            <option value="">— wybierz dostawcę —</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.subiektKhId != null ? ` · kh ${s.subiektKhId}` : ""}
              </option>
            ))}
          </Select>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={disabled || !canSave}
          onClick={() => onAssign(row.subiektTwId, supplierId)}
          className={cn("shrink-0", !row.topSupplier && "border-amber-300 bg-amber-50")}
        >
          {row.topSupplier ? "Zmień mapowanie" : "Przypisz"}
        </Button>
      </div>
      {row.topSupplier && unchanged ? (
        <p className="mt-1.5 text-[11px] text-slate-500">
          Wybierz innego dostawcę z listy, aby dodać lub zmienić powiązanie (stare linki pozostają w
          historii).
        </p>
      ) : (
        <p className="mt-1.5 text-[11px] text-slate-500">
          Zapis w bazie katalogu; prośby w weryfikacji z tym towarem dostaną dostawcę automatycznie,
          jeśli brakowało tylko mapowania.
        </p>
      )}
    </div>
  );
}
