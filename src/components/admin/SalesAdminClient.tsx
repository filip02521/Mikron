"use client";
import { toastFromError, SALES_TOAST, type ToastNotice } from "@/lib/ui/notice-copy";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition, useCallback } from "react";
import type { SalesPersonAdminRow } from "@/lib/data/sales-people-admin";
import type { SalesGroupRow } from "@/lib/data/sales-groups";
import {
  actionUpsertSalesPerson,
  actionDeleteSalesPerson,
} from "@/app/actions/admin";
import { actionGenerateSalesPersonInviteLink } from "@/app/actions/users";
import {
  actionCreateSalesTeamUser,
  actionGenerateSalesTeamInviteLink,
  actionResetSalesTeamUserPassword,
} from "@/app/actions/sales-manager";
import { TempPasswordDialog } from "@/components/sales/TempPasswordDialog";
import { SalesPersonAccountCell } from "@/components/sales/SalesPersonAccountCell";
import { InviteLinkDialog } from "@/components/admin/InviteLinkDialog";
import { SalesAdminHelpPanel } from "@/components/admin/SalesAdminHelpPanel";
import type { SalesInviteLinkResult } from "@/lib/users/sales-invite";
import { Card, CardHeader } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { AddButton } from "@/components/ui/AddButton";
import { NoticeToast } from "@/components/ui/NoticeToast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable, TableScroll } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { IconPencil, IconTrash2, IconLink, IconUserCog, IconKeyRound } from "@/components/icons/StrokeIcons";
import { cn } from "@/lib/cn";
import { brandLinkClass, controlFocusClass, panelChoiceChipClass, panelChoiceChipIdleClass, panelChoiceChipSelectedClass, salesChromeInsetClass } from "@/lib/ui/ontime-theme";

type FormState = { id?: string; name: string; email: string; groupId: string };
type GroupFilter = "all" | "none" | string;

const emptyForm = (): FormState => ({ name: "", email: "", groupId: "" });

function GroupFilterChip({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        panelChoiceChipClass,
        controlFocusClass,
        "inline-flex shrink-0 items-center gap-1.5 px-2.5 py-1.5",
        active ? panelChoiceChipSelectedClass : panelChoiceChipIdleClass
      )}
    >
      <span>{label}</span>
      <span
        className={cn(
          "rounded px-1 py-px text-[10px] font-semibold tabular-nums",
          active ? "bg-indigo-100/80 text-indigo-900" : "bg-slate-100 text-slate-600"
        )}
      >
        {count}
      </span>
    </button>
  );
}

function groupBadgeClass(): string {
  return "inline-flex max-w-full items-center rounded-full border border-indigo-200/80 bg-indigo-50/90 px-2.5 py-0.5 text-xs font-medium text-indigo-800";
}

