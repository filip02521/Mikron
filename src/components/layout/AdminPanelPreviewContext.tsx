"use client";

import { createContext, useContext } from "react";
import type { AdminPanelContext } from "@/lib/auth/admin-panel-context";

type AdminPanelPreviewValue = {
  readOnly: boolean;
  panelContext: AdminPanelContext | null;
};

const Ctx = createContext<AdminPanelPreviewValue>({
  readOnly: false,
  panelContext: null,
});

export function AdminPanelPreviewProvider({
  readOnly,
  panelContext,
  children,
}: {
  readOnly: boolean;
  panelContext: AdminPanelContext | null;
  children: React.ReactNode;
}) {
  return (
    <Ctx.Provider value={{ readOnly, panelContext }}>{children}</Ctx.Provider>
  );
}

export function useAdminPanelPreview(): AdminPanelPreviewValue {
  return useContext(Ctx);
}

/** Wyłącza przyciski / formularze w trybie podglądu administratora. */
export function mutationsDisabledInPreview(
  readOnly: boolean,
  ...extra: boolean[]
): boolean {
  return readOnly || extra.some(Boolean);
}
