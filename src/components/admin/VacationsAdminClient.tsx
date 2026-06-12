"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useLatest } from "@/hooks/useLatest";
import { actionUpsertVacation } from "@/app/actions/admin";
import { formatPlDate, vacationNoteLabel } from "@/lib/display-labels";
import { useActionPending } from "@/hooks/useActionPending";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Toast } from "@/components/ui/Toast";
import { EmptyState } from "@/components/ui/EmptyState";
import { ActionLoadingOverlay } from "@/components/ui/ActionLoadingOverlay";
import { Spinner } from "@/components/ui/Spinner";
import { SupplierEditSheet } from "@/components/admin/SupplierEditSheet";
import {
  VacationAdminForm,
  emptyVacationAdminForm,
  type VacationAdminFormState,
} from "@/components/admin/VacationAdminForm";
import { OverflowMenu, OverflowMenuItem } from "@/components/ui/OverflowMenu";
import { cn } from "@/lib/cn";

type VacationRow = {
  id: string;
  supplier_id: string;
  start_date: string;
  end_date: string;
  last_order_date: string;
  active: boolean;
  suppliers?: { name: string };
};

function buildVacationSuccessToast(result: Awaited<ReturnType<typeof actionUpsertVacation>>) {
  const parts: string[] = [];
  if (result.active) {
    parts.push(
      `Urlop zapisany — przeliczono harmonogram${result.processed === 1 ? "" : "y"} (${result.processed} dostawc${result.processed === 1 ? "y" : "ów"}).`
    );
    if (result.nextDate) {
      parts.push(
        `${result.supplierName}: następne zamówienie ${formatPlDate(result.nextDate)}`
      );
    }
    if (result.vacationNote) {
      parts.push(vacationNoteLabel(result.vacationNote));
    }
  } else {
    parts.push(
      `Urlop wyłączony — przeliczono harmonogram${result.processed === 1 ? "" : "y"} (${result.processed} dostawc${result.processed === 1 ? "y" : "ów"}).`
    );
  }
  if (result.syncErrors.length) {
    parts.push(`Uwagi: ${result.syncErrors.slice(0, 2).join("; ")}`);
  }
  return parts.join(" ");
}

function vacationToForm(v: VacationRow): VacationAdminFormState {
  return {
    id: v.id,
    supplier_id: v.supplier_id,
    start_date: v.start_date,
    end_date: v.end_date,
    last_order_date: v.last_order_date,
    active: v.active,
  };
}

function applyFormToVacationRow(
  existing: VacationRow,
  form: VacationAdminFormState,
  supplierName: string
): VacationRow {
  return {
    ...existing,
    supplier_id: form.supplier_id,
    start_date: form.start_date,
    end_date: form.end_date,
    last_order_date: form.last_order_date,
    active: form.active,
    suppliers: { name: supplierName },
  };
}

