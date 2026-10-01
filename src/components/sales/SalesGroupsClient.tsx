"use client";
import { toastFromError, SALES_TOAST, type ToastNotice } from "@/lib/ui/notice-copy";

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
import { AddButton } from "@/components/ui/AddButton";
import { NoticeToast } from "@/components/ui/NoticeToast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { IconPencil, IconTrash2, IconUsers } from "@/components/icons/StrokeIcons";
import { cn } from "@/lib/cn";
import { salesChromeInsetClass, salesTypography } from "@/lib/ui/ontime-theme";

type FormState = { id?: string; name: string; sortOrder: string };

const emptyForm = (): FormState => ({ name: "", sortOrder: "0" });

export function SalesGroupsClient({
  initial,
  canCreateGroups = true,
  readOnlyPreview = false,
  embeddedInTeamWorkspace = false,
  loadError,
}: {
  initial: SalesGroupRow[];
  /** false — kierownik: tylko edycja przypisanych grup */
  canCreateGroups?: boolean;
  readOnlyPreview?: boolean;
  /** W /zespol/grupy — bez drugiej karty wokół listy i bez powtarzającego opisu. */
  embeddedInTeamWorkspace?: boolean;
  loadError?: string | null;
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
  const [toast, setToast] = useState<ToastNotice | null>(null);
  const dismiss = useCallback(() => setToast(null), []);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<SalesGroupRow | null>(null);

  const resetForm = () => {
    setForm(emptyForm());
    setFormOpen(false);
  };

  const openCreateForm = () => {
    setForm(emptyForm());
    setFormOpen(true);
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
        setToast(toastFromError(r.error));
        return;
      }
      resetForm();
      setToast(form.id ? SALES_TOAST.savedGroup : SALES_TOAST.addedGroup);
      router.refresh();
    });
  };

  const groupsListHeader = (
    <CardHeader
      inset
      density="compact"
      title={`Grupy (${groups.length})`}
      description={
        embeddedInTeamWorkspace
          ? canCreateGroups
            ? "Kolejność sortowania — mniejsza liczba wyżej w podglądzie zespołu."
            : "Możesz edytować nazwę i kolejność przypisanych grup."
          : undefined
      }
      action={
        canCreateGroups && !readOnlyPreview && !formOpen ? (
          <AddButton
            variant="outline"
            size="sm"
            onClick={openCreateForm}
            className={embeddedInTeamWorkspace ? undefined : "sm:min-h-9"}
          >
            Nowa grupa
          </AddButton>
        ) : null
      }
    />
  );

  const groupsList =
    !groups.length && canCreateGroups ? (
      <EmptyState
        title="Brak grup"
        description="Dodaj Sklep, Biuro lub własne działy — potem przypisz handlowców."
      />
    ) : (
      <ul className="space-y-1.5 p-2 sm:p-3 lg:p-4">
        {groups.map((g) => (
          <li
            key={g.id}
            className={cn(
              "rounded-lg border border-slate-100 bg-white px-3 py-3 transition-all sm:px-4 lg:px-5",
              "hover:border-slate-200 hover:shadow-sm"
            )}
          >
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <div className="flex min-w-0 items-center gap-2.5">
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-100/60"
                  aria-hidden
                >
                  <IconUsers size={15} />
                </span>
                <div className="min-w-0">
                  <p className={salesTypography.rowTitle}>{g.name}</p>
                  <p
                    className={cn(
                      salesTypography.rowMeta,
                      "mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1"
                    )}
                  >
                    <span>Kolejność: {g.sortOrder}</span>
                    <span title="Handlowcy widoczni w podglądzie zespołu">
                      <Badge variant="default" className="text-[10px]">
                        {g.memberCount}{" "}
                        {g.memberCount === 1
                          ? "handlowiec"
                          : g.memberCount < 5
                            ? "handlowcy"
                            : "handlowców"}
                      </Badge>
                    </span>
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                {!readOnlyPreview ? (
                  <Button variant="ghost" size="sm" className="gap-1" onClick={() => startEdit(g)}>
                    <IconPencil size={13} className="shrink-0" />
                    Edytuj
                  </Button>
                ) : null}
                {canCreateGroups && !readOnlyPreview ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1 text-rose-600 hover:text-rose-700"
                    disabled={g.memberCount > 0}
                    title={
                      g.memberCount > 0
                        ? "Najpierw przenieś handlowców do innej grupy"
                        : undefined
                    }
                    onClick={() => setDeleteTarget(g)}
                  >
                    <IconTrash2 size={13} className="shrink-0" />
                    Usuń
                  </Button>
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ul>
    );

  const groupForm = formOpen && !readOnlyPreview ? (
    <>
      <CardHeader
        inset
        density="compact"
        title={form.id ? "Edytuj grupę" : "Nowa grupa"}
        description="Kolejność sortowania — mniejsza liczba wyżej na liście podglądu."
      />
      <form
        className={cn(
          "grid gap-4 pb-4 sm:grid-cols-2",
          embeddedInTeamWorkspace ? salesChromeInsetClass : undefined
        )}
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
    </>
  ) : null;

  const groupFormSection = groupForm
    ? embeddedInTeamWorkspace
      ? <div className="border-b border-slate-100">{groupForm}</div>
      : (
          <Card>
            {groupForm}
          </Card>
        )
    : null;

  const groupsListSection =
    groups.length > 0 || canCreateGroups ? (
      embeddedInTeamWorkspace ? (
        <div className="border-t border-slate-100">
          {groupsListHeader}
          {groupsList}
        </div>
      ) : (
        <Card padding={false}>
          {groupsListHeader}
          {groupsList}
        </Card>
      )
    ) : null;

  if (loadError) return null;

  return (
    <>
      {toast ? <NoticeToast notice={toast} onDismiss={dismiss} /> : null}
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
              setToast(toastFromError(r.error));
              setDeleteTarget(null);
              return;
            }
            setDeletedIds((ids) => new Set(ids).add(deleteTarget.id));
            setDeleteTarget(null);
            setToast(SALES_TOAST.deletedGroup);
            router.refresh();
          });
        }}
      />

      <section className={cn(embeddedInTeamWorkspace ? "space-y-0" : "space-y-6")}>
        {!embeddedInTeamWorkspace ? (
          <p className="text-sm text-slate-600">
            {canCreateGroups
              ? "Grupy porządkują podgląd zespołu (np. Sklep i Biuro). Przypisanie handlowca ustawiasz w Handlowcy. Kierowników grup przypisujesz w Admin → Użytkownicy."
              : "Widzisz tylko grupy przypisane do Twojego konta — możesz zmienić nazwę i kolejność. Nowe grupy zakłada administrator."}
          </p>
        ) : null}

        {!canCreateGroups && !groups.length ? (
          <EmptyState
            title="Brak przypisanych grup"
            description="Poproś administratora o przypisanie grup (np. Sklep, Biuro) przy Twoim koncie kierownika."
          />
        ) : null}

        {groupFormSection}
        {groupsListSection}
      </section>
    </>
  );
}
