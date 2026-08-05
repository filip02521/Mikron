"use client";

import { useCallback, useState } from "react";
import type { ProcurementFlagDefinition } from "@/lib/orders/procurement-request-flag";
import { normalizeProcurementLaneOrder } from "@/lib/orders/procurement-request-lane-order";
import type { ProcurementRequestLaneId } from "@/lib/orders/procurement-request-lanes";

type LanePrefsState = {
  defs: ProcurementFlagDefinition[];
  order: ProcurementRequestLaneId[];
  sourceDefs: ProcurementFlagDefinition[];
  sourceOrder: unknown;
};

/**
 * Wspólny optymistyczny stan kolejności torów / definicji flag
 * dla Prośby + Brak na stanie (ten sam klucz app_settings).
 */
export function useProcurementLanePrefs(
  procurementFlagDefinitions: ProcurementFlagDefinition[],
  procurementLaneOrder: unknown
) {
  const [state, setState] = useState<LanePrefsState>(() => ({
    defs: procurementFlagDefinitions,
    order: normalizeProcurementLaneOrder(
      procurementLaneOrder,
      procurementFlagDefinitions
    ),
    sourceDefs: procurementFlagDefinitions,
    sourceOrder: procurementLaneOrder,
  }));

  if (
    state.sourceDefs !== procurementFlagDefinitions ||
    state.sourceOrder !== procurementLaneOrder
  ) {
    setState({
      defs: procurementFlagDefinitions,
      order: normalizeProcurementLaneOrder(
        procurementLaneOrder,
        procurementFlagDefinitions
      ),
      sourceDefs: procurementFlagDefinitions,
      sourceOrder: procurementLaneOrder,
    });
  }

  const setLocalFlagDefinitions = useCallback(
    (
      update:
        | ProcurementFlagDefinition[]
        | ((prev: ProcurementFlagDefinition[]) => ProcurementFlagDefinition[])
    ) => {
      setState((prev) => ({
        ...prev,
        defs: typeof update === "function" ? update(prev.defs) : update,
      }));
    },
    []
  );

  const setLocalLaneOrder = useCallback(
    (
      update:
        | ProcurementRequestLaneId[]
        | ((prev: ProcurementRequestLaneId[]) => ProcurementRequestLaneId[])
    ) => {
      setState((prev) => ({
        ...prev,
        order: typeof update === "function" ? update(prev.order) : update,
      }));
    },
    []
  );

  return {
    localFlagDefinitions: state.defs,
    setLocalFlagDefinitions,
    localLaneOrder: state.order,
    setLocalLaneOrder,
  };
}
