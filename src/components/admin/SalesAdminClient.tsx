"use client";

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
import { InviteLinkDialog } from "@/components/admin/InviteLinkDialog";
import type { SalesInviteLinkResult } from "@/lib/users/sales-invite";
import { Card, CardHeader } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Toast } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable, TableScroll } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";

type FormState = { id?: string; name: string; email: string; groupId: string };

const emptyForm = (): FormState => ({ name: "", email: "", groupId: "" });

export function SalesAdminClient({
  initial,
  groups,
  managerMode = false,
  requireGroupOnCreate = false,
}: {
  initial: SalesPersonAdminRow[];
  groups: SalesGroupRow[];
  /** Kierownik handlowców — bez usuwania, z hasłem jednorazowym */
  managerMode?: boolean;
  /** Kierownik musi wybrać grupę ze swojego scope */
  requireGroupOnCreate?: boolean;
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
  const [toast, setToast] = useState<{ text: string; tone: "success" | "error" } | null>(
    null
  );
  const dismiss = useCallback(() => setToast(null), []);
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState<string>("all");
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

  const filtered = useMemo(() => {
    let list = rows;
    if (groupFilter === "none") {
      list = list.filter((r) => !r.groupId);
    } else if (groupFilter === "all") {
      list = list.filter((r) => r.groupId);
    } else {
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
      setToast({ text: r.error, tone: "error" });
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
    if (requireGroupOnCreate && !form.groupId.trim()) {
      setToast({ text: "Wybierz grupę z listy przypisanych.", tone: "error" });
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
          setToast({ text: r.error, tone: "error" });
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
        setToast({ text: r.error, tone: "error" });
        return;
      }
      resetForm();
      if (wasNew && !managerMode) {
        await runInviteLink(r.id, true);
      } else {
        setToast({ text: "Zapisano zmiany handlowca.", tone: "success" });
        router.refresh();
      }
    });
  };

  return (
    <>
      {toast ? <Toast message={toast.text} tone={toast.tone} onDismiss={dismiss} /> : null}
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
              setToast({ text: r.error, tone: "error" });
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
              setToast({ text: r.error, tone: "error" });
              setDeleteTarget(null);
              return;
            }
            setRows((list) => list.filter((x) => x.id !== deleteTarget.id));
            setDeleteTarget(null);
            setToast({ text: "Handlowiec usunięty.", tone: "success" });
          });
        }}
      />

      <section className="space-y-6">
        {!formOpen ? (
          <Button
            variant="outline"
            onClick={openCreateForm}
            disabled={managerMode && requireGroupOnCreate && !groups.length}
            title={
              managerMode && requireGroupOnCreate && !groups.length
                ? "Brak przypisanych grup — poproś administratora"
                : undefined
            }
          >
            + Dodaj handlowca
          </Button>
        ) : null}

        {formOpen ? (
          <Card padding={false} className="overflow-hidden">
            <CardHeader
              inset
              density="compact"
              title={form.id ? "Edytuj handlowca" : "Dodaj handlowca"}
              description={
                managerMode && !form.id
                  ? "Utworzysz kartę handlowca i konto logowania. Hasło jednorazowe przekażesz osobiście — przy pierwszym logowaniu ustawi własne."
                  : "E-mail służy do powiadomień i jako login przy zakładaniu konta."
              }
            />
            <form
              className="grid gap-4 px-3 pb-4 sm:grid-cols-2 sm:px-4 lg:px-5"
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
                  {!requireGroupOnCreate ? (
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
              <div className="flex flex-wrap gap-2 sm:col-span-2">
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
            </form>
          </Card>
        ) : null}

        <Card padding={false} className="overflow-hidden">
          <CardHeader
            inset
            density="compact"
            title={`Handlowcy (${rows.length})`}
            description={
              managerMode
                ? "Nowy handlowiec dostaje hasło jednorazowe. Dla kont z logowaniem — „Reset hasła”. Bez konta — link zaproszenia."
                : "Wygeneruj link zaproszenia — handlowiec ustawi hasło i konto powiąże się automatycznie."
            }
          />
          <div className="space-y-3 border-b border-slate-100 px-4 py-3">
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setGroupFilter("all")}
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                  groupFilter === "all"
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                Wszyscy
              </button>
              {groups.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setGroupFilter(g.id)}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                    groupFilter === g.id
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {g.name}
                </button>
              ))}
              {!managerMode ? (
                <button
                  type="button"
                  onClick={() => setGroupFilter("none")}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                    groupFilter === "none"
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  Bez grupy
                </button>
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
                  ? "Zmień frazę wyszukiwania."
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
                    <tr key={p.id}>
                      <td className="font-medium text-slate-900">{p.name}</td>
                      <td className="text-slate-600">{p.groupName ?? "—"}</td>
                      <td className="text-slate-700">{p.email || "—"}</td>
                      <td>
                        {p.linkedUserEmail ? (
                          <span className="text-sm text-emerald-800">{p.linkedUserEmail}</span>
                        ) : (
                          <Badge variant="warning" className="text-[10px]">
                            Brak konta
                          </Badge>
                        )}
                      </td>
                      <td className="text-center tabular-nums text-slate-600">
                        {p.orderCount}
                      </td>
                      <td>
                        <div className="flex flex-wrap justify-end gap-1">
                          {!p.linkedUserId ? (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={pending || !p.email?.trim()}
                                title={
                                  !p.email?.trim()
                                    ? "Uzupełnij e-mail handlowca"
                                    : undefined
                                }
                                onClick={() => openInviteLink(p.id)}
                              >
                                Link zaproszenia
                              </Button>
                              {!managerMode ? (
                                <Link
                                  href={`/admin/uzytkownicy?handlowiec=${p.id}`}
                                  className="inline-flex items-center rounded-md px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                                >
                                  Ręcznie
                                </Link>
                              ) : null}
                            </>
                          ) : (
                            <>
                              {managerMode ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={pending}
                                  onClick={() => setResetTarget(p)}
                                >
                                  Reset hasła
                                </Button>
                              ) : (
                                <Link
                                  href="/admin/uzytkownicy"
                                  className="inline-flex items-center rounded-md px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                                >
                                  Konto
                                </Link>
                              )}
                            </>
                          )}
                          <Button variant="ghost" size="sm" onClick={() => startEdit(p)}>
                            Edytuj
                          </Button>
                          {!managerMode ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-rose-600 hover:text-rose-700"
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
                              Usuń
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            </TableScroll>
          )}
        </Card>
      </section>
    </>
  );
}
