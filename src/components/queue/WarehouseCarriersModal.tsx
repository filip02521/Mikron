"use client";
import { toastFromError, WAREHOUSE_TOAST, type ToastNotice } from "@/lib/ui/notice-copy";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState, useTransition } from "react";
import type { WarehouseCarrierRow } from "@/lib/data/warehouse-carriers";
import {
  actionDeleteWarehouseCarrier,
  actionSetWarehouseCarrierActive,
  actionUpsertWarehouseCarrier,
} from "@/app/actions/warehouse-carriers";
import { ModalShell } from "@/components/ui/ModalShell";
import { Button } from "@/components/ui/Button";
import { AddButton } from "@/components/ui/AddButton";
import { Field, Input } from "@/components/ui/Field";
import { NoticeToast } from "@/components/ui/NoticeToast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { panelTypography } from "@/lib/ui/ontime-theme";
import { cn } from "@/lib/cn";

type FormState = { slug?: string; label: string; sortOrder: string };

const emptyForm = (): FormState => ({ label: "", sortOrder: "" });

export function WarehouseCarriersModal({
  open,
  onClose,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  initial: WarehouseCarrierRow[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [toast, setToast] = useState<ToastNotice | null>(null);
  const dismiss = useCallback(() => setToast(null), []);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<WarehouseCarrierRow | null>(null);

  const sorted = useMemo(
    () => [...initial].sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label, "pl")),
    [initial]
  );

  const resetForm = () => {
    setForm(emptyForm());
    setFormOpen(false);
  };

  const startEdit = (carrier: WarehouseCarrierRow) => {
    setForm({
      slug: carrier.slug,
      label: carrier.label,
      sortOrder: String(carrier.sortOrder),
    });
    setFormOpen(true);
  };

  const save = () => {
    start(async () => {
      const sortOrder = Number.parseInt(form.sortOrder, 10);
      const result = await actionUpsertWarehouseCarrier({
        slug: form.slug,
        label: form.label,
        sortOrder: Number.isFinite(sortOrder) ? sortOrder : undefined,
      });
      if ("error" in result) {
        setToast(toastFromError(result.error));
        return;
      }
      resetForm();
      setToast({
        text: form.slug ? "Zapisano kuriera." : "Dodano kuriera.",
        tone: "success",
      });
      router.refresh();
    });
  };

  const toggleActive = (carrier: WarehouseCarrierRow) => {
    start(async () => {
      const result = await actionSetWarehouseCarrierActive(carrier.slug, !carrier.isActive);
      if ("error" in result) {
        setToast(toastFromError(result.error));
        return;
      }
      setToast({
        text: carrier.isActive ? "Kurier ukryty z listy wyboru." : "Kurier widoczny na liście.",
        tone: "success",
      });
      router.refresh();
    });
  };

  return (
    <>
      {toast ? <NoticeToast notice={toast} onDismiss={dismiss} /> : null}
      <ConfirmDialog
        open={!!deleteTarget}
        tier="stack"
        title="Usunąć kuriera?"
        message={
          deleteTarget
            ? `Czy na pewno usunąć „${deleteTarget.label}" z katalogu?`
            : ""
        }
        confirmLabel="Usuń"
        danger
        pending={pending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          start(async () => {
            const result = await actionDeleteWarehouseCarrier(deleteTarget.slug);
            if ("error" in result) {
              setToast(toastFromError(result.error));
              setDeleteTarget(null);
              return;
            }
            setDeleteTarget(null);
            setToast(WAREHOUSE_TOAST.deletedCarrier);
            router.refresh();
          });
        }}
      />
      <ModalShell
        open={open}
        onClose={onClose}
        title="Kurierzy w dzienniku"
        description="Lista dostępna przy wpisywaniu dostaw. Ukryty kurier zostaje w historii, ale nie pojawia się w wyborze."
        size="lg"
        loadingMessage={pending ? "Zapisywanie…" : null}
        footer={
          <Button type="button" variant="secondary" onClick={onClose}>
            Zamknij
          </Button>
        }
      >
        <div className="space-y-4 px-5 py-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className={cn(panelTypography.caption, "text-slate-500")}>
              {sorted.filter((carrier) => carrier.isActive).length} aktywnych · {sorted.length}{" "}
              łącznie
            </p>
            {!formOpen ? (
              <AddButton
                variant="ghost"
                size="sm"
                onClick={() => {
                  setForm(emptyForm());
                  setFormOpen(true);
                }}
              >
                Dodaj kuriera
              </AddButton>
            ) : null}
          </div>

          {formOpen ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
              <div className="grid gap-3 sm:grid-cols-[1fr_7rem_auto] sm:items-end">
                <Field label="Nazwa">
                  <Input
                    value={form.label}
                    onChange={(e) => setForm((current) => ({ ...current, label: e.target.value }))}
                    placeholder="np. DPD, Geodis…"
                    autoFocus
                  />
                </Field>
                <Field label="Kolejność">
                  <Input
                    inputMode="numeric"
                    value={form.sortOrder}
                    onChange={(e) =>
                      setForm((current) => ({ ...current, sortOrder: e.target.value }))
                    }
                    placeholder="auto"
                  />
                </Field>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" onClick={save} disabled={pending || !form.label.trim()}>
                    {form.slug ? "Zapisz" : "Dodaj"}
                  </Button>
                  <Button type="button" size="sm" variant="secondary" onClick={resetForm}>
                    Anuluj
                  </Button>
                </div>
              </div>
            </div>
          ) : null}

          {sorted.length === 0 ? (
            <EmptyState title="Brak kurierów" description="Dodaj pierwszego kuriera do listy." />
          ) : (
            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
              {sorted.map((carrier) => (
                <li
                  key={carrier.slug}
                  className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 sm:px-4"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-slate-900">{carrier.label}</span>
                      {!carrier.isActive ? (
                        <Badge variant="default">Ukryty</Badge>
                      ) : null}
                    </div>
                    <p className="text-[11px] text-slate-400">Kolejność: {carrier.sortOrder}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => toggleActive(carrier)}
                      disabled={pending}
                    >
                      {carrier.isActive ? "Ukryj" : "Pokaż"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => startEdit(carrier)}
                      disabled={pending}
                    >
                      Edytuj
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="text-rose-700 hover:bg-rose-50"
                      onClick={() => setDeleteTarget(carrier)}
                      disabled={pending}
                    >
                      Usuń
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </ModalShell>
    </>
  );
}
