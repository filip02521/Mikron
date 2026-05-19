"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition, useCallback } from "react";
import type { SalesPersonAdminRow } from "@/lib/data/sales-people-admin";
import {
  actionUpsertSalesPerson,
  actionDeleteSalesPerson,
} from "@/app/actions/admin";
import { actionGenerateSalesPersonInviteLink } from "@/app/actions/users";
import { InviteLinkDialog } from "@/components/admin/InviteLinkDialog";
import type { SalesInviteLinkResult } from "@/lib/users/sales-invite";
import { Card, CardHeader } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Toast } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable, TableScroll } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";

type FormState = { id?: string; name: string; email: string };

const emptyForm = (): FormState => ({ name: "", email: "" });

export function SalesAdminClient({ initial }: { initial: SalesPersonAdminRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  useEffect(() => {
    setRows(initial);
  }, [initial]);
  const [pending, start] = useTransition();
  const [toast, setToast] = useState<{ text: string; tone: "success" | "error" } | null>(
    null
  );
  const dismiss = useCallback(() => setToast(null), []);
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<SalesPersonAdminRow | null>(null);
  const [inviteDialog, setInviteDialog] = useState<SalesInviteLinkResult | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        (r.linkedUserEmail?.toLowerCase().includes(q) ?? false)
    );
  }, [rows, search]);

  const resetForm = () => {
    setForm(emptyForm());
    setFormOpen(false);
  };

  const startEdit = (row: SalesPersonAdminRow) => {
    setForm({ id: row.id, name: row.name, email: row.email });
    setFormOpen(true);
  };

  const runInviteLink = async (salesPersonId: string, afterAdd = false) => {
    const r = await actionGenerateSalesPersonInviteLink(salesPersonId);
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
    start(async () => {
      const r = await actionUpsertSalesPerson(form);
      if ("error" in r) {
        setToast({ text: r.error, tone: "error" });
        return;
      }
      resetForm();
      if (wasNew) {
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
            onClick={() => {
              setForm(emptyForm());
              setFormOpen(true);
            }}
          >
            + Dodaj handlowca
          </Button>
        ) : null}

        {formOpen ? (
          <Card>
            <CardHeader
              title={form.id ? "Edytuj handlowca" : "Dodaj handlowca"}
              description="E-mail służy do powiadomień i jako login przy zakładaniu konta."
            />
            <form
              className="grid gap-4 sm:grid-cols-2"
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

        <Card padding={false}>
          <CardHeader
            inset
            title={`Handlowcy (${rows.length})`}
            description="Wygeneruj link zaproszenia — handlowiec ustawi hasło i konto powiąże się automatycznie."
          />
          <div className="border-b border-slate-100 px-4 py-3">
            <Input
              placeholder="Szukaj po imieniu, e-mailu lub koncie…"
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
                              <Link
                                href={`/admin/uzytkownicy?handlowiec=${p.id}`}
                                className="inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                              >
                                Ręcznie
                              </Link>
                            </>
                          ) : (
                            <Link
                              href="/admin/uzytkownicy"
                              className="inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                            >
                              Konto
                            </Link>
                          )}
                          <Button variant="ghost" size="sm" onClick={() => startEdit(p)}>
                            Edytuj
                          </Button>
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
