"use client";

import { createContext, useContext } from "react";
import type { SalesTeamUiContext } from "@/lib/sales/team-ui";

const Ctx = createContext<SalesTeamUiContext | null>(null);

export function SalesTeamUiProvider({
  value,
  children,
}: {
  value: SalesTeamUiContext;
  children: React.ReactNode;
}) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSalesTeamUi(): SalesTeamUiContext {
  const v = useContext(Ctx);
  if (!v) {
    throw new Error("useSalesTeamUi wymaga SalesTeamUiProvider (layout /zespol)");
  }
  return v;
}
