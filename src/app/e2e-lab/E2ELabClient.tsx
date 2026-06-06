"use client";

import { useState } from "react";
import { InformacjaFlowPicker } from "@/components/orders/InformacjaFlowPicker";
import type { InformacjaFlowPath } from "@/lib/orders/informacja-stock-out-reorder";

/** Izolowany harness UI dla testów Playwright — bez auth. */
export function E2ELabClient() {
  const [path, setPath] = useState<InformacjaFlowPath>("direct");

  return (
    <main
      data-testid="e2e-lab"
      className="mx-auto max-w-md space-y-4 p-6"
    >
      <h1 className="text-lg font-semibold text-slate-900">E2E lab</h1>
      <InformacjaFlowPicker path={path} onChange={setPath} includeViaPanel />
      <p data-testid="selected-path" className="text-sm text-slate-600">
        {path}
      </p>
    </main>
  );
}
