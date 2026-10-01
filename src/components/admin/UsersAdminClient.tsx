"use client";
import { toastFromError, USERS_TOAST, type ToastNotice } from "@/lib/ui/notice-copy";

import Link from "next/link";
import { useMemo, useState, useTransition, useCallback, useEffect, useRef } from "react";
import type { AppUserRow } from "@/lib/data/users";
import type { UserRole, Workspace } from "@/types/database";
import { ROLE_LABELS, ROLE_OPTIONS, roleRequiresSalesPerson } from "@/lib/users/labels";
import { PROCUREMENT_WORKSPACE_OPTIONS } from "@/lib/auth/procurement-workspace";
import {
  actionCreateAppUser,
  actionSaveAppUserPermissions,
  actionSetUserPassword,
  actionGeneratePasswordResetLink,
  actionDeleteAppUser,
} from "@/app/actions/users";
import { actionSetMailCenterModuleEnabledForUser } from "@/app/actions/admin-modules";
import { SetUserPasswordDialog } from "@/components/admin/SetUserPasswordDialog";
import { UsersRoleHelpPanel } from "@/components/admin/UsersRoleHelpPanel";
import { Card, CardHeader } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { NoticeToast } from "@/components/ui/NoticeToast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ModalShell } from "@/components/ui/ModalShell";
import { DataTable, TableScroll } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import { formatPlDate } from "@/lib/display-labels";
import { isPasswordValid } from "@/lib/auth/password-policy";
import { brandLinkClass, roleBadgeClass } from "@/lib/ui/ontime-theme";
import {
  applyUserPermissionSave,
  buildUserEditsFromRows,
  salesPersonIdForSave,
  userRowHasUnsavedChanges,
  usersAdminListSignature,
  usersManagerGroupsSignature,
} from "@/lib/users/users-admin-sync";

type SalesPerson = { id: string; name: string; email: string };
type SalesGroupOption = { id: string; name: string };
type RoleFilter = "all" | UserRole;

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

function roleFilterChipClass(active: boolean): string {
  return cn(
    "rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
    active
      ? "bg-slate-900 text-white"
      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
  );
}

function managerGroupToggleClass(active: boolean): string {
  return cn(
    "rounded-md border px-2 py-0.5 text-[11px] font-medium leading-tight transition-colors",
    active
      ? "border-indigo-200/70 bg-indigo-50/80 text-indigo-700"
      : "border-slate-200/70 bg-slate-50/50 text-slate-500 hover:border-slate-300 hover:bg-slate-100/70"
  );
}

