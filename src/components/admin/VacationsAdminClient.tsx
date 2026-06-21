"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLatest } from "@/hooks/useLatest";
import {
  actionDeleteVacation,
  actionUpsertVacation,
} from "@/app/actions/admin";
import { formatPlDate, vacationNoteLabel } from "@/lib/display-labels";
import { useActionPending } from "@/hooks/useActionPending";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Toast } from "@/components/ui/Toast";
import { EmptyState } from "@/components/ui/EmptyState";
import { ActionLoadingOverlay } from "@/components/ui/ActionLoadingOverlay";
import { Spinner } from "@/components/ui/Spinner";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { SupplierEditSheet } from "@/components/admin/SupplierEditSheet";
import {
  VacationAdminForm,
  emptyVacationAdminForm,
  type VacationAdminFormState,
} from "@/components/admin/VacationAdminForm";
import { VacationSavePreview } from "@/components/admin/VacationSavePreview";
import { OverflowMenu, OverflowMenuItem } from "@/components/ui/OverflowMenu";
import { cn } from "@/lib/cn";
import {
  isVacationEffectivelyActive,
  isVacationHistorical,
  isVacationScheduledInactive,
} from "@/lib/orders/vacation-status";
import { usePreviewMutationBlocker } from "@/components/layout/usePreviewMutationBlocker";

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

