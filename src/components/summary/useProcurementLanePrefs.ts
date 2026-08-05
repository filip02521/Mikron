"use client";

import { useEffect, useState } from "react";
import type { ProcurementFlagDefinition } from "@/lib/orders/procurement-request-flag";
import { normalizeProcurementLaneOrder } from "@/lib/orders/procurement-request-lane-order";
import type { ProcurementRequestLaneId } from "@/lib/orders/procurement-request-lanes";

/**
 * Wspólny optymistyczny stan kolejności torów / definicji flag
 * dla Prośby + Brak na stanie (ten sam klucz app_settings).
 */
export function useProcurementLanePrefs(
  procurementFlagDefinitions: ProcurementFlagDefinition[],
  procurementLaneOrder: unknown
) {
  const [localFlagDefinitions, setLocalFlagDefinitions] = useState(
    procurementFlagDefinitions
  );
  const [localLaneOrder, setLocalLaneOrder] = useState<ProcurementRequestLaneId[]>(
    () =>
      normalizeProcurementLaneOrder(
        procurementLaneOrder,
        procurementFlagDefinitions
      )
  );

  useEffect(() => {
    setLocalFlagDefinitions(procurementFlagDefinitions);
    setLocalLaneOrder(
      normalizeProcurementLaneOrder(
        procurementLaneOrder,
        procurementFlagDefinitions
      )
    );
  }, [procurementFlagDefinitions, procurementLaneOrder]);

  return {
    localFlagDefinitions,
    setLocalFlagDefinitions,
    localLaneOrder,
    setLocalLaneOrder,
  };
}