export function VacationsAdminClient({
  vacations: initialVacations,
  suppliers,
}: {
  vacations: VacationRow[];
  suppliers: { id: string; name: string }[];
}) {
  const router = useRouter();
  const { pending, pendingMessage, run } = useActionPending();
  const [rows, setRows] = useState(initialVacations);
  const initialKey = initialVacations.map((row) => `${row.id}\0${row.start_date}`).join("\n");
  const [appliedInitialKey, setAppliedInitialKey] = useState(initialKey);
  if (initialKey !== appliedInitialKey) {
    setAppliedInitialKey(initialKey);
    setRows(initialVacations);
  }
  const [toast, setToast] = useState<{ text: string; tone: "success" | "error" } | null>(
    null
  );
  const dismiss = useCallback(() => setToast(null), []);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<VacationAdminFormState>(emptyVacationAdminForm);
  const formRef = useLatest(form);

  const resetForm = () => {
    setForm(emptyVacationAdminForm());
    setFormOpen(false);
  };

  const openCreate = () => {
    setForm(emptyVacationAdminForm());
    setFormOpen(true);
  };

  const startEdit = (v: VacationRow) => {
    if (pending) return;
    setForm(vacationToForm(v));
    setFormOpen(true);
  };

  useEffect(() => {
    if (!formOpen || !form.id) return;
    const row = document.getElementById(`vacation-row-${form.id}`);
    row?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [formOpen, form.id]);

  const save = () => {
    const snapshot = formRef.current;
    if (
      !snapshot.supplier_id ||
      !snapshot.start_date ||
      !snapshot.end_date ||
      !snapshot.last_order_date
    ) {
      setToast({ text: "Uzupełnij wszystkie pola urlopu.", tone: "error" });
      return;
    }

    const supplierName =
      suppliers.find((s) => s.id === snapshot.supplier_id)?.name ?? "dostawcy";

    run(
      async () => {
        const result = await actionUpsertVacation(snapshot);
        if (snapshot.id) {
          setRows((list) =>
            list.map((r) =>
              r.id === snapshot.id
                ? applyFormToVacationRow(r, snapshot, supplierName)
                : r
            )
          );
        }
        resetForm();
        setToast({
          text: buildVacationSuccessToast(result),
          tone: result.syncErrors.length ? "error" : "success",
        });
        router.refresh();
      },
      snapshot.id
        ? `Aktualizacja urlopu (${supplierName})…`
        : `Zapis urlopu (${supplierName})…`,
      {
        onError: (error) => {
          setToast({
            text:
              error instanceof Error
                ? error.message
                : "Nie udało się zapisać urlopu.",
            tone: "error",
          });
        },
      }
    );
  };

  const sheetTitle = form.id
    ? suppliers.find((s) => s.id === form.supplier_id)?.name ?? "Edytuj urlop"
    : "Nowy urlop dostawcy";

  return (
    <section className="relative space-y-4">
      {pendingMessage ? (
        <ActionLoadingOverlay
          variant="viewport"
          message={pendingMessage}
          hint="Zapis w bazie i przeliczanie terminów — panel dzienny i zamówienia uwzględnią urlop automatycznie"
        />
      ) : null}

      {toast ? <Toast message={toast.text} tone={toast.tone} onDismiss={dismiss} /> : null}

      <SupplierEditSheet
        open={formOpen}
        title={sheetTitle}
        description="Po zapisie system przelicza harmonogramy. Lista urlopów zostaje widoczna po lewej."
        onClose={resetForm}
        pending={pending}
        footer={
          <>
            <Button disabled={pending} onClick={save}>
              {pending ? (
                <>
                  <Spinner size="sm" />
                  Zapis i przeliczanie…
                </>
              ) : form.id ? (
                "Zapisz zmiany"
              ) : (
                "Zapisz urlop"
              )}
            </Button>
            <Button type="button" variant="ghost" disabled={pending} onClick={resetForm}>
              Anuluj
            </Button>
          </>
        }
      >
        <VacationAdminForm
          form={form}
          suppliers={suppliers}
          disabled={pending}
          onChange={setForm}
        />
      </SupplierEditSheet>

      {!formOpen ? (
        <Button variant="outline" onClick={openCreate} disabled={pending}>
          + Dodaj urlop
        </Button>
      ) : null}

      <Card
        padding={false}
        className={cn("overflow-hidden", pending && "pointer-events-none select-none opacity-75")}
      >
        <CardHeader
          inset
          density="compact"
          title={`Urlopy (${rows.length})`}
          description="Kliknij wiersz lub Edytuj, aby zmienić okres. Po zapisie system przelicza terminy."
        />
        {!rows.length ? (
          <EmptyState title="Brak zdefiniowanych urlopów" />
        ) : (
          <>
            <div
              className="hidden border-b border-slate-100 bg-slate-50/90 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 md:grid md:grid-cols-[minmax(0,1.2fr)_repeat(3,minmax(88px,120px))_minmax(88px,100px)_minmax(88px,120px)] md:gap-3 lg:px-5"
              aria-hidden
            >
              <span>Dostawca</span>
              <span>Od</span>
              <span>Do</span>
              <span>Ostatnie zam.</span>
              <span>Status</span>
              <span className="text-right">Akcje</span>
            </div>
            <ul className="divide-y divide-slate-100">
              {rows.map((v) => {
                const isEditing = formOpen && form.id === v.id;
                const name = v.suppliers?.name ?? "—";
                return (
                  <li
                    key={v.id}
                    id={`vacation-row-${v.id}`}
                    className={cn(
                      "px-3 py-3 sm:px-4 lg:px-5",
                      isEditing && "bg-indigo-50/80 ring-1 ring-inset ring-indigo-200"
                    )}
                  >
                    <div className="flex items-start gap-2 md:grid md:grid-cols-[minmax(0,1.2fr)_repeat(3,minmax(88px,120px))_minmax(88px,100px)_minmax(88px,120px)] md:items-center md:gap-3">
                      <button
                        type="button"
                        onClick={() => startEdit(v)}
                        className="min-w-0 flex-1 text-left md:contents"
                      >
                        <span className="block font-medium text-slate-900 hover:text-indigo-800 hover:underline md:truncate">
                          {name}
                          {isEditing ? (
                            <Badge variant="info" className="ml-2 text-[10px]">
                              Edycja
                            </Badge>
                          ) : null}
                        </span>
                        <span className="mt-1 block text-sm tabular-nums text-slate-600 md:mt-0">
                          {formatPlDate(v.start_date)}
                        </span>
                        <span className="mt-0.5 block text-sm tabular-nums text-slate-600 md:mt-0">
                          {formatPlDate(v.end_date)}
                        </span>
                        <span className="mt-0.5 block text-sm tabular-nums text-slate-600 md:mt-0">
                          {formatPlDate(v.last_order_date)}
                        </span>
                        <span className="mt-1 block md:mt-0">
                          {v.active ? (
                            <Badge variant="success">Aktywny</Badge>
                          ) : (
                            <span className="text-sm text-slate-400">Nieaktywny</span>
                          )}
                        </span>
                      </button>
                      <div className="flex shrink-0 items-center gap-1 md:justify-end">
                        <Button
                          variant="secondary"
                          size="sm"
                          className="hidden md:inline-flex"
                          disabled={pending}
                          onClick={() => startEdit(v)}
                        >
                          Edytuj
                        </Button>
                        <OverflowMenu
                          label={`Akcje urlopu: ${name}`}
                          align="end"
                          disabled={pending}
                          iconOnly
                          variant="segment"
                        >
                          <OverflowMenuItem onClick={() => startEdit(v)}>
                            Edytuj urlop
                          </OverflowMenuItem>
                        </OverflowMenu>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </Card>
    </section>
  );
}
