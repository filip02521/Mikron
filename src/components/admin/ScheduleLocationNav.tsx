"use client";

import Link from "next/link";
import { cn } from "@/lib/cn";
import { supplierHubPaths, type SupplierHubContext } from "@/lib/supplier-hub";
import { SUPPLIER_LOCATION_OPTIONS } from "@/lib/supplier-locations";
import type { SupplierLocation } from "@/types/database";

export function ScheduleLocationNav({
  value,
  context,
}: {
  value: SupplierLocation;
  context: SupplierHubContext;
}) {
  const paths = supplierHubPaths(context);

  return (
    <div
      className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4"
      aria-label="Lokalizacja terminów"
    >
      <span className="shrink-0 text-sm font-medium text-slate-700">
        Lokalizacja
        <span className="ml-1.5 font-normal text-slate-400">(filtr listy)</span>
      </span>
      <div className="flex flex-wrap gap-2">
        {SUPPLIER_LOCATION_OPTIONS.map((opt) => {
          const active = value === opt.value;
          return (
            <Link
              key={opt.value}
              href={paths.schedule(opt.value)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-sm transition",
                active
                  ? "border-sky-600 bg-sky-50 font-semibold text-sky-900 shadow-sm"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
              )}
            >
              {opt.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