export function SalesAdminClient({
  initial,
  groups,
  managerMode = false,
  requireGroupOnCreate = false,
  managerHasTeamScope = true,
  embeddedInTeamWorkspace = false,
}: {
  initial: SalesPersonAdminRow[];
  groups: SalesGroupRow[];
  managerMode?: boolean;
  requireGroupOnCreate?: boolean;
  /** false — kierownik bez przypisanych grup (blokuje dodawanie). */
  managerHasTeamScope?: boolean;
  /** W /zespol/handlowcy — bez drugiej karty wokół listy. */
  embeddedInTeamWorkspace?: boolean;
}) {
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const initialKey = initial.map((row) => `${row.id}\0${row.email}\0${row.groupId ?? ""}`).join("\n");
  const [appliedInitialKey, setAppliedInitialKey] = useState(initialKey);
  if (initialKey !== appliedInitialKey) {
    setAppliedInitialKey(initialKey);
    setRows(initial);
  }
  const [pending, start] = useTransition();
  const [toast, setToast] = useState<ToastNotice | null>(null);
  const dismiss = useCallback(() => setToast(null), []);
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState<GroupFilter>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<SalesPersonAdminRow | null>(null);
  const [inviteDialog, setInviteDialog] = useState<SalesInviteLinkResult | null>(null);
  const [tempPasswordDialog, setTempPasswordDialog] = useState<{
    email: string;
    salesPersonName: string;
    tempPassword: string;
    variant: "create" | "reset";
  } | null>(null);
  const [resetTarget, setResetTarget] = useState<SalesPersonAdminRow | null>(null);

  const groupCounts = useMemo(() => {
    const counts: Record<string, number> = { all: rows.length, none: 0 };
    for (const row of rows) {
      if (!row.groupId) {
        counts.none = (counts.none ?? 0) + 1;
      } else {
        counts[row.groupId] = (counts[row.groupId] ?? 0) + 1;
      }
    }
    return counts;
  }, [rows]);

  const linkedCount = useMemo(
    () => rows.filter((r) => r.linkedUserId).length,
    [rows]
  );
  const unlinkedCount = rows.length - linkedCount;

  const filtered = useMemo(() => {
    let list = rows;
    if (groupFilter === "none") {
      list = list.filter((r) => !r.groupId);
    } else if (groupFilter !== "all") {
      list = list.filter((r) => r.groupId === groupFilter);
    }
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        (r.linkedUserEmail?.toLowerCase().includes(q) ?? false) ||
        (r.groupName?.toLowerCase().includes(q) ?? false)
    );
  }, [rows, search, groupFilter]);

  const resetForm = () => {
    setForm(emptyForm());
    setFormOpen(false);
  };

  const defaultGroupId = groups.length === 1 ? groups[0]!.id : "";

  const openCreateForm = () => {
    setForm({ ...emptyForm(), groupId: defaultGroupId });
    setFormOpen(true);
  };

  const startEdit = (row: SalesPersonAdminRow) => {
    setForm({
      id: row.id,
      name: row.name,
      email: row.email,
      groupId: row.groupId ?? "",
    });
    setFormOpen(true);
  };

  const runInviteLink = async (salesPersonId: string, afterAdd = false) => {
    const r = managerMode
      ? await actionGenerateSalesTeamInviteLink(salesPersonId)
      : await actionGenerateSalesPersonInviteLink(salesPersonId);
    if ("error" in r) {
      setToast(toastFromError(r.error));
      return;
    }
    setInviteDialog(r.invite);
    try {
      await navigator.clipboard.writeText(r.invite.link);
      setToast({
        text: afterAdd
          ? "Handlowiec dodany — link zaproszenia skopiowany do schowka."
          : "Link zaproszenia skopiowany do schowka.",
        tone: "success",
      });
    } catch {
      setToast({
        text: afterAdd
          ? "Handlowiec dodany — skopiuj link z okna."
          : "Link wygenerowany — skopiuj z okna.",
        tone: "success",
      });
    }
    router.refresh();
  };

  const openInviteLink = (salesPersonId: string) => {
    start(() => runInviteLink(salesPersonId));
  };

  const save = () => {
    const wasNew = !form.id;
    if ((requireGroupOnCreate || managerMode) && !form.groupId.trim()) {
      setToast(SALES_TOAST.missingGroup);
      return;
    }
    start(async () => {
      if (managerMode && wasNew) {
        const r = await actionCreateSalesTeamUser({
          name: form.name,
          email: form.email,
          groupId: form.groupId || null,
        });
        if ("error" in r) {
          setToast(toastFromError(r.error));
          return;
        }
        resetForm();
        setTempPasswordDialog({
          email: r.email,
          salesPersonName: r.salesPersonName,
          tempPassword: r.tempPassword,
          variant: "create",
        });
        router.refresh();
        return;
      }

      const r = await actionUpsertSalesPerson({
        id: form.id,
        name: form.name,
        email: form.email,
        groupId: form.groupId || null,
      });
      if ("error" in r) {
        setToast(toastFromError(r.error));
        return;
      }
      resetForm();
      if (wasNew && !managerMode) {
        await runInviteLink(r.id, true);
      } else {
        setToast(SALES_TOAST.savedSalesPerson);
        router.refresh();
      }
    });
  };

  const createDisabled = managerMode && (!managerHasTeamScope || !groups.length);

  const salesPeopleListHeader = (
    <CardHeader
      inset
      density="compact"
      title={`Handlowcy (${rows.length})`}
      description={
        managerMode
          ? "Nowy handlowiec dostaje hasło jednorazowe. Dla kont z logowaniem — reset hasła."
          : "Link zaproszenia zakłada konto i powiązuje je z kartą handlowca."
      }
      action={
        <div className="flex flex-wrap items-center justify-end gap-2.5">
          {unlinkedCount > 0 ? (
            <Badge variant="warning" className="text-[10px]">
              {unlinkedCount} bez konta
            </Badge>
          ) : null}
          {linkedCount > 0 ? (
            <Badge variant="success" className="text-[10px]">
              {linkedCount} z kontem
            </Badge>
          ) : null}
          {!formOpen ? (
            <AddButton
              variant="outline"
              size="sm"
              onClick={openCreateForm}
              disabled={createDisabled}
              title={createDisabled ? "Brak przypisanych grup — poproś administratora" : undefined}
            >
              Dodaj handlowca
            </AddButton>
          ) : null}
        </div>
      }
    />
  );

  const salesPeopleListBody = (
    <>
      <div
        className={cn(
          "space-y-3 border-b border-slate-100 py-3",
          salesChromeInsetClass
        )}
      >
        <div className="flex flex-wrap gap-2">
          <GroupFilterChip
            active={groupFilter === "all"}
            onClick={() => setGroupFilter("all")}
            label="Wszyscy"
            count={groupCounts.all}
          />
          {groups.map((g) => {
            const count = groupCounts[g.id] ?? 0;
            if (!count) return null;
            return (
              <GroupFilterChip
                key={g.id}
                active={groupFilter === g.id}
                onClick={() => setGroupFilter(g.id)}
                label={g.name}
                count={count}
              />
            );
          })}
          {!managerMode && (groupCounts.none ?? 0) > 0 ? (
            <GroupFilterChip
              active={groupFilter === "none"}
              onClick={() => setGroupFilter("none")}
              label="Bez grupy"
              count={groupCounts.none ?? 0}
            />
          ) : null}
        </div>
        <Input
          placeholder="Szukaj po imieniu, e-mailu, grupie lub koncie…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Szukaj handlowców"
        />
      </div>
      {!filtered.length ? (
        <EmptyState
          title={rows.length ? "Brak wyników" : "Brak handlowców"}
          description={
            rows.length
              ? "Zmień filtr grupy lub frazę wyszukiwania."
              : "Dodaj pierwszą osobę z listy sprzedaży."
          }
        />
      ) : (
        <TableScroll>
          <DataTable>
            <thead>
              <tr>
                <th>Imię i nazwisko</th>
                <th>Grupa</th>
                <th>E-mail</th>
                <th>Konto w systemie</th>
                <th className="text-center">Zamówienia</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="transition-colors hover:bg-slate-50/50">
                  <td className="font-medium text-slate-900">
                    <div className="flex items-center gap-2">
                      <span
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-100 text-xs font-bold text-slate-600 ring-1 ring-inset ring-slate-200/60"
                        aria-hidden
                      >
                        {p.name.charAt(0).toUpperCase() || "?"}
                      </span>
                      <span className="truncate">{p.name}</span>
                    </div>
                  </td>
                  <td>
                    {p.groupName ? (
                      <span className={groupBadgeClass()}>{p.groupName}</span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="text-slate-700">{p.email || "—"}</td>
                  <td>
                    <SalesPersonAccountCell row={p} />
                  </td>
                  <td className="text-center tabular-nums text-slate-600">
                    {p.orderCount > 0 ? p.orderCount : "—"}
                  </td>
                  <td>
                    <div className="flex flex-col items-end gap-1.5">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        {!p.linkedUserId ? (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1.5"
                              disabled={pending || !p.email?.trim()}
                              title={
                                !p.email?.trim() ? "Uzupełnij e-mail handlowca" : undefined
                              }
                              onClick={() => openInviteLink(p.id)}
                            >
                              <IconLink size={13} className="shrink-0" />
                              Link zaproszenia
                            </Button>
                            {!managerMode ? (
                              <Link
                                href={`/admin/uzytkownicy?handlowiec=${p.id}`}
                                className={cn(
                                  "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium",
                                  "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                                )}
                              >
                                <IconUserCog size={13} className="shrink-0" />
                                Ręcznie
                              </Link>
                            ) : null}
                          </>
                        ) : managerMode ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5"
                            disabled={pending}
                            onClick={() => setResetTarget(p)}
                          >
                            <IconKeyRound size={13} className="shrink-0" />
                            Reset hasła
                          </Button>
                        ) : (
                          <Link
                            href="/admin/uzytkownicy"
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium",
                              brandLinkClass,
                              "no-underline hover:bg-indigo-50/80"
                            )}
                          >
                            <IconUserCog size={13} className="shrink-0" />
                            Konto
                          </Link>
                        )}
                      </div>
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button variant="ghost" size="sm" className="gap-1" onClick={() => startEdit(p)}>
                          <IconPencil size={13} className="shrink-0" />
                          Edytuj
                        </Button>
                        {!managerMode ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1 text-rose-600 hover:text-rose-700"
                            disabled={p.orderCount > 0 || !!p.linkedUserId}
                            title={
                              p.orderCount > 0
                                ? "Nie można usunąć — są zamówienia w historii"
                                : p.linkedUserId
                                  ? "Najpierw usuń powiązane konto użytkownika"
                                  : undefined
                            }
                            onClick={() => setDeleteTarget(p)}
                          >
                            <IconTrash2 size={13} className="shrink-0" />
                            Usuń
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </TableScroll>
      )}
    </>
  );

  const salesPeopleListSection = embeddedInTeamWorkspace ? (
    <div className="border-t border-slate-100">
      {salesPeopleListHeader}
      {salesPeopleListBody}
    </div>
  ) : (
    <Card padding={false} className="overflow-hidden">
      {salesPeopleListHeader}
      {salesPeopleListBody}
    </Card>
  );

  const salesPersonForm = formOpen ? (
    <>
      <CardHeader
        inset
        density="compact"
        title={form.id ? "Edytuj handlowca" : "Dodaj handlowca"}
        description={
          managerMode && !form.id
            ? "Utworzysz kartę handlowca i konto logowania. Hasło jednorazowe przekażesz osobiście."
            : "E-mail służy do powiadomień i jako login przy zakładaniu konta."
        }
      />
      <form
        className={cn(
          "grid gap-4 pb-4 sm:grid-cols-2",
          embeddedInTeamWorkspace ? salesChromeInsetClass : "px-3 sm:px-4 lg:px-5"
        )}
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <Field label="Imię i nazwisko">
          <Input
            placeholder="np. Jan Kowalski"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </Field>
        <Field label="E-mail">
          <Input
            type="email"
            placeholder="jan@firma.pl"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </Field>
        <Field label="Grupa" className="sm:col-span-2">
          <Select
            value={form.groupId}
            onChange={(e) => setForm({ ...form, groupId: e.target.value })}
          >
                  {!managerMode && !requireGroupOnCreate ? (
                    <option value="">— Bez grupy —</option>
                  ) : (
                    <option value="">— Wybierz grupę —</option>
                  )}
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </Select>
        </Field>
        <div className="space-y-3 sm:col-span-2">
          {!managerMode && !form.id ? (
            <p className="text-xs leading-relaxed text-slate-500">
              Po zapisie wygenerujemy link zaproszenia. Ręczne konto zakładasz w{" "}
              <Link href="/admin/uzytkownicy" className={brandLinkClass}>
                Konta
              </Link>
              .
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              disabled={pending || !form.name.trim() || !form.email.trim()}
            >
              {form.id ? "Zapisz zmiany" : "Dodaj handlowca"}
            </Button>
            <Button type="button" variant="secondary" onClick={resetForm}>
              Anuluj
            </Button>
          </div>
        </div>
      </form>
    </>
  ) : null;

  const salesPersonFormSection = salesPersonForm
    ? embeddedInTeamWorkspace
      ? <div className="border-b border-slate-100">{salesPersonForm}</div>
      : (
          <Card padding={false} className="overflow-hidden">
            {salesPersonForm}
          </Card>
        )
    : null;

  return (
    <>
      {toast ? <NoticeToast notice={toast} onDismiss={dismiss} /> : null}
      {inviteDialog ? (
        <InviteLinkDialog invite={inviteDialog} onClose={() => setInviteDialog(null)} />
      ) : null}
      {tempPasswordDialog ? (
        <TempPasswordDialog
          email={tempPasswordDialog.email}
          salesPersonName={tempPasswordDialog.salesPersonName}
          tempPassword={tempPasswordDialog.tempPassword}
          variant={tempPasswordDialog.variant}
          onClose={() => setTempPasswordDialog(null)}
        />
      ) : null}
      <ConfirmDialog
        open={!!resetTarget}
        title="Zresetować hasło?"
        message={
          resetTarget
            ? `Wygenerujesz nowe hasło jednorazowe dla „${resetTarget.name}". Poprzednie hasło przestanie działać — użytkownik przy logowaniu ustawi własne.`
            : ""
        }
        confirmLabel="Resetuj hasło"
        danger
        pending={pending}
        onCancel={() => setResetTarget(null)}
        onConfirm={() => {
          if (!resetTarget?.linkedUserId) {
            setResetTarget(null);
            return;
          }
          start(async () => {
            const r = await actionResetSalesTeamUserPassword(resetTarget.id);
            setResetTarget(null);
            if ("error" in r) {
              setToast(toastFromError(r.error));
              return;
            }
            setTempPasswordDialog({
              email: r.email,
              salesPersonName: r.salesPersonName,
              tempPassword: r.tempPassword,
              variant: "reset",
            });
            setToast({
              text: "Hasło zresetowane — skopiuj dane z okna i przekaż handlowcowi.",
              tone: "success",
            });
            router.refresh();
          });
        }}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        title="Usunąć handlowca?"
        message={
          deleteTarget
            ? deleteTarget.orderCount > 0
              ? `„${deleteTarget.name}" ma ${deleteTarget.orderCount} zamówień — nie można usunąć.`
              : deleteTarget.linkedUserEmail
                ? `„${deleteTarget.name}" ma powiązane konto (${deleteTarget.linkedUserEmail}). Najpierw usuń lub zmień użytkownika.`
                : `Czy na pewno usunąć „${deleteTarget.name}"? Tej operacji nie można cofnąć.`
            : ""
        }
        confirmLabel="Usuń"
        danger
        pending={pending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget || deleteTarget.orderCount > 0 || deleteTarget.linkedUserId) {
            setDeleteTarget(null);
            return;
          }
          start(async () => {
            const r = await actionDeleteSalesPerson(deleteTarget.id);
            if ("error" in r) {
              setToast(toastFromError(r.error));
              setDeleteTarget(null);
              return;
            }
            setRows((list) => list.filter((x) => x.id !== deleteTarget.id));
            setDeleteTarget(null);
            setToast(SALES_TOAST.deletedSalesPerson);
            router.refresh();
          });
        }}
      />

      <section className={cn(embeddedInTeamWorkspace ? "space-y-0" : "space-y-4")}>
        {salesPersonFormSection}

        {salesPeopleListSection}

        <SalesAdminHelpPanel
          managerMode={managerMode}
          embedded={embeddedInTeamWorkspace}
        />
      </section>
    </>
  );
}
