"use client";

import { useEffect, useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

export type ConfirmRequest = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  /** Enter zatwierdza (jak systemowe okno) — dla skrótów klawiszowych. */
  defaultConfirm?: boolean;
};

type Pending = ConfirmRequest & { resolve: (ok: boolean) => void };

let show: ((req: Pending) => void) | null = null;

/**
 * Potwierdzenie w oknie aplikacji zamiast `window.confirm` (systemowe „localhost mówi…”).
 * Bez zamontowanego `ConfirmHost` (np. ekran poza AppShell) — awaryjnie `window.confirm`.
 */
export function askConfirm(req: ConfirmRequest): Promise<boolean> {
  if (!show) return Promise.resolve(window.confirm(`${req.title}\n\n${req.message}`));
  const open = show;
  return new Promise((resolve) => open({ ...req, resolve }));
}

/** Montowany raz w powłoce aplikacji. */
export function ConfirmHost() {
  const [pending, setPending] = useState<Pending | null>(null);

  useEffect(() => {
    show = (req) =>
      setPending((prev) => {
        prev?.resolve(false);
        return req;
      });
    return () => {
      show = null;
    };
  }, []);

  const settle = (ok: boolean) => {
    pending?.resolve(ok);
    setPending(null);
  };

  return (
    <ConfirmDialog
      open={pending != null}
      title={pending?.title ?? ""}
      message={pending?.message ?? ""}
      confirmLabel={pending?.confirmLabel}
      cancelLabel={pending?.cancelLabel}
      danger={pending?.danger}
      autoFocusConfirm={pending?.defaultConfirm}
      tier="overlay"
      onConfirm={() => settle(true)}
      onCancel={() => settle(false)}
    />
  );
}
