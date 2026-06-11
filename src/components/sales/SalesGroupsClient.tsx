"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition, useCallback } from "react";
import type { SalesGroupRow } from "@/lib/data/sales-groups";
import {
  actionDeleteSalesGroup,
  actionUpsertSalesGroup,
} from "@/app/actions/sales-groups";
import { Card, CardHeader } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Toast } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";

type FormState = { id?: string; name: string; sortOrder: string };

const emptyForm = (): FormState => ({ name: "", sortOrder: "0" });

export function SalesGroupsClient({
  initial,
  canCreateGroups = true,
}: {
  initial: SalesGroupRow[];
  /** false — kierownik: tylko edycja przypisanych grup */
  canCreateGroups?: boolean;
}) {
  const router = useRouter();
  const [deletedIds, setDeletedIds] = useState<Set<string>>(() => new Set());
  const initialKey = useMemo(() => initial.map((group) => group.id).join("\0"), [initial]);
  const [appliedInitialKey, setAppliedInitialKey] = useState(initialKey);
  if (initialKey !== appliedInitialKey) {
    setAppliedInitialKey(initialKey);
    setDeletedIds(new Set());
  }
  const groups = useMemo(
    () => initial.filter((group) => !deletedIds.has(group.id)),
    [initial, deletedIds]
  );
  const [pending, start] = useTransition();
  const [toast, setToast] = useState<{ text: string; tone: "success" | "error" } | null>(
    null
  );
  const dismiss = useCallback(() => setToast(null), []);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<SalesGroupRow | null>(null);

  const resetForm = () => {
    setForm(emptyForm());
    setFormOpen(false);
  };

  const startEdit = (group: SalesGroupRow) => {
    setForm({
      id: group.id,
      name: group.name,
      sortOrder: String(group.sortOrder),
    });
    setFormOpen(true);
  };

  const save = () => {
    start(async () => {
      const sortOrder = Number.parseInt(form.sortOrder, 10);
      const r = await actionUpsertSalesGroup({
        id: form.id,
        name: form.name,
        sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
      });
      if ("error" in r) {
        setToast({ text: r.error, tone: "error" });
        return;
      }
      resetForm();
      setToast({ text: form.id ? "Zapisano grupę." : "Dodano grupę.", tone: "success" });
      router.refresh();
    });
  };

  return (
    <>
      {toast ? <Toast message={toast.text} tone={toast.tone} onDismiss={dismiss} /> : null}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Usunąć grupę?"
        message={
          deleteTarget
            ? deleteTarget.memberCount > 0
              ? `Grupa „${deleteTarget.name}" ma ${deleteTarget.memberCount} handlowców — najpierw przypisz ich do innej grupy.`
              : `Czy na pewno usunąć grupę „${deleteTarget.name}"?`
            : ""
        }
        confirmLabel="Usuń"
        danger
        pending={pending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget || deleteTarget.memberCount > 0) {
            setDeleteTarget(null);
            return;
          }
          start(async () => {
            const r = await actionDeleteSalesGroup(deleteTarget.id);
            if ("error" in r) {
              setToast({ text: r.error, tone: "error" });
              setDeleteTarget(null);
              return;
            }
            setDeletedIds((ids) => new Set(ids).add(deleteTarget.id));
            setDeleteTarget(null);
            setToast({ text: "Grupa usunięta.", tone: "success" });
            router.refresh();
          });
        }}
      />

      <section className="space-y-6">
        <p className="text-sm text-slate-600">
          {canCreateGroups
            ? "Grupy porządkują podgląd zespołu (np. Sklep i Biuro). Przypisanie handlowca ustawiasz w Handlowcy i konta. Kierowników grup przypisujesz w Admin → Użytkownicy."
            : "Widzisz tylko grupy przypisane do Twojego konta — możesz zmienić nazwę i kolejność. Nowe grupy zakłada administrator."}
        </p>

        {canCreateGroups && !formOpen ? (
          <Button
            variant="outline"
            onClick={() => {
              setForm(emptyForm());
              setFormOpen(true);
            }}
          >
            + Nowa grupa
          </Button>
        ) : null}

        {!canCreateGroups && !groups.length ? (
          <EmptyState
            title="Brak przypisanych grup"
            description="Poproś administratora o przypisanie grup (np. Sklep, Biuro) przy Twoim koncie kierownika."
          />
        ) : null}

        {formOpen ? (
          <Card>
            <CardHeader
              title={form.id ? "Edytuj grupę" : "Nowa grupa"}
              description="Kolejność sortowania — mniejsza liczba wyżej na liście podglądu."
            />
            <form
              className="grid gap-4 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                save();
              }}
            >
              <Field label="Nazwa">
                <Input
                  placeholder="np. Sklep"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </Field>
              <Field label="Kolejność">
                <Input
                  type="number"
                  min={0}
                  value={form.sortOrder}
                  onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
                />
              </Field>
              <div className="flex flex-wrap gap-2 sm:col-span-2">
                <Button type="submit" disabled={pending || !form.name.trim()}>
                  {form.id ? "Zapisz" : "Dodaj grupę"}
                </Button>
                <Button type="button" variant="secondary" onClick={resetForm}>
                  Anuluj
                </Button>
              </div>
            </form>
          </Card>
        ) : null}

        {groups.length > 0 || canCreateGroups ? (
        <Card padding={false}>
          <CardHeader inset title={`Grupy (${groups.length})`} />
          {!groups.length && canCreateGroups ? (
            <EmptyState
              title="Brak grup"
              description="Dodaj Sklep, Biuro lub własne działy — potem przypisz handlowców."
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {groups.map((g) => (
                <li
                  key={g.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5"
                >
                  <div>
                    <p className="font-medium text-slate-900">{g.name}</p>
                    <p className="text-xs text-slate-500">
                      Kolejność: {g.sortOrder} ·{" "}
                      <Badge variant="default" className="ml-0.5 text-[10px]">
                        {g.memberCount} handlowców
                      </Badge>
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => startEdit(g)}>
                      Edytuj
                    </Button>
                    {canCreateGroups ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-rose-600 hover:text-rose-700"
                        disabled={g.memberCount > 0}
                        title={
                          g.memberCount > 0
                            ? "Najpierw przenieś handlowców do innej grupy"
                            : undefined
                        }
                        onClick={() => setDeleteTarget(g)}
                      >
                        Usuń
                      </Button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
        ) : null}
      </section>
    </>
  );
}
