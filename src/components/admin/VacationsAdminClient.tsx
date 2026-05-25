"use client";

import { useRouter } from "next/navigation";
import { useState, useCallback } from "react";
import { actionUpsertVacation } from "@/app/actions/admin";
import { formatPlDate, vacationNoteLabel } from "@/lib/display-labels";
import { useActionPending } from "@/hooks/useActionPending";
import { Card, CardHeader } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Toast } from "@/components/ui/Toast";
import { DataTable, TableScroll } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { ActionLoadingOverlay } from "@/components/ui/ActionLoadingOverlay";
import { Spinner } from "@/components/ui/Spinner";
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

type FormState = {
  id?: string;
  supplier_id: string;
  start_date: string;
  end_date: string;
  last_order_date: string;
  active: boolean;
};

const emptyForm = (): FormState => ({
  supplier_id: "",
  start_date: "",
  end_date: "",
  last_order_date: "",
  active: true,
});

function buildVacationSuccessToast(result: Awaited<ReturnType<typeof actionUpsertVacation>>) {
  const parts: string[] = [];
  if (result.active) {
    parts.push(
      `Urlop zapisany — przeliczono harmonogramy (${result.processed} dostawców).`
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
      `Urlop wyłączony — przeliczono harmonogramy (${result.processed} dostawców).`
    );
  }
  if (result.syncErrors.length) {
    parts.push(`Uwagi: ${result.syncErrors.slice(0, 2).join("; ")}`);
  }
  return parts.join(" ");
}

export function VacationsAdminClient({
  vacations,
  suppliers,
}: {
  vacations: VacationRow[];
  suppliers: { id: string; name: string }[];
}) {
  const router = useRouter();
  const { pending, pendingMessage, run } = useActionPending();
  const [toast, setToast] = useState<{ text: string; tone: "success" | "error" } | null>(
    null
  );
  const dismiss = useCallback(() => setToast(null), []);
  const [form, setForm] = useState<FormState>(emptyForm);

  const startEdit = (v: VacationRow) => {
    if (pending) return;
    setForm({
      id: v.id,
      supplier_id: v.supplier_id,
      start_date: v.start_date,
      end_date: v.end_date,
      last_order_date: v.last_order_date,
      active: v.active,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const resetForm = () => setForm(emptyForm());

  const save = () => {
    if (!form.supplier_id || !form.start_date || !form.end_date || !form.last_order_date) {
      setToast({ text: "Uzupełnij wszystkie pola urlopu.", tone: "error" });
      return;
    }

    const supplierName =
      suppliers.find((s) => s.id === form.supplier_id)?.name ?? "dostawcy";

    run(
      async () => {
        const result = await actionUpsertVacation(form);
        resetForm();
        setToast({
          text: buildVacationSuccessToast(result),
          tone: result.syncErrors.length ? "error" : "success",
        });
        router.refresh();
      },
      form.id
        ? `Aktualizacja urlopu (${supplierName})…`
        : `Zapis urlopu (${supplierName})…`
    );
  };

  return (
    <section className="relative space-y-6 p-4 sm:p-5">
      {pendingMessage ? (
        <ActionLoadingOverlay
          variant="viewport"
          message={pendingMessage}
          hint="Zapis w bazie i przeliczanie terminów — panel dzienny i zamówienia uwzględnią urlop automatycznie"
        />
      ) : null}

      {toast ? <Toast message={toast.text} tone={toast.tone} onDismiss={dismiss} /> : null}

      <Card className={cn(pending && "pointer-events-none select-none opacity-75")}>
        <CardHeader
          title={form.id ? "Edytuj urlop" : "Dodaj urlop dostawcy"}
          description="Po zapisie system od razu przelicza harmonogramy wszystkich dostawców. Nowe zamówienia na panelu dziennym uwzględniają aktywne urlopy."
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Dostawca" className="sm:col-span-2">
            <Select
              value={form.supplier_id}
              disabled={pending}
              onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}
            >
              <option value="">Wybierz dostawcę…</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Urlop od">
            <Input
              type="date"
              disabled={pending}
              value={form.start_date}
              onChange={(e) => setForm({ ...form, start_date: e.target.value })}
            />
          </Field>
          <Field label="Urlop do">
            <Input
              type="date"
              disabled={pending}
              value={form.end_date}
              onChange={(e) => setForm({ ...form, end_date: e.target.value })}
            />
          </Field>
          <Field label="Ostatnie zamówienie przed urlopem" className="sm:col-span-2">
            <Input
              type="date"
              disabled={pending}
              value={form.last_order_date}
              onChange={(e) =>
                setForm({ ...form, last_order_date: e.target.value })
              }
            />
          </Field>
          <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300"
              disabled={pending}
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
            />
            Urlop aktywny (uwzględniany w terminach i przy „Zamówione”)
          </label>
        </div>
        <p className="mt-4 flex flex-wrap gap-2">
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
          {form.id ? (
            <Button variant="ghost" disabled={pending} onClick={resetForm}>
              Anuluj edycję
            </Button>
          ) : null}
        </p>
      </Card>

      <Card
        padding={false}
        className={cn(pending && "pointer-events-none select-none opacity-75")}
      >
        <CardHeader
          inset
          title={`Aktywne i archiwalne urlopy (${vacations.length})`}
        />
        {!vacations.length ? (
          <EmptyState title="Brak zdefiniowanych urlopów" />
        ) : (
          <TableScroll>
            <DataTable>
              <thead>
                <tr>
                  <th>Dostawca</th>
                  <th>Od</th>
                  <th>Do</th>
                  <th>Ostatnie zamówienie</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {vacations.map((v) => (
                  <tr key={v.id}>
                    <td className="font-medium text-slate-900">
                      {v.suppliers?.name ?? "—"}
                    </td>
                    <td className="tabular-nums">{formatPlDate(v.start_date)}</td>
                    <td className="tabular-nums">{formatPlDate(v.end_date)}</td>
                    <td className="tabular-nums">
                      {formatPlDate(v.last_order_date)}
                    </td>
                    <td>
                      {v.active ? (
                        <Badge variant="success">Aktywny</Badge>
                      ) : (
                        <span className="text-slate-400">Nieaktywny</span>
                      )}
                    </td>
                    <td>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={pending}
                        onClick={() => startEdit(v)}
                      >
                        Edytuj
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          </TableScroll>
        )}
      </Card>
    </section>
  );
}
