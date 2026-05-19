"use client";

import type { ForSomeoneLine } from "@/lib/orders/summary-workspace";
import { cn } from "@/lib/cn";

export function ProcurementRequestLine({
  line,
  className,
}: {
  line: ForSomeoneLine;
  className?: string;
}) {
  const hasMeta =
    (line.symbol && line.symbol !== "-") || (line.quantity && line.quantity !== "-");

  return (
    <li
      className={cn(
        "rounded-lg border border-slate-100 bg-slate-50/60 px-2.5 py-2 text-xs",
        className
      )}
    >
      <p className="font-medium text-slate-900">{line.products}</p>
      {hasMeta ? (
        <p className="mt-0.5 text-slate-500">
          {line.symbol && line.symbol !== "-" ? line.symbol : null}
          {line.symbol && line.symbol !== "-" && line.quantity && line.quantity !== "-"
            ? " · "
            : null}
          {line.quantity && line.quantity !== "-"
            ? `Ilość: ${line.quantity}`
            : null}
        </p>
      ) : null}
    </li>
  );
}
