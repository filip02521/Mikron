"use client";

import { useMemo, useState, useTransition, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { AppUserRow } from "@/lib/data/users";
import type { UserRole } from "@/types/database";
import { ROLE_LABELS, ROLE_OPTIONS, roleRequiresSalesPerson } from "@/lib/users/labels";
import {
  actionCreateAppUser,
  actionUpdateAppUser,
  actionSetUserPassword,
  actionGeneratePasswordResetLink,
  actionDeleteAppUser,
} from "@/app/actions/users";
import { actionSetSalesManagerGroups } from "@/app/actions/sales-group-managers";
import { Card, CardHeader } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Toast } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable, TableScroll } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { formatPlDate } from "@/lib/display-labels";

type SalesPerson = { id: string; name: string; email: string };
type SalesGroupOption = { id: string; name: string };

function salesPersonLabel(
  salesPeople: SalesPerson[],
  salesPersonId: string | null,
  salesPersonName: string | null
): string {
  if (!salesPersonId) return "—";
  return (
    salesPeople.find((p) => p.id === salesPersonId)?.name ??
    salesPersonName ??
    "—"
  );
}

export function UsersAdminClient({
  initialUsers,
  salesPeople,
  salesGroups = [],
  initialManagerGroups = {},
  currentUserId,
  prefillSalesPersonId,
}: {
  initialUsers: AppUserRow[];
  salesPeople: SalesPerson[];
  salesGroups?: SalesGroupOption[];
  initialManagerGroups?: Record<string, string[]>;
  currentUserId: string;
  prefillSalesPersonId?: string;
}) {
  const router = useRouter();
  const [users, setUsers] = useState(initialUsers);
  const [pending, start] = useTransition();
  const [toast, setToast] = useState<{ text: string; tone: "success" | "error" } | null>(
    null
  );
  const dismiss = useCallback(() => setToast(null), []);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(!!prefillSalesPersonId);
  const [deleteTarget, setDeleteTarget] = useState<AppUserRow | null>(null);

  const [createForm, setCreateForm] = useState({
    email: "",
    role: "zakupy" as UserRole,
    salesPersonId: "",
    password: "",
  });

  const [edits, setEdits] = useState<
    Record<string, { role: UserRole; salesPersonId: string }>
  >(() =>
    Object.fromEntries(
      initialUsers.map((u) => [
        u.id,
        { role: u.role, salesPersonId: u.salesPersonId ?? "" },
      ])
    )
  );

  const [managerGroups, setManagerGroups] =
    useState<Record<string, string[]>>(initialManagerGroups);

  const [passwordModal, setPasswordModal] = useState<{
    userId: string;
    email: string;
  } | null>(null);
  const [newPassword, setNewPassword] = useState("");

  useEffect(() => {
    setUsers(initialUsers);
    setEdits(
      Object.fromEntries(
        initialUsers.map((u) => [
          u.id,
          { role: u.role, salesPersonId: u.salesPersonId ?? "" },
        ])
      )
    );
    setManagerGroups(initialManagerGroups);
  }, [initialUsers, initialManagerGroups]);

  const toggleManagerGroup = (userId: string, groupId: string) => {
    setManagerGroups((prev) => {
      const cur = prev[userId] ?? [];
      const next = cur.includes(groupId)
        ? cur.filter((g) => g !== groupId)
        : [...cur, groupId];
      return { ...prev, [userId]: next };
    });
  };

  useEffect(() => {
    if (!prefillSalesPersonId) return;
    const email = salesPeople.find((p) => p.id === prefillSalesPersonId)?.email?.trim() ?? "";
    setCreateForm({
      email,
      role: "sales",
      salesPersonId: prefillSalesPersonId,
      password: "",
    });
    setCreateOpen(true);
  }, [prefillSalesPersonId, salesPeople]);

  const linkedSalesPersonIds = useMemo(
    () => new Set(users.map((u) => u.salesPersonId).filter(Boolean)),
    [users]
  );

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => {
      const edit = edits[u.id];
      const handlowiec = salesPersonLabel(
        salesPeople,
        edit && roleRequiresSalesPerson(edit.role)
          ? edit.salesPersonId || u.salesPersonId
          : null,
        u.salesPersonName
      );
      return (
        u.email.toLowerCase().includes(q) ||
        ROLE_LABELS[u.role].toLowerCase().includes(q) ||
        handlowiec.toLowerCase().includes(q)
      );
    });
  }, [users, search, edits, salesPeople]);

  const updateEdit = (userId: string, patch: Partial<{ role: UserRole; salesPersonId: string }>) => {
    setEdits((prev) => ({
      ...prev,
      [userId]: { ...prev[userId], ...patch },
    }));
  };

  const emailForSalesPerson = (id: string) =>
    salesPeople.find((p) => p.id === id)?.email?.trim() ?? "";

  const applySalesPersonToCreateForm = (salesPersonId: string) => {
    const email = emailForSalesPerson(salesPersonId);
    const linked = users.find((u) => u.salesPersonId === salesPersonId);
    setCreateForm((f) => ({
      ...f,
      salesPersonId,
      email: email || f.email,
    }));
    if (linked) {
      setToast({
        text: `Ten handlowiec ma już konto (${linked.email}).`,
        tone: "error",
      });
    } else if (salesPersonId && !email) {
      setToast({
        text: "Brak e-maila u tego handlowca — uzupełnij go w Admin → Handlowcy.",
        tone: "error",
      });
    }
  };

  const patchUserAfterSave = (
    userId: string,
    role: UserRole,
    salesPersonId: string | null
  ) => {
    setUsers((list) =>
      list.map((u) =>
        u.id === userId
          ? {
              ...u,
              role,
              salesPersonId,
              salesPersonName: salesPersonLabel(
                salesPeople,
                salesPersonId,
                u.salesPersonName
              ),
            }
          : u
      )
    );
  };

  return (
    <>
      {toast ? <Toast message={toast.text} tone={toast.tone} onDismiss={dismiss} /> : null}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Usunąć konto?"
        message={
          deleteTarget
            ? `Czy na pewno usunąć konto ${deleteTarget.email}? Tej operacji nie można cofnąć.`
            : ""
        }
        confirmLabel="Usuń"
        danger
        pending={pending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          start(async () => {
            const r = await actionDeleteAppUser(deleteTarget.id);
            if ("error" in r) {
              setToast({ text: r.error, tone: "error" });
              setDeleteTarget(null);
              return;
            }
            setUsers((list) => list.filter((x) => x.id !== deleteTarget.id));
            setDeleteTarget(null);
            setToast({ text: "Konto usunięte.", tone: "success" });
          });
        }}
      />

      <section className="space-y-6">
        {!createOpen ? (
          <Button variant="outline" onClick={() => setCreateOpen(true)}>
            + Nowe konto
          </Button>
        ) : null}

        {createOpen ? (
          <Card>
            <CardHeader
              title="Nowe konto"
              description="Użytkownik loguje się e-mailem i hasłem. Możesz później wysłać link do zmiany hasła."
            />
            <form
              className="grid gap-4 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                start(async () => {
                  const r = await actionCreateAppUser({
                    email: createForm.email,
                    role: createForm.role,
                    salesPersonId: roleRequiresSalesPerson(createForm.role)
                      ? createForm.salesPersonId || null
                      : null,
                    password: createForm.password,
                  });
                  if ("error" in r) {
                    setToast({ text: r.error, tone: "error" });
                    return;
                  }
                  setToast({ text: "Konto utworzone.", tone: "success" });
                  setCreateForm({
                    email: "",
                    role: "zakupy",
                    salesPersonId: "",
                    password: "",
                  });
                  setCreateOpen(false);
                  router.refresh();
                });
              }}
            >
              <Field label="E-mail (login)">
                <Input
                  type="email"
                  required
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  placeholder={
                    roleRequiresSalesPerson(createForm.role)
                      ? "Uzupełni się po wyborze handlowca"
                      : "osoba@firma.pl"
                  }
                />
                {roleRequiresSalesPerson(createForm.role) &&
                createForm.salesPersonId &&
                createForm.email ? (
                  <p className="mt-1 text-xs text-slate-500">
                    Wzięty z karty handlowca — możesz poprawić przed zapisem.
                  </p>
                ) : null}
              </Field>
              <Field label="Hasło startowe">
                <Input
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  placeholder="Min. 8 znaków — użytkownik może zmienić"
                />
              </Field>
              <Field label="Uprawnienia">
                <Select
                  value={createForm.role}
                  onChange={(e) => {
                    const role = e.target.value as UserRole;
                    setCreateForm((f) => {
                      const next = { ...f, role };
                      if (roleRequiresSalesPerson(role) && f.salesPersonId) {
                        const email = emailForSalesPerson(f.salesPersonId);
                        if (email) next.email = email;
                      }
                      return next;
                    });
                  }}
                >
                  {ROLE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </Field>
              {roleRequiresSalesPerson(createForm.role) ? (
                <Field
                  label={
                    createForm.role === "sales_manager"
                      ? "Karta handlowca kierownika"
                      : "Powiązany handlowiec"
                  }
                >
                  <Select
                    required
                    value={createForm.salesPersonId}
                    onChange={(e) => applySalesPersonToCreateForm(e.target.value)}
                  >
                    <option value="">Wybierz z listy</option>
                    {salesPeople.map((p) => {
                      const taken = linkedSalesPersonIds.has(p.id);
                      return (
                        <option key={p.id} value={p.id} disabled={taken}>
                          {p.name}
                          {p.email ? ` · ${p.email}` : " · brak e-maila"}
                          {taken ? " · ma konto" : ""}
                        </option>
                      );
                    })}
                  </Select>
                </Field>
              ) : (
                <div />
              )}
              <div className="flex flex-wrap gap-2 sm:col-span-2">
                <Button
                  type="submit"
                  disabled={
                    pending ||
                    !createForm.email.trim() ||
                    createForm.password.length < 8 ||
                    (roleRequiresSalesPerson(createForm.role) && !createForm.salesPersonId)
                  }
                >
                  Utwórz konto
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setCreateOpen(false);
                    setCreateForm({
                      email: "",
                      role: "zakupy",
                      salesPersonId: "",
                      password: "",
                    });
                  }}
                >
                  Anuluj
                </Button>
              </div>
            </form>
          </Card>
        ) : null}

        <Card padding={false}>
          <CardHeader
            inset
            title={`Użytkownicy (${users.length})`}
            description="Role i powiązania z handlowcami"
          />
          <div className="border-b border-slate-100 px-4 py-3">
            <Input
              placeholder="Szukaj po e-mailu, roli lub handlowcu…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Szukaj użytkowników"
            />
          </div>
          {!filteredUsers.length ? (
            <EmptyState
              title={users.length ? "Brak wyników" : "Brak kont"}
              description={users.length ? "Zmień frazę wyszukiwania." : undefined}
            />
          ) : (
            <TableScroll>
              <DataTable>
                <thead>
                  <tr>
                    <th>E-mail</th>
                    <th>Rola</th>
                    <th>Handlowiec</th>
                    <th>Grupy (kierownik)</th>
                    <th>Ostatnie logowanie</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((u) => {
                    const edit = edits[u.id];
                    const isSelf = u.id === currentUserId;
                    const salesTakenByOther =
                      edit &&
                      roleRequiresSalesPerson(edit.role) &&
                      edit.salesPersonId &&
                      users.some(
                        (x) =>
                          x.id !== u.id && x.salesPersonId === edit.salesPersonId
                      );
                    return (
                      <tr key={u.id}>
                        <td className="font-medium text-slate-900">
                          {u.email}
                          {isSelf ? (
                            <span className="ml-2 text-xs text-slate-500">(Ty)</span>
                          ) : null}
                        </td>
                        <td>
                          <Select
                            className="min-w-[10rem]"
                            value={edit?.role ?? u.role}
                            onChange={(e) =>
                              updateEdit(u.id, { role: e.target.value as UserRole })
                            }
                          >
                            {ROLE_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </Select>
                        </td>
                        <td>
                          {edit && roleRequiresSalesPerson(edit.role) ? (
                            <>
                              <Select
                                className="min-w-[10rem]"
                                value={edit.salesPersonId}
                                onChange={(e) =>
                                  updateEdit(u.id, { salesPersonId: e.target.value })
                                }
                              >
                                <option value="">—</option>
                                {salesPeople.map((p) => {
                                  const taken =
                                    users.some(
                                      (x) =>
                                        x.id !== u.id && x.salesPersonId === p.id
                                    ) && edit.salesPersonId !== p.id;
                                  return (
                                    <option
                                      key={p.id}
                                      value={p.id}
                                      disabled={taken}
                                    >
                                      {p.name}
                                      {taken ? " · zajęty" : ""}
                                    </option>
                                  );
                                })}
                              </Select>
                              {salesTakenByOther ? (
                                <p className="mt-1 text-xs text-amber-700">
                                  Ten handlowiec ma już inne konto.
                                </p>
                              ) : null}
                            </>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td>
                          {edit?.role === "sales_manager" && salesGroups.length ? (
                            <div className="flex flex-wrap gap-2 max-w-xs">
                              {salesGroups.map((g) => {
                                const checked = (managerGroups[u.id] ?? []).includes(g.id);
                                return (
                                  <label
                                    key={g.id}
                                    className="inline-flex items-center gap-1 text-xs text-slate-700"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() => toggleManagerGroup(u.id, g.id)}
                                    />
                                    {g.name}
                                  </label>
                                );
                              })}
                            </div>
                          ) : edit?.role === "sales_manager" ? (
                            <span className="text-xs text-amber-700">Brak grup w systemie</span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap text-sm text-slate-600 tabular-nums">
                          {u.lastSignInAt
                            ? formatPlDate(u.lastSignInAt.slice(0, 10))
                            : "Nigdy"}
                        </td>
                        <td>
                          <div className="flex flex-wrap justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={pending || !!salesTakenByOther}
                              onClick={() => {
                                start(async () => {
                                  const r = await actionUpdateAppUser({
                                    userId: u.id,
                                    role: edit.role,
                                    salesPersonId: roleRequiresSalesPerson(edit.role)
                                      ? edit.salesPersonId || null
                                      : null,
                                  });
                                  if ("error" in r) {
                                    setToast({ text: r.error, tone: "error" });
                                    return;
                                  }
                                  if (edit.role === "sales_manager") {
                                    const mg = await actionSetSalesManagerGroups(
                                      u.id,
                                      managerGroups[u.id] ?? []
                                    );
                                    if ("error" in mg) {
                                      setToast({ text: mg.error, tone: "error" });
                                      return;
                                    }
                                  } else if (u.role === "sales_manager") {
                                    await actionSetSalesManagerGroups(u.id, []);
                                    setManagerGroups((prev) => {
                                      const next = { ...prev };
                                      delete next[u.id];
                                      return next;
                                    });
                                  }
                                  patchUserAfterSave(
                                    u.id,
                                    edit.role,
                                    roleRequiresSalesPerson(edit.role)
                                      ? edit.salesPersonId || null
                                      : null
                                  );
                                  setToast({ text: "Zapisano uprawnienia.", tone: "success" });
                                });
                              }}
                            >
                              Zapisz
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setPasswordModal({ userId: u.id, email: u.email });
                                setNewPassword("");
                              }}
                            >
                              Hasło
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={pending}
                              onClick={() => {
                                start(async () => {
                                  const r = await actionGeneratePasswordResetLink(u.email);
                                  if ("error" in r) {
                                    setToast({ text: r.error, tone: "error" });
                                    return;
                                  }
                                  try {
                                    await navigator.clipboard.writeText(r.link);
                                    setToast({
                                      text: "Link do ustawienia hasła skopiowany do schowka.",
                                      tone: "success",
                                    });
                                  } catch {
                                    setToast({
                                      text: `Link: ${r.link}`,
                                      tone: "success",
                                    });
                                  }
                                });
                              }}
                            >
                              Link hasła
                            </Button>
                            {!isSelf ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={pending}
                                className="text-rose-600 hover:text-rose-700"
                                onClick={() => setDeleteTarget(u)}
                              >
                                Usuń
                              </Button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </DataTable>
            </TableScroll>
          )}
        </Card>

        <Card>
          <CardHeader title="Opis ról" description="Kto co widzi w systemie" />
          <ul className="space-y-2 text-sm text-slate-600">
            <li>
              <Badge variant="info">{ROLE_LABELS.admin}</Badge> — pełny dostęp, historia,
              ten panel.
            </li>
            <li>
              <Badge variant="info">{ROLE_LABELS.zakupy}</Badge> — panel dzienny, kolejka,
              harmonogramy, bez administracji.
            </li>
            <li>
              <Badge variant="info">{ROLE_LABELS.sales}</Badge> — moje zamówienia, prośby,
              podgląd planu (bez zamawiania towaru).
            </li>
            <li>
              <Badge variant="info">{ROLE_LABELS.sales_manager}</Badge> — jak handlowiec +
              zespół; przypisz grupy (Sklep/Biuro), żeby widział tylko swoich ludzi.
            </li>
          </ul>
        </Card>
      </section>

      {passwordModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">Ustaw hasło</h3>
            <p className="mt-1 text-sm text-slate-500">{passwordModal.email}</p>
            <Field label="Nowe hasło" className="mt-4">
              <Input
                type="password"
                minLength={8}
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </Field>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setPasswordModal(null)}>
                Anuluj
              </Button>
              <Button
                disabled={pending || newPassword.length < 8}
                onClick={() => {
                  start(async () => {
                    const r = await actionSetUserPassword(
                      passwordModal.userId,
                      newPassword
                    );
                    if ("error" in r) {
                      setToast({ text: r.error, tone: "error" });
                      return;
                    }
                    setToast({ text: "Hasło zaktualizowane.", tone: "success" });
                    setPasswordModal(null);
                  });
                }}
              >
                Zapisz hasło
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