function workspaceSummaryLabel(workspaces: Workspace[]): string {
  if (!workspaces.length) return "Brak grup";
  return `${workspaces.length} ${workspaces.length === 1 ? "grupa" : workspaces.length < 5 ? "grupy" : "grup"}`;
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
  const [users, setUsers] = useState(initialUsers);
  const [pending, start] = useTransition();
  const [toast, setToast] = useState<ToastNotice | null>(null);
  const dismiss = useCallback(() => setToast(null), []);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [createOpen, setCreateOpen] = useState(!!prefillSalesPersonId);
  const [deleteTarget, setDeleteTarget] = useState<AppUserRow | null>(null);

  const [createForm, setCreateForm] = useState({
    email: "",
    role: "zakupy" as UserRole,
    salesPersonId: "",
    password: "",
    assignedWorkspaces: [] as Workspace[],
  });

  const [edits, setEdits] = useState<
    Record<string, { role: UserRole; salesPersonId: string; assignedWorkspaces?: Workspace[] }>
  >(() => buildUserEditsFromRows(initialUsers));

  const [managerGroups, setManagerGroups] =
    useState<Record<string, string[]>>(initialManagerGroups);
  const [committedManagerGroups, setCommittedManagerGroups] =
    useState<Record<string, string[]>>(initialManagerGroups);

  const [passwordModal, setPasswordModal] = useState<{
    userId: string;
    email: string;
  } | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [accessModalUserId, setAccessModalUserId] = useState<string | null>(null);

  // UI: moduły przypisujemy w osobnym modalu, żeby nie rozjeżdżać tabeli wiersz po wierszu.
  const [moduleModalUser, setModuleModalUser] = useState<AppUserRow | null>(null);
  const [moduleDraftMailCenterEnabled, setModuleDraftMailCenterEnabled] =
    useState(false);

  const incomingUsersSignature = useMemo(
    () => usersAdminListSignature(initialUsers),
    [initialUsers]
  );
  const incomingManagerSignature = useMemo(
    () => usersManagerGroupsSignature(initialManagerGroups),
    [initialManagerGroups]
  );
  const usersSignatureRef = useRef(incomingUsersSignature);
  const managerSignatureRef = useRef(incomingManagerSignature);
  const prefillAppliedRef = useRef<string | null>(null);

  useEffect(() => {
    if (usersSignatureRef.current === incomingUsersSignature) return;
    usersSignatureRef.current = incomingUsersSignature;
    setUsers(initialUsers);
    setEdits(buildUserEditsFromRows(initialUsers));
  }, [incomingUsersSignature, initialUsers]);

  useEffect(() => {
    if (managerSignatureRef.current === incomingManagerSignature) return;
    managerSignatureRef.current = incomingManagerSignature;
    setManagerGroups(initialManagerGroups);
    setCommittedManagerGroups(initialManagerGroups);
  }, [incomingManagerSignature, initialManagerGroups]);

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
    if (!prefillSalesPersonId) {
      prefillAppliedRef.current = null;
      return;
    }
    if (prefillAppliedRef.current === prefillSalesPersonId) return;
    prefillAppliedRef.current = prefillSalesPersonId;
    const email = salesPeople.find((p) => p.id === prefillSalesPersonId)?.email?.trim() ?? "";
    setCreateForm({
      email,
      role: "sales",
      salesPersonId: prefillSalesPersonId,
      password: "",
      assignedWorkspaces: [],
    });
    setCreateOpen(true);
  }, [prefillSalesPersonId, salesPeople]);

  const linkedSalesPersonIds = useMemo(
    () => new Set(users.map((u) => u.salesPersonId).filter(Boolean)),
    [users]
  );

  const roleCounts = useMemo(() => {
    const counts: Partial<Record<UserRole, number>> = {};
    for (const u of users) {
      counts[u.role] = (counts[u.role] ?? 0) + 1;
    }
    return counts;
  }, [users]);

  const unsavedCount = useMemo(() => {
    return users.filter((u) => {
      const edit = edits[u.id];
      const savedManagerGroups = committedManagerGroups[u.id] ?? [];
      const draftManagerGroups = managerGroups[u.id] ?? [];
      return userRowHasUnsavedChanges(u, edit, draftManagerGroups, savedManagerGroups);
    }).length;
  }, [users, edits, managerGroups, committedManagerGroups]);

  const filteredUsers = useMemo(() => {
    let list = users;
    if (roleFilter !== "all") {
      list = list.filter((u) => (edits[u.id]?.role ?? u.role) === roleFilter);
    }
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((u) => {
      const edit = edits[u.id];
      const handlowiec = salesPersonLabel(
        salesPeople,
        edit && roleRequiresSalesPerson(edit.role)
          ? edit.salesPersonId || u.salesPersonId
          : null,
        u.salesPersonName
      );
      const roleForSearch = edit?.role ?? u.role;
      return (
        u.email.toLowerCase().includes(q) ||
        ROLE_LABELS[roleForSearch].toLowerCase().includes(q) ||
        handlowiec.toLowerCase().includes(q)
      );
    });
  }, [users, search, roleFilter, edits, salesPeople]);

  const updateEdit = (userId: string, patch: Partial<{ role: UserRole; salesPersonId: string; assignedWorkspaces: Workspace[] }>) => {
    setEdits((prev) => {
      const saved = users.find((u) => u.id === userId);
      const current = prev[userId] ?? {
        role: saved?.role ?? "zakupy",
        salesPersonId: saved?.salesPersonId ?? "",
        assignedWorkspaces: saved?.assignedWorkspaces ?? [],
      };
      const next = { ...current, ...patch };
      if (patch.role && !roleRequiresSalesPerson(patch.role)) {
        next.salesPersonId = "";
      }
      if (patch.role && patch.role !== "zakupy") {
        next.assignedWorkspaces = [];
      }
      return { ...prev, [userId]: next };
    });
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

  const closeCreateForm = () => {
    setCreateOpen(false);
    setCreateForm({
      email: "",
      role: "zakupy",
      salesPersonId: "",
      password: "",
      assignedWorkspaces: [],
    });
  };

  const resetUserDraft = (u: AppUserRow, savedManagerGroups: string[]) => {
    setEdits((prev) => ({
      ...prev,
      [u.id]: {
        role: u.role,
        salesPersonId: u.salesPersonId ?? "",
        assignedWorkspaces: u.assignedWorkspaces ?? [],
      },
    }));
    setManagerGroups((prev) => ({
      ...prev,
      [u.id]: [...savedManagerGroups],
    }));
  };

  const saveUserPermissions = (u: AppUserRow, options?: { closeModal?: boolean }) => {
    const edit = edits[u.id];
    if (!edit) return;
    start(async () => {
      const savedRole = edit.role;
      const savedSalesPersonId = salesPersonIdForSave(savedRole, edit.salesPersonId);
      const groupIds =
        savedRole === "sales_manager" ? (managerGroups[u.id] ?? []) : [];

      const r = await actionSaveAppUserPermissions({
        userId: u.id,
        role: savedRole,
        salesPersonId: savedSalesPersonId,
        managerGroupIds: groupIds,
        assignedWorkspaces: savedRole === "zakupy" ? (edit.assignedWorkspaces ?? []) : [],
      });
      if ("error" in r) {
        setToast(toastFromError(r.error));
        return;
      }

      const spName = salesPersonLabel(
        salesPeople,
        savedSalesPersonId,
        u.salesPersonName
      );
      const nextUsers = applyUserPermissionSave(
        users,
        u.id,
        savedRole,
        savedSalesPersonId,
        spName === "—" ? null : spName,
        edit.assignedWorkspaces
      );
      setUsers(nextUsers);
      usersSignatureRef.current = usersAdminListSignature(nextUsers);

      const nextManagerGroups = { ...managerGroups };
      if (savedRole === "sales_manager") {
        nextManagerGroups[u.id] = groupIds;
      } else {
        delete nextManagerGroups[u.id];
      }
      setManagerGroups(nextManagerGroups);
      setCommittedManagerGroups(nextManagerGroups);
      managerSignatureRef.current = usersManagerGroupsSignature(nextManagerGroups);

      setEdits((prev) => ({
        ...prev,
        [u.id]: {
          role: savedRole,
          salesPersonId: savedSalesPersonId ?? "",
          assignedWorkspaces: savedRole === "zakupy" ? (edit.assignedWorkspaces ?? []) : [],
        },
      }));
      if (options?.closeModal) {
        setAccessModalUserId((current) => (current === u.id ? null : current));
      }
      setToast(USERS_TOAST.savedPermissions);
    });
  };

  const openModuleModalForUser = (u: AppUserRow) => {
    setModuleModalUser(u);
    setModuleDraftMailCenterEnabled(u.mailCenterModuleEnabled);
  };

  const closeModuleModal = () => setModuleModalUser(null);

  const saveUserModulesFromModal = () => {
    if (!moduleModalUser) return;
    const userId = moduleModalUser.id;
    const enabled = moduleDraftMailCenterEnabled;

    start(async () => {
      const r = await actionSetMailCenterModuleEnabledForUser({
        userId,
        enabled,
      });

      if ("error" in r) {
        setToast(toastFromError(r.error));
        return;
      }

      setUsers((prev) =>
        prev.map((x) =>
          x.id === userId ? { ...x, mailCenterModuleEnabled: enabled } : x
        )
      );

      setToast({
        text: enabled
          ? "Włączono odczyt Wysyłek Ivoclar."
          : "Wyłączono odczyt Wysyłek Ivoclar.",
        tone: "success",
      });
      closeModuleModal();
    });
  };

  const accessModalUser =
    accessModalUserId ? users.find((user) => user.id === accessModalUserId) ?? null : null;
  const accessModalEdit = accessModalUser ? edits[accessModalUser.id] : null;
  const accessModalRole = accessModalEdit?.role ?? accessModalUser?.role ?? null;
  const accessModalManagerGroups = accessModalUser
    ? managerGroups[accessModalUser.id] ?? []
    : [];
  const accessModalSavedManagerGroups = accessModalUser
    ? committedManagerGroups[accessModalUser.id] ?? []
    : [];
  const accessModalSalesTaken =
    accessModalUser &&
    accessModalEdit &&
    roleRequiresSalesPerson(accessModalEdit.role) &&
    accessModalEdit.salesPersonId
      ? users.some(
          (user) =>
            user.id !== accessModalUser.id &&
            user.salesPersonId === accessModalEdit.salesPersonId
        )
      : false;
  const accessModalManagerNeedsGroups =
    accessModalEdit?.role === "sales_manager" &&
    salesGroups.length > 0 &&
    accessModalManagerGroups.length === 0;
  const accessModalAssignedWorkspaces =
    accessModalEdit?.assignedWorkspaces ?? accessModalUser?.assignedWorkspaces ?? [];
  const accessModalLinkedSalesPerson =
    accessModalUser && accessModalEdit && roleRequiresSalesPerson(accessModalEdit.role)
      ? salesPersonLabel(
          salesPeople,
          accessModalEdit.salesPersonId || accessModalUser.salesPersonId,
          accessModalUser.salesPersonName
        )
      : "—";
  const accessModalIsDirty =
    accessModalUser && accessModalEdit
      ? userRowHasUnsavedChanges(
          accessModalUser,
          accessModalEdit,
          accessModalManagerGroups,
          accessModalSavedManagerGroups
        )
      : false;

  return (
    <>
      {toast ? <NoticeToast notice={toast} onDismiss={dismiss} /> : null}

      <ModalShell
        open={!!accessModalUser}
        onClose={() => setAccessModalUserId(null)}
        title="Edytuj konto"
        description={accessModalUser?.email}
        titleId="admin-user-access-modal-title"
        size="lg"
        tier="raised"
        disableBackdropClose={pending}
        loadingMessage={pending ? "Zapisywanie zmian…" : null}
        bodyClassName="px-5 py-4 sm:px-6"
        footer={
          accessModalUser ? (
            <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                variant="ghost"
                className="min-h-11 w-full sm:w-auto"
                onClick={() => setAccessModalUserId(null)}
                disabled={pending}
              >
                Zamknij
              </Button>
              <Button
                variant="secondary"
                className="min-h-11 w-full sm:w-auto"
                disabled={pending}
                onClick={() => resetUserDraft(accessModalUser, accessModalSavedManagerGroups)}
              >
                Cofnij zmiany
              </Button>
              <Button
                className="min-h-11 w-full sm:w-auto"
                disabled={pending || !!accessModalSalesTaken || accessModalManagerNeedsGroups}
                onClick={() => saveUserPermissions(accessModalUser, { closeModal: true })}
              >
                Zapisz konto
              </Button>
            </div>
          ) : null
        }
      >
        {accessModalUser && accessModalEdit && accessModalRole ? (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl border border-slate-200/70 bg-slate-50/70 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                  Rola
                </p>
                <div className="mt-2">
                  <span className={roleBadgeClass(accessModalRole)}>
                    {ROLE_LABELS[accessModalRole]}
                  </span>
                    {accessModalIsDirty ? (
                      <Badge
                        variant="warning"
                        className="mt-2 block text-[10px]"
                      >
                        Niezapisane zmiany
                      </Badge>
                    ) : null}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200/70 bg-slate-50/70 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                  Powiązanie
                </p>
                <p className="mt-2 text-sm font-medium text-slate-900">
                  {accessModalLinkedSalesPerson}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200/70 bg-slate-50/70 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                  Moduły
                </p>
                <p className="mt-2 text-sm font-medium text-slate-900">
                  {accessModalUser.mailCenterModuleEnabled ? "1 aktywny" : "Brak aktywnych"}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200/70 bg-slate-50/70 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                  Ostatnie logowanie
                </p>
                <p className="mt-2 text-sm font-medium text-slate-900">
                  {accessModalUser.lastSignInAt
                    ? formatPlDate(accessModalUser.lastSignInAt.slice(0, 10))
                    : "Nigdy"}
                </p>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
              <div className="space-y-4">
                <section className="space-y-4 rounded-xl border border-slate-200/70 bg-white/70 p-4">
                  <div className="space-y-1">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                      Dostęp
                    </p>
                    <p className="text-sm text-slate-600">
                      Określ rolę konta i zakres dostępu w systemie.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {accessModalUser.mailCenterModuleEnabled ? (
                      <Badge variant="success">Wysyłki Ivoclar aktywne</Badge>
                    ) : (
                      <Badge variant="default">Wysyłki Ivoclar wyłączone</Badge>
                    )}
                  </div>

                  <Field label="Rola konta">
                    <Select
                      value={accessModalEdit.role}
                      onChange={(e) =>
                        updateEdit(accessModalUser.id, {
                          role: e.target.value as UserRole,
                        })
                      }
                    >
                      {ROLE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  <Button
                    variant="outline"
                    className="justify-center sm:w-fit"
                    disabled={pending || accessModalRole === "admin"}
                    onClick={() => openModuleModalForUser(accessModalUser)}
                  >
                    Zarządzaj modułami dostępu
                  </Button>
                </section>

                <section className="space-y-4 rounded-xl border border-slate-200/70 bg-white/70 p-4">
                  <div className="space-y-1">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                      Powiązania i przypisania
                    </p>
                    <p className="text-sm text-slate-600">
                      Ustal przypięcia do handlowca oraz grup odpowiednich dla roli.
                    </p>
                  </div>

                  {roleRequiresSalesPerson(accessModalEdit.role) ? (
                    <Field
                      label="Powiązany handlowiec"
                      hint="Jedna osoba handlowa może być przypięta tylko do jednego konta."
                    >
                      <Select
                        value={accessModalEdit.salesPersonId}
                        onChange={(e) =>
                          updateEdit(accessModalUser.id, {
                            salesPersonId: e.target.value,
                          })
                        }
                      >
                        <option value="">—</option>
                        {salesPeople.map((p) => {
                          const taken =
                            users.some(
                              (x) =>
                                x.id !== accessModalUser.id && x.salesPersonId === p.id
                            ) && accessModalEdit.salesPersonId !== p.id;
                          return (
                            <option key={p.id} value={p.id} disabled={taken}>
                              {p.name}
                              {taken ? " · zajęty" : ""}
                            </option>
                          );
                        })}
                      </Select>
                      {accessModalSalesTaken ? (
                        <p className="mt-2 text-xs text-amber-700">
                          Ten handlowiec ma już inne konto.
                        </p>
                      ) : null}
                    </Field>
                  ) : null}

                  {accessModalRole === "zakupy" ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-slate-900">Grupy zakupowe</p>
                        <Badge variant="default">
                          {workspaceSummaryLabel(accessModalAssignedWorkspaces)}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {PROCUREMENT_WORKSPACE_OPTIONS.map((opt) => {
                          const checked = accessModalAssignedWorkspaces.includes(opt.value);
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => {
                                const current = accessModalAssignedWorkspaces;
                                const next = checked
                                  ? current.filter((w) => w !== opt.value)
                                  : [...current, opt.value];
                                updateEdit(accessModalUser.id, {
                                  assignedWorkspaces: next as Workspace[],
                                });
                              }}
                              className={managerGroupToggleClass(checked)}
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  {accessModalRole === "sales_manager" ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-slate-900">Grupy kierownika</p>
                        <Badge variant="default">
                          {accessModalManagerGroups.length
                            ? `${accessModalManagerGroups.length} aktywne`
                            : "Brak przypisań"}
                        </Badge>
                      </div>
                      {salesGroups.length ? (
                        <div className="flex flex-wrap gap-1">
                          {salesGroups.map((g) => {
                            const checked = accessModalManagerGroups.includes(g.id);
                            return (
                              <button
                                key={g.id}
                                type="button"
                                onClick={() => toggleManagerGroup(accessModalUser.id, g.id)}
                                className={managerGroupToggleClass(checked)}
                              >
                                {g.name}
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <span className="text-xs text-amber-700">Brak grup w systemie</span>
                      )}
                      {accessModalManagerNeedsGroups ? (
                        <p className="text-xs text-amber-700">
                          Wybierz co najmniej jedną grupę.
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </section>
              </div>

              <div className="space-y-4 rounded-xl border border-slate-200/70 bg-slate-50/70 p-4">
                <div>
                  <p className="text-sm font-medium text-slate-900">Operacje na koncie</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500">
                    Szybkie działania pomocnicze bez zmiany danych logowania i roli.
                  </p>
                </div>

                <div className="grid gap-2">
                  <Button
                    variant="outline"
                    className="justify-center"
                    onClick={() => {
                      setPasswordModal({
                        userId: accessModalUser.id,
                        email: accessModalUser.email,
                      });
                      setNewPassword("");
                    }}
                  >
                    Ustaw hasło
                  </Button>
                  <Button
                    variant="secondary"
                    className="justify-center"
                    disabled={pending}
                    onClick={() => {
                      start(async () => {
                        const r = await actionGeneratePasswordResetLink(
                          accessModalUser.email
                        );
                        if ("error" in r) {
                          setToast(toastFromError(r.error));
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
                    Kopiuj link hasła
                  </Button>
                  <Button
                    variant="outline"
                    className="justify-center"
                    disabled={pending || accessModalRole === "admin"}
                    onClick={() => openModuleModalForUser(accessModalUser)}
                  >
                    Zarządzaj modułami
                  </Button>
                  {accessModalUser.id !== currentUserId ? (
                    <Button
                      variant="secondary"
                      className="justify-center text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                      disabled={pending}
                      onClick={() => setDeleteTarget(accessModalUser)}
                    >
                      Usuń konto
                    </Button>
                  ) : null}
                </div>

                <div className="rounded-lg border border-slate-200/70 bg-white/80 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                    Stan konta
                  </p>
                  <div className="mt-2 space-y-2 text-sm text-slate-700">
                    <div className="flex items-center justify-between gap-3">
                      <span>E-mail</span>
                      <span className="break-all text-right font-medium text-slate-900">
                        {accessModalUser.email}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>Powiązany handlowiec</span>
                      <span className="font-medium text-slate-900">
                        {accessModalLinkedSalesPerson}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>Wysyłki Ivoclar</span>
                      <Badge
                        variant={
                          accessModalUser.mailCenterModuleEnabled
                            ? "success"
                            : "default"
                        }
                        className="whitespace-nowrap"
                      >
                        {accessModalUser.mailCenterModuleEnabled
                          ? "Aktywne"
                          : "Wyłączone"}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>Grupy zakupowe</span>
                      <span className="font-medium text-slate-900">
                        {accessModalRole === "zakupy"
                          ? workspaceSummaryLabel(accessModalAssignedWorkspaces)
                          : "—"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>Grupy kierownika</span>
                      <span className="font-medium text-slate-900">
                        {accessModalRole === "sales_manager"
                          ? `${accessModalManagerGroups.length}`
                          : "—"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </ModalShell>

      <ModalShell
        open={!!moduleModalUser}
        onClose={closeModuleModal}
        title="Moduły dostępu"
        description={moduleModalUser?.email}
        titleId="admin-modules-modal-title"
        size="sm"
        tier="raised"
        disableBackdropClose={pending}
        loadingMessage={pending ? "Zapisywanie modułów…" : null}
        bodyClassName="px-5 py-4 sm:px-6"
        footer={
          <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="ghost"
              className="min-h-11 w-full sm:w-auto"
              onClick={closeModuleModal}
              disabled={pending}
            >
              Anuluj
            </Button>
            <Button
              className="min-h-11 w-full sm:w-auto"
              onClick={saveUserModulesFromModal}
              disabled={
                pending ||
                !moduleModalUser ||
                moduleModalUser.mailCenterModuleEnabled ===
                  moduleDraftMailCenterEnabled
              }
            >
              Zapisz
            </Button>
          </div>
        }
      >
        {moduleModalUser ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-slate-200/70 bg-white/60 p-3">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900">
                    Wysyłki Ivoclar (odczyt)
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500">
                    Dostęp do `/admin/mail` w trybie odczytu (status i logi). Wysyłkę prowadzi OnTime
                    Raporty — w OnTime nie ma już akcji generate/send ani edycji odbiorców.
                  </p>
                </div>

                <label className="flex items-center gap-2 pt-0.5">
                  <input
                    type="checkbox"
                    checked={moduleDraftMailCenterEnabled}
                    disabled={pending || moduleModalUser.role === "admin"}
                    onChange={(e) => setModuleDraftMailCenterEnabled(e.target.checked)}
                    className="h-4 w-4 accent-indigo-600"
                    aria-label="Wysyłki Ivoclar — włączone/wyłączone"
                  />
                  <span className="text-xs text-slate-700">Włączone</span>
                </label>
              </div>
            </div>

            <p className="text-[11px] leading-snug text-slate-500">
              Panel jest przygotowany do dodania kolejnych modułów: wystarczy dopiąć kolejne sekcje “toggle” w tym miejscu
              i podłączyć osobne server actions.
            </p>
          </div>
        ) : null}
      </ModalShell>

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
              setToast(toastFromError(r.error));
              setDeleteTarget(null);
              return;
            }
            const nextUsers = users.filter((x) => x.id !== deleteTarget.id);
            setUsers(nextUsers);
            usersSignatureRef.current = usersAdminListSignature(nextUsers);
            setEdits((prev) => {
              const next = { ...prev };
              delete next[deleteTarget.id];
              return next;
            });
            setDeleteTarget(null);
            setToast(USERS_TOAST.deletedAccount);
          });
        }}
      />

      <SetUserPasswordDialog
        open={!!passwordModal}
        email={passwordModal?.email ?? ""}
        pending={pending}
        password={newPassword}
        onPasswordChange={setNewPassword}
        onClose={() => setPasswordModal(null)}
        onSave={() => {
          if (!passwordModal) return;
          start(async () => {
            const r = await actionSetUserPassword(passwordModal.userId, newPassword);
            if ("error" in r) {
              setToast(toastFromError(r.error));
              return;
            }
            setToast(USERS_TOAST.updatedPassword);
            setPasswordModal(null);
          });
        }}
      />

      <section className="space-y-4">
        {createOpen ? (
          <Card padding={false} className="overflow-hidden">
            <CardHeader
              inset
              density="compact"
              title="Nowe konto"
              description="Użytkownik loguje się e-mailem i hasłem. Możesz później wysłać link do zmiany hasła."
            />
            <form
              className="grid gap-4 px-3 pb-4 sm:grid-cols-2 sm:px-4 lg:px-5"
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
                    assignedWorkspaces: createForm.role === "zakupy" ? (createForm.assignedWorkspaces ?? []) : [],
                  });
                  if ("error" in r) {
                    setToast(toastFromError(r.error));
                    return;
                  }
                  const nextUsers = [...users, r.user];
                  setUsers(nextUsers);
                  usersSignatureRef.current = usersAdminListSignature(nextUsers);
                  setEdits((prev) => ({
                    ...prev,
                    [r.user.id]: {
                      role: r.user.role,
                      salesPersonId: r.user.salesPersonId ?? "",
                      assignedWorkspaces: r.user.assignedWorkspaces ?? [],
                    },
                  }));
                  setToast(USERS_TOAST.createdAccount);
                  closeCreateForm();
                  prefillAppliedRef.current = null;
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
              <Field
                label="Hasło startowe"
                hint="Min. 8 znaków, litera i cyfra — użytkownik może zmienić po zalogowaniu."
              >
                <Input
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                />
              </Field>
              <Field label="Uprawnienia">
                <Select
                  value={createForm.role}
                  onChange={(e) => {
                    const role = e.target.value as UserRole;
                    setCreateForm((f) => {
                      const next = { ...f, role };
                      if (!roleRequiresSalesPerson(role)) {
                        next.salesPersonId = "";
                      } else if (f.salesPersonId) {
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
                {createForm.role === "zakupy" ? (
                  <div className="mt-2">
                    <p className="mb-1.5 text-xs font-medium text-slate-600">Obszary pracy</p>
                    <div className="flex flex-wrap gap-1.5">
                      {PROCUREMENT_WORKSPACE_OPTIONS.map((opt) => {
                        const checked = createForm.assignedWorkspaces.includes(opt.value);
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => {
                              setCreateForm((f) => ({
                                ...f,
                                assignedWorkspaces: checked
                                  ? f.assignedWorkspaces.filter((w) => w !== opt.value)
                                  : [...f.assignedWorkspaces, opt.value],
                              }));
                            }}
                            className={managerGroupToggleClass(checked)}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
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
              <div className="space-y-3 sm:col-span-2">
                <p className="text-xs leading-relaxed text-slate-500">
                  Handlowiec musi mieć kartę w{" "}
                  <Link href="/admin/handlowcy" className={brandLinkClass}>
                    zakładce Handlowcy
                  </Link>
                  . Zaproszenia z hasłem jednorazowym generujesz stamtąd.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="submit"
                    disabled={
                      pending ||
                      !createForm.email.trim() ||
                      !isPasswordValid(createForm.password) ||
                      (roleRequiresSalesPerson(createForm.role) && !createForm.salesPersonId)
                    }
                  >
                    Utwórz konto
                  </Button>
                  <Button type="button" variant="secondary" onClick={closeCreateForm}>
                    Anuluj
                  </Button>
                </div>
              </div>
            </form>
          </Card>
        ) : null}

        <Card padding={false} className="overflow-hidden">
          <CardHeader
            inset
            density="compact"
            title={`Użytkownicy (${users.length})`}
            description="Lista pokazuje podsumowanie kont i szybkie akcje. Pełną edycję roli, grup i powiązań otwierasz z przycisku Edytuj."
            action={
              <div className="flex flex-wrap items-center justify-end gap-2">
                {unsavedCount > 0 ? (
                  <Badge variant="warning">{unsavedCount} do zapisu</Badge>
                ) : null}
                {!createOpen ? (
                  <Button variant="outline" size="sm" onClick={() => setCreateOpen(true)}>
                    + Nowe konto
                  </Button>
                ) : null}
              </div>
            }
          />

          <div className="space-y-3 border-b border-slate-100 px-3 py-3 sm:px-4 lg:px-5">
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setRoleFilter("all")}
                className={roleFilterChipClass(roleFilter === "all")}
              >
                Wszyscy ({users.length})
              </button>
              {ROLE_OPTIONS.map((o) => {
                const count = roleCounts[o.value] ?? 0;
                if (!count) return null;
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => setRoleFilter(o.value)}
                    className={roleFilterChipClass(roleFilter === o.value)}
                  >
                    {o.label} ({count})
                  </button>
                );
              })}
            </div>
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
              description={
                users.length
                  ? "Zmień filtr roli lub frazę wyszukiwania."
                  : "Utwórz pierwsze konto logowania albo wygeneruj zaproszenie z zakładki Handlowcy."
              }
            />
          ) : (
            <TableScroll>
              <DataTable className="min-w-[1180px]">
                <colgroup>
                  <col className="w-[23%]" />
                  <col className="w-[26%]" />
                  <col className="w-[18%]" />
                  <col className="w-[18%]" />
                  <col className="w-[9%]" />
                  <col className="w-[180px]" />
                </colgroup>
                <thead>
                  <tr>
                    <th>E-mail</th>
                    <th>Uprawnienia</th>
                    <th>Handlowiec</th>
                    <th>Grupy (kierownik)</th>
                    <th>Ostatnie logowanie</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((u) => {
                    const edit = edits[u.id];
                    const savedManagerGroups = committedManagerGroups[u.id] ?? [];
                    const draftManagerGroups = managerGroups[u.id] ?? [];
                    const isDirty = userRowHasUnsavedChanges(
                      u,
                      edit,
                      draftManagerGroups,
                      savedManagerGroups
                    );
                    const isSelf = u.id === currentUserId;
                    const displayRole = edit?.role ?? u.role;
                    const assignedWorkspaces =
                      edit?.assignedWorkspaces ?? u.assignedWorkspaces ?? [];
                    const linkedSalesPersonName =
                      roleRequiresSalesPerson(displayRole)
                        ? salesPersonLabel(
                            salesPeople,
                            edit?.salesPersonId || u.salesPersonId,
                            u.salesPersonName
                          )
                        : "—";
                    return (
                      <tr
                        key={u.id}
                        className={isDirty ? "bg-amber-50/60" : undefined}
                      >
                        <td className="align-top">
                          <div className="space-y-1">
                            <div className="break-all font-medium text-slate-900">
                              {u.email}
                              {isSelf ? (
                                <span className="ml-2 text-xs font-normal text-slate-500">
                                  (Ty)
                                </span>
                              ) : null}
                            </div>
                            {isDirty ? (
                              <Badge variant="warning" className="text-[10px]">
                                Niezapisane zmiany
                              </Badge>
                            ) : null}
                          </div>
                        </td>
                        <td className="align-top">
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={roleBadgeClass(displayRole)}>
                                {ROLE_LABELS[displayRole]}
                              </span>
                              <Badge
                                variant={
                                  u.mailCenterModuleEnabled ? "success" : "default"
                                }
                                className="whitespace-nowrap"
                              >
                                Wysyłki Ivoclar:{" "}
                                {u.mailCenterModuleEnabled ? "Aktywne" : "Wyłączone"}
                              </Badge>
                            </div>
                            <p className="text-xs leading-relaxed text-slate-500">
                              {isDirty
                                ? "Masz lokalne zmiany w uprawnieniach tego konta."
                                : "Rola i dostęp są zapisane zgodnie z aktualnym stanem konta."}
                            </p>
                          </div>
                        </td>
                        <td className="align-top">
                          <span className={linkedSalesPersonName === "—" ? "text-slate-400" : "text-slate-700"}>
                            {linkedSalesPersonName}
                          </span>
                        </td>
                        <td className="align-top">
                          {displayRole === "sales_manager" && salesGroups.length ? (
                            <div className="space-y-2">
                              <p className="text-xs font-medium text-slate-600">
                                Grupy kierownika
                              </p>
                              <div className="flex flex-wrap gap-1">
                                {salesGroups
                                  .filter((g) => draftManagerGroups.includes(g.id))
                                  .map((g) => (
                                    <span
                                      key={g.id}
                                      className="rounded-full border border-indigo-200/70 bg-indigo-50/60 px-2 py-0.5 text-[11px] font-medium text-indigo-700"
                                    >
                                      {g.name}
                                    </span>
                                  ))}
                              </div>
                            </div>
                          ) : displayRole === "zakupy" ? (
                            <div className="space-y-2">
                              <p className="text-xs font-medium text-slate-600">
                                Grupy zakupowe
                              </p>
                              {(edit?.assignedWorkspaces ?? u.assignedWorkspaces ?? []).length ? (
                                <div className="space-y-2">
                                  <Badge variant="default">
                                    {workspaceSummaryLabel(assignedWorkspaces)}
                                  </Badge>
                                  <div className="flex flex-wrap gap-1">
                                    {assignedWorkspaces.map((workspace) => {
                                      const option = PROCUREMENT_WORKSPACE_OPTIONS.find(
                                        (item) => item.value === workspace
                                      );
                                      return (
                                        <span
                                          key={workspace}
                                          className="rounded-full border border-indigo-200/70 bg-indigo-50/60 px-2 py-0.5 text-[11px] font-medium text-indigo-700"
                                        >
                                          {option?.label ?? workspace}
                                        </span>
                                      );
                                    })}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-slate-400">Brak przypisań</span>
                              )}
                            </div>
                          ) : displayRole === "sales_manager" ? (
                            <span className="text-xs text-amber-700">Brak grup w systemie</span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="align-top whitespace-nowrap text-sm text-slate-600 tabular-nums">
                          {u.lastSignInAt
                            ? formatPlDate(u.lastSignInAt.slice(0, 10))
                            : (
                              <span className="text-slate-400">Nigdy</span>
                            )}
                        </td>
                        <td className="align-top">
                          <div className="flex min-w-[156px] flex-col items-stretch gap-2">
                            <div className="grid grid-cols-1 gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="justify-center"
                                onClick={() => setAccessModalUserId(u.id)}
                              >
                                Edytuj
                              </Button>
                              {isDirty ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="justify-center"
                                  disabled={pending}
                                  onClick={() => resetUserDraft(u, savedManagerGroups)}
                                >
                                  Cofnij
                                </Button>
                              ) : null}
                              <Button
                                variant="secondary"
                                size="sm"
                                className="justify-center"
                                disabled={pending || displayRole === "admin"}
                                onClick={() => openModuleModalForUser(u)}
                              >
                                Moduły
                              </Button>
                              {!isSelf ? (
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  disabled={pending}
                                  className="justify-center text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                                  onClick={() => setDeleteTarget(u)}
                                >
                                  Usuń
                                </Button>
                              ) : null}
                            </div>
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

        <UsersRoleHelpPanel />
      </section>
    </>
  );
}