function VacationRowsTable({
  rows,
  form,
  formOpen,
  pending,
  todayDateKey,
  readOnly = false,
  allowDelete,
  onEdit,
  onDelete,
}: {
  rows: VacationRow[];
  form: VacationAdminFormState;
  formOpen: boolean;
  pending: boolean;
  todayDateKey: string;
  readOnly?: boolean;
  allowDelete?: boolean;
  onEdit: (row: VacationRow) => void;
  onDelete?: (row: VacationRow) => void;
}) {
  return (
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
          const canDelete =
            allowDelete &&
            onDelete &&
            !isVacationEffectivelyActive(v, todayDateKey);
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
                  onClick={() => onEdit(v)}
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
                          {isVacationEffectivelyActive(v, todayDateKey) ? (
                            <Badge variant="success">Aktywny</Badge>
                          ) : v.active ? (
                            <Badge variant="default">Wygasły</Badge>
                          ) : isVacationScheduledInactive(v, todayDateKey) ? (
                            <Badge variant="info">Wyłączony</Badge>
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
                    disabled={pending || readOnly}
                    onClick={() => onEdit(v)}
                  >
                    Edytuj
                  </Button>
                  <OverflowMenu
                    label={`Akcje urlopu: ${name}`}
                    align="end"
                    disabled={pending || readOnly}
                    iconOnly
                    variant="segment"
                  >
                    <OverflowMenuItem onClick={() => onEdit(v)}>
                      Edytuj urlop
                    </OverflowMenuItem>
                    {canDelete ? (
                      <OverflowMenuItem danger onClick={() => onDelete(v)}>
                        Usuń wpis
                      </OverflowMenuItem>
                    ) : null}
                  </OverflowMenu>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}

export function VacationsAdminClient({
  vacations: initialVacations,
  suppliers,
  todayDateKey,
}: {
  vacations: VacationRow[];
  suppliers: { id: string; name: string }[];
  todayDateKey: string;
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
  const { readOnly, blockIfReadOnly } = usePreviewMutationBlocker((text) =>
    setToast({ text, tone: "error" })
  );
  const dismiss = useCallback(() => setToast(null), []);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<VacationAdminFormState>(emptyVacationAdminForm);
  const [deleteTarget, setDeleteTarget] = useState<VacationRow | null>(null);
  const formRef = useLatest(form);

  const { activeRows, scheduledRows, pastRows } = useMemo(() => {
    const active: VacationRow[] = [];
    const scheduled: VacationRow[] = [];
    const past: VacationRow[] = [];
    for (const row of rows) {
      if (isVacationEffectivelyActive(row, todayDateKey)) {
        active.push(row);
      } else if (isVacationScheduledInactive(row, todayDateKey)) {
        scheduled.push(row);
      } else if (isVacationHistorical(row, todayDateKey)) {
        past.push(row);
      } else {
        past.push(row);
      }
    }
    return { activeRows: active, scheduledRows: scheduled, pastRows: past };
  }, [rows, todayDateKey]);

  const resetForm = () => {
    setForm(emptyVacationAdminForm());
    setFormOpen(false);
  };

  const openCreate = () => {
    if (blockIfReadOnly()) return;
    setForm(emptyVacationAdminForm());
    setFormOpen(true);
  };

  const startEdit = (v: VacationRow) => {
    if (blockIfReadOnly()) return;
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
    if (blockIfReadOnly()) return;
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
                ? applyFormToVacationRow(
                    r,
                    { ...snapshot, active: result.active },
                    supplierName
                  )
                : r
            )
          );
        } else if (result.id) {
          setRows((list) => [
            {
              id: result.id,
              supplier_id: snapshot.supplier_id,
              start_date: snapshot.start_date,
              end_date: snapshot.end_date,
              last_order_date: snapshot.last_order_date,
              active: result.active,
              suppliers: { name: supplierName },
            },
            ...list,
          ]);
        }
        resetForm();
        setToast({
          text: buildVacationSuccessToast(result),
          tone: "success",
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

  const confirmDelete = () => {
    if (!deleteTarget || blockIfReadOnly()) return;
    const name = deleteTarget.suppliers?.name ?? "urlop";
    run(
      async () => {
        await actionDeleteVacation(deleteTarget.id);
        setRows((list) => list.filter((row) => row.id !== deleteTarget.id));
        if (form.id === deleteTarget.id) resetForm();
        setDeleteTarget(null);
        setToast({ text: `Usunięto wpis urlopu (${name}).`, tone: "success" });
        router.refresh();
      },
      `Usuwanie urlopu (${name})…`,
      {
        onError: (error) => {
          setToast({
            text:
              error instanceof Error
                ? error.message
                : "Nie udało się usunąć urlopu.",
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

      <ConfirmDialog
        open={deleteTarget != null}
        title="Usunąć wpis urlopu?"
        message={
          deleteTarget
            ? `Trwale usuniesz nieaktywny urlop ${deleteTarget.suppliers?.name ?? ""} (${formatPlDate(deleteTarget.start_date)} – ${formatPlDate(deleteTarget.end_date)}). Harmonogram dostawcy zostanie przeliczony.`
            : ""
        }
        confirmLabel="Usuń"
        danger
        pending={pending}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <SupplierEditSheet
        open={formOpen}
        title={sheetTitle}
        description="Po zapisie system przelicza harmonogramy. Aktywne okresy tego samego dostawcy nie mogą się nakładać."
        onClose={resetForm}
        pending={pending}
        footer={
          <>
            <Button disabled={readOnly || pending} onClick={save}>
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
        <div className="space-y-4">
          <VacationAdminForm
            form={form}
            suppliers={suppliers}
            disabled={readOnly || pending}
            onChange={setForm}
          />
          <VacationSavePreview form={form} disabled={readOnly || pending} />
        </div>
      </SupplierEditSheet>

      {!formOpen ? (
        <Button variant="outline" onClick={openCreate} disabled={readOnly || pending}>
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
          title={`Aktywne urlopy (${activeRows.length})`}
          description="Kliknij wiersz lub Edytuj, aby zmienić okres. Po zapisie system przelicza terminy."
        />
        {!activeRows.length ? (
          <EmptyState title="Brak aktywnych urlopów" />
        ) : (
          <VacationRowsTable
            rows={activeRows}
            form={form}
            formOpen={formOpen}
            pending={pending}
            readOnly={readOnly}
            todayDateKey={todayDateKey}
            onEdit={startEdit}
          />
        )}
      </Card>

      {scheduledRows.length ? (
        <Card padding={false} className="overflow-hidden">
          <CardHeader
            inset
            density="compact"
            title={`Wyłączone (przyszłe) (${scheduledRows.length})`}
            description="Zapisane okresy bez wpływu na harmonogram — można je ponownie włączyć."
          />
          <VacationRowsTable
            rows={scheduledRows}
            form={form}
            formOpen={formOpen}
            pending={pending}
            readOnly={readOnly}
            todayDateKey={todayDateKey}
            allowDelete
            onEdit={startEdit}
            onDelete={(row) => {
              if (blockIfReadOnly()) return;
              setDeleteTarget(row);
            }}
          />
        </Card>
      ) : null}

      {pastRows.length ? (
        <details className="group overflow-hidden rounded-md border border-slate-200/90 bg-white shadow-sm open:shadow-md">
          <summary className="cursor-pointer list-none px-3 py-3 text-sm font-semibold text-slate-900 marker:content-none sm:px-4 [&::-webkit-details-marker]:hidden">
            <span className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                Przeszłe urlopy
                <Badge variant="default" className="font-normal">
                  {pastRows.length}
                </Badge>
              </span>
              <span className="text-xs font-normal text-slate-500 group-open:hidden">
                Rozwiń
              </span>
              <span className="hidden text-xs font-normal text-slate-500 group-open:inline">
                Zwiń
              </span>
            </span>
          </summary>
          <p className="border-t border-slate-100 px-3 pb-2 text-xs text-slate-500 sm:px-4">
            Zakończone wpisy można edytować albo trwale usunąć, żeby uporządkować listę.
          </p>
          <VacationRowsTable
            rows={pastRows}
            form={form}
            formOpen={formOpen}
            pending={pending}
            readOnly={readOnly}
            todayDateKey={todayDateKey}
            allowDelete
            onEdit={startEdit}
            onDelete={(row) => {
              if (blockIfReadOnly()) return;
              setDeleteTarget(row);
            }}
          />
        </details>
      ) : null}
    </section>
  );
}
