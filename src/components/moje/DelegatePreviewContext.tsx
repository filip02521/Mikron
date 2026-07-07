"use client";

import { createContext, useContext } from "react";

const DelegatePreviewContext = createContext<string | null>(null);

export function DelegatePreviewProvider({
  delegateFor,
  children,
}: {
  delegateFor: string | null;
  children: React.ReactNode;
}) {
  return (
    <DelegatePreviewContext.Provider value={delegateFor}>
      {children}
    </DelegatePreviewContext.Provider>
  );
}

export function useDelegateFor(): string | null {
  return useContext(DelegatePreviewContext);
}
