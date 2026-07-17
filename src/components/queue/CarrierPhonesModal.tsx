"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { WarehouseCarrierRow } from "@/lib/data/warehouse-carriers";
import type { CarrierPhoneRow } from "@/lib/data/carrier-phones";
import {
  actionFetchCarrierPhones,
  actionCreateCarrierPhone,
  actionUpdateCarrierPhone,
  actionDeleteCarrierPhone,
} from "@/app/actions/carrier-phones";
import { ModalShell } from "@/components/ui/ModalShell";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { NoticeToast } from "@/components/ui/NoticeToast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  IconPhone,
  IconTrash2,
  IconChevronDown,
  IconChevronRight,
  IconPlusCircle,
} from "@/components/icons/StrokeIcons";
import { toastFromError, type ToastNotice } from "@/lib/ui/notice-copy";
import { panelTypography } from "@/lib/ui/ontime-theme";
import { cn } from "@/lib/cn";

type PhoneFormState = {
  label: string;
  phone: string;
};

const emptyForm = (): PhoneFormState => ({ label: "", phone: "" });

export function CarrierPhonesModal({
  open,
  onClose,
  carriers,
}: {
  open: boolean;
  onClose: () => void;
  carriers: WarehouseCarrierRow[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [toast, setToast] = useState<ToastNotice | null>(null);
  const dismiss = useCallback(() => setToast(null), []);
  const [phones, setPhones] = useState<CarrierPhoneRow[]>([]);
  const [expandedSlugs, setExpandedSlugs] = useState<Set<string>>(new Set());
  const [formsBySlug, setFormsBySlug] = useState<Record<string, PhoneFormState>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<PhoneFormState>(emptyForm());
  const [deleteTarget, setDeleteTarget] = useState<CarrierPhoneRow | null>(null);
  const [search, setSearch] = useState("");

  const loadPhones = useCallback(() => {
    start(async () => {
      try {
        const data = await actionFetchCarrierPhones();
        setPhones(data);
        const slugs = new Set(data.map((p) => p.carrierSlug));
        setExpandedSlugs((prev) => {
          const next = new Set(prev);
          for (const slug of slugs) next.add(slug);
          return next;
        });
      } catch (e) {
        setToast(toastFromError(e instanceof Error ? e.message : "Błąd ładowania numerów"));
      }
    });
  }, []);

  useEffect(() => {
    if (open) loadPhones();
  }, [open, loadPhones]);

  const phonesBySlug = useMemo(() => {
    const map = new Map<string, CarrierPhoneRow[]>();
    for (const p of phones) {
      const list = map.get(p.carrierSlug) ?? [];
      list.push(p);
      map.set(p.carrierSlug, list);
    }
    return map;
  }, [phones]);

  const filteredCarriers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return carriers;
    return carriers.filter(
      (c) =>
        c.label.toLowerCase().includes(q) ||
        (phonesBySlug.get(c.slug) ?? []).some((p) => p.phone.includes(q) || p.label.toLowerCase().includes(q)),
    );
  }, [carriers, phonesBySlug, search]);

  const toggleExpand = (slug: string) => {
    setExpandedSlugs((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };

  const getForm = (slug: string): PhoneFormState => formsBySlug[slug] ?? emptyForm();

  const setFormForSlug = (slug: string, patch: Partial<PhoneFormState>) => {
    setFormsBySlug((prev) => ({
      ...prev,
      [slug]: { ...getForm(slug), ...patch },
    }));
  };

  const addPhone = (slug: string) => {
    const form = getForm(slug);
    if (!form.phone.trim()) return;
    start(async () => {
      const result = await actionCreateCarrierPhone({
        carrierSlug: slug,
        label: form.label,
        phone: form.phone,
      });
      if ("error" in result) {
        setToast(toastFromError(result.error));
        return;
      }
      setFormForSlug(slug, { label: "", phone: "" });
      setToast({ text: "Dodano numer telefonu.", tone: "success" });
      loadPhones();
      router.refresh();
    });
  };

  const startEdit = (phone: CarrierPhoneRow) => {
    setEditingId(phone.id);
    setEditForm({ label: phone.label, phone: phone.phone });
  };

  const saveEdit = () => {
    if (!editingId) return;
    start(async () => {
      const result = await actionUpdateCarrierPhone({
        id: editingId,
        label: editForm.label,
        phone: editForm.phone,
      });
      if ("error" in result) {
        setToast(toastFromError(result.error));
        return;
      }
      setEditingId(null);
      setEditForm(emptyForm());
      setToast({ text: "Zapisano numer telefonu.", tone: "success" });
      loadPhones();
      router.refresh();
    });
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    start(async () => {
      const result = await actionDeleteCarrierPhone(deleteTarget.id);
      if ("error" in result) {
        setToast(toastFromError(result.error));
        setDeleteTarget(null);
        return;
      }
      setDeleteTarget(null);
      setToast({ text: "Usunięto numer telefonu.", tone: "success" });
      loadPhones();
      router.refresh();
    });
  };

  const totalPhones = phones.length;

  return (
    <>
      {toast ? <NoticeToast notice={toast} onDismiss={dismiss} /> : null}
      <ConfirmDialog
        open={!!deleteTarget}
        tier="stack"
        title="Usunąć numer?"
        message="Numer telefonu zostanie trwale usunięty z listy."
        confirmLabel="Usuń"
        danger
        pending={pending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
      <ModalShell
        open={open}
        onClose={onClose}
        title="Telefony kurierów"
        description="Numery telefonów przypisane do kurierów — szybki dostęp z dziennika dostaw."
        size="lg"
        loadingMessage={pending ? "Zapisywanie…" : null}
        footer={
          <Button type="button" variant="secondary" onClick={onClose}>
            Zamknij
          </Button>
        }
      >
        <div className="space-y-3 px-5 py-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className={cn(panelTypography.caption, "text-slate-500")}>
              {totalPhones} {totalPhones === 1 ? "numer" : totalPhones >= 2 && totalPhones <= 4 ? "numery" : "numerów"} · {carriers.length} kurierów
            </p>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Szukaj kuriera lub numeru…"
              className="h-8 max-w-[14rem] text-[12px]"
            />
          </div>

          {filteredCarriers.length === 0 ? (
            <EmptyState
              title="Brak kurierów"
              description={search ? "Brak wyników dla tej frazy." : "Dodaj kurierów w zarządzaniu listą kurierów."}
            />
          ) : (
            <div className="max-h-[28rem] space-y-1.5 overflow-y-auto pr-1">
              {filteredCarriers.map((carrier) => {
                const isExpanded = expandedSlugs.has(carrier.slug);
                const carrierPhones = phonesBySlug.get(carrier.slug) ?? [];
                const form = getForm(carrier.slug);

                return (
                  <div
                    key={carrier.slug}
                    className={cn(
                      "rounded-xl border transition-colors",
                      isExpanded
                        ? "border-slate-300 bg-white shadow-sm"
                        : "border-slate-200 bg-white hover:border-slate-300",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => toggleExpand(carrier.slug)}
                      className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                        {isExpanded ? (
                          <IconChevronDown size={16} aria-hidden />
                        ) : (
                          <IconChevronRight size={16} aria-hidden />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-semibold text-slate-800">
                          {carrier.label}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {carrierPhones.length === 0
                            ? "Brak numerów"
                            : `${carrierPhones.length} ${carrierPhones.length === 1 ? "numer" : carrierPhones.length >= 2 && carrierPhones.length <= 4 ? "numery" : "numerów"}`}
                        </p>
                      </div>
                      {!carrier.isActive ? (
                        <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-400">
                          Ukryty
                        </span>
                      ) : null}
                    </button>

                    {isExpanded ? (
                      <div className="space-y-2 border-t border-slate-100 px-3.5 py-3">
                        {carrierPhones.length > 0 ? (
                          <ul className="space-y-1.5">
                            {carrierPhones.map((phone) => {
                              const isEditing = editingId === phone.id;
                              return (
                                <li key={phone.id}>
                                  {isEditing ? (
                                    <div className="flex flex-wrap items-end gap-2 rounded-lg bg-slate-50 p-2.5">
                                      <Field label="Etykieta" className="min-w-[8rem] flex-1">
                                        <Input
                                          value={editForm.label}
                                          onChange={(e) => setEditForm((f) => ({ ...f, label: e.target.value }))}
                                          placeholder="np. biuro, kierowca…"
                                          className="h-8 text-[12px]"
                                          autoFocus
                                        />
                                      </Field>
                                      <Field label="Telefon" className="min-w-[10rem] flex-1">
                                        <Input
                                          value={editForm.phone}
                                          onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                                          className="h-8 text-[12px]"
                                        />
                                      </Field>
                                      <div className="flex gap-1.5 pb-0.5">
                                        <Button
                                          type="button"
                                          size="sm"
                                          onClick={saveEdit}
                                          disabled={pending || !editForm.phone.trim()}
                                        >
                                          Zapisz
                                        </Button>
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="secondary"
                                          onClick={() => setEditingId(null)}
                                        >
                                          Anuluj
                                        </Button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="group flex items-center gap-2.5 rounded-lg px-2.5 py-2 hover:bg-slate-50">
                                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-600">
                                        <IconPhone size={14} aria-hidden />
                                      </span>
                                      <div className="min-w-0 flex-1">
                                        <p className="text-[13px] font-medium text-slate-800">
                                          {phone.phone}
                                        </p>
                                        {phone.label ? (
                                          <p className="text-[11px] text-slate-400">{phone.label}</p>
                                        ) : null}
                                      </div>
                                      <a
                                        href={`tel:${phone.phone.replace(/\s+/g, "")}`}
                                        className="shrink-0 rounded-md px-2 py-1 text-[11px] font-medium text-indigo-600 hover:bg-indigo-50"
                                      >
                                        Zadzwoń
                                      </a>
                                      <div className="flex shrink-0 gap-1 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100">
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="secondary"
                                          onClick={() => startEdit(phone)}
                                          disabled={pending}
                                        >
                                          Edytuj
                                        </Button>
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="ghost"
                                          className="text-rose-700 hover:bg-rose-50"
                                          onClick={() => setDeleteTarget(phone)}
                                          disabled={pending}
                                        >
                                          <IconTrash2 size={14} aria-hidden />
                                        </Button>
                                      </div>
                                    </div>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        ) : (
                          <p className="px-2.5 py-1.5 text-[11px] text-slate-400">
                            Brak zapisanych numerów dla tego kuriera.
                          </p>
                        )}

                        <div className="flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-slate-200 bg-slate-50/50 p-2.5">
                          <Field label="Etykieta (opcjonalna)" className="min-w-[8rem] flex-1">
                            <Input
                              value={form.label}
                              onChange={(e) => setFormForSlug(carrier.slug, { label: e.target.value })}
                              placeholder="np. biuro, kierowca…"
                              className="h-8 text-[12px]"
                            />
                          </Field>
                          <Field label="Numer telefonu" className="min-w-[10rem] flex-1">
                            <Input
                              value={form.phone}
                              onChange={(e) => setFormForSlug(carrier.slug, { phone: e.target.value })}
                              placeholder="np. 500 123 456"
                              className="h-8 text-[12px]"
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && form.phone.trim()) {
                                  e.preventDefault();
                                  addPhone(carrier.slug);
                                }
                              }}
                            />
                          </Field>
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => addPhone(carrier.slug)}
                            disabled={pending || !form.phone.trim()}
                          >
                            <IconPlusCircle size={15} className="mr-1" aria-hidden />
                            Dodaj
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </ModalShell>
    </>
  );
}
