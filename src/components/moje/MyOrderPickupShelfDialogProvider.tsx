"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { MyOrderPickupShelfNoticeDialog } from "@/components/moje/MyOrderPickupShelfNoticeDialog";
import { shouldShowPickupShelfNotice } from "@/lib/orders/my-order-pickup-shelf-notice";

type ShelfNoticeRequest = {
  orderIds: string[];
  proceed: () => void;
};

type MyOrderPickupShelfDialogContextValue = {
  shelfNoticeOpen: boolean;
  requestShelfPickupNotice: (orderIds: string[], proceed: () => void) => void;
};

const MyOrderPickupShelfDialogContext =
  createContext<MyOrderPickupShelfDialogContextValue | null>(null);

export function MyOrderPickupShelfDialogProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<ShelfNoticeRequest | null>(null);

  const requestShelfPickupNotice = useCallback(
    (orderIds: string[], proceed: () => void) => {
      if (!orderIds.length) return;
      if (active) return;
      if (!shouldShowPickupShelfNotice()) {
        proceed();
        return;
      }
      setActive({ orderIds, proceed });
    },
    [active]
  );

  const close = useCallback(() => {
    setActive(null);
  }, []);

  const value = useMemo(
    (): MyOrderPickupShelfDialogContextValue => ({
      shelfNoticeOpen: active !== null,
      requestShelfPickupNotice,
    }),
    [active, requestShelfPickupNotice]
  );

  return (
    <MyOrderPickupShelfDialogContext.Provider value={value}>
      {children}
      {active ? (
        <MyOrderPickupShelfNoticeDialog
          open
          onCancel={close}
          onConfirm={() => {
            const { proceed } = active;
            setActive(null);
            proceed();
          }}
        />
      ) : null}
    </MyOrderPickupShelfDialogContext.Provider>
  );
}

export function useMyOrderPickupShelfDialog(): MyOrderPickupShelfDialogContextValue {
  const ctx = useContext(MyOrderPickupShelfDialogContext);
  if (!ctx) {
    return {
      shelfNoticeOpen: false,
      requestShelfPickupNotice: (_orderIds, proceed) => proceed(),
    };
  }
  return ctx;
}
