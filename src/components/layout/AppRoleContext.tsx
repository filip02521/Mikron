"use client";

import { createContext, useContext } from "react";
import type { UserRole } from "@/types/database";
import {
  supplierHubContextForRole,
  type SupplierHubContext,
} from "@/lib/supplier-hub";

const AppRoleContext = createContext<UserRole | null>(null);

export function AppRoleProvider({
  role,
  children,
}: {
  role: UserRole | null;
  children: React.ReactNode;
}) {
  return <AppRoleContext.Provider value={role}>{children}</AppRoleContext.Provider>;
}

export function useAppRole(): UserRole | null {
  return useContext(AppRoleContext);
}

export function useSupplierHubContext(): SupplierHubContext {
  return supplierHubContextForRole(useAppRole());
}
