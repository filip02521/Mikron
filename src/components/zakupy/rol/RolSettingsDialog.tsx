"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { actionSaveRolProgram } from "@/app/actions/rol";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Field";
import { FormNoticeMessage } from "@/components/ui/FormNoticeMessage";
import { ModalShell } from "@/components/ui/ModalShell";
import type { RolProgram } from "@/lib/rol/data";
import type { RolProgramInput } from "@/lib/rol/program";
import { formError, formSuccess } from "@/lib/ui/notice-copy";

const NEW = "__new__";

function toInput(p: RolProgram | null): RolProgramInput {
  return {
    id: p?.id ?? null,
    label: p?.label ?? "",
    fileLabel: p && p.fileLabel !== p.label ? p.fileLabel : "",
    khIds: p?.khIds.join(", ") ?? "",
    discountPct: String(p?.discountPct ?? 25),
    addressLines: p?.addressLines.join("\n") ?? "",
    nip: p?.nip ?? "",
    toEmails: p?.toEmails.join(", ") ?? "",
    ccEmails: p?.ccEmails.join(", ") ?? "",
    activeFrom: p?.activeFrom ?? "",
    activeTo: p?.activeTo ?? "",
  };
}

/** Klienci ROL: kartoteki w Subiekcie, blok do maila, adresaci. Dane tylko w bazie. */
export function RolSettingsDialog({
  open,
  onClose,
  programs,
}: {
  open: boolean;
  onClose: () => void;
  programs: RolProgram[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string>(programs[0]?.id ?? NEW);
  const [form, setForm] = useState<RolProgramInput>(() => toInput(programs[0] ?? null));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, startSave] = useTransition();

  const pick = (id: string) => {
    setSelected(id);
    setForm(toInput(programs.find((p) => p.id === id) ?? null));
    setError(null);
    setSaved(false);
  };
  const set = (key: keyof RolProgramInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setSaved(false);
  };

  const save = () =>
    startSave(async () => {
      setError(null);
      const res = await actionSaveRolProgram(form);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSelected(res.id);
      setForm((f) => ({ ...f, id: res.id }));
      setSaved(true);
      router.refresh();
    });

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Ustawienia ROL"
      description="Klienci z dodatkowym rabatem Ivoclar. Na początku miesiąca OnTime szuka ich FS po kartotekach z Subiekta."
      size="lg"
      bodyClassName="px-5 py-4 sm:px-6"
      footer={
        <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
          <Button variant="secondary" onClick={onClose}>
            Zamknij
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Zapisuję…" : form.id ? `Zapisz ROL ${form.label || "klienta"}` : "Dodaj klienta ROL"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label="Klient">
          <Select value={selected} onChange={(e) => pick(e.target.value)}>
            {programs.map((p) => (
              <option key={p.id} value={p.id}>
                ROL {p.label}
              </option>
            ))}
            <option value={NEW}>+ Nowy klient ROL</option>
          </Select>
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Nazwa w mailu i opisie ZD" hint="Bez „ROL”, np. „Przykładowa”.">
            <Input value={form.label} onChange={set("label")} maxLength={120} />
          </Field>
          <Field label="Nazwa w plikach" hint="Puste = jak w mailu.">
            <Input value={form.fileLabel} onChange={set("fileLabel")} maxLength={80} />
          </Field>
          <Field label="Kartoteki w Subiekcie (kh_Id)" hint="Kilka oddziel przecinkiem.">
            <Input value={form.khIds} onChange={set("khIds")} inputMode="numeric" />
          </Field>
          <Field label="Rabat ROL (%)">
            <Input value={form.discountPct} onChange={set("discountPct")} inputMode="decimal" />
          </Field>
        </div>
        <Field label="Adres do maila" hint="Jedna linia na wiersz, maks. 4.">
          <textarea
            value={form.addressLines}
            onChange={set("addressLines")}
            rows={2}
            className="w-full rounded-md border border-slate-200 bg-card px-3 py-2 text-base shadow-[var(--shadow-control)] focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none sm:text-sm"
          />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="NIP klienta">
            <Input value={form.nip} onChange={set("nip")} />
          </Field>
          <div />
          <Field label="Do" hint="Skrzynka zamówień Ivoclar i opiekun klienta.">
            <Input value={form.toEmails} onChange={set("toEmails")} type="text" />
          </Field>
          <Field label="DW">
            <Input value={form.ccEmails} onChange={set("ccEmails")} type="text" />
          </Field>
          <Field label="Status ROL od">
            <Input value={form.activeFrom} onChange={set("activeFrom")} type="date" />
          </Field>
          <Field label="Status ROL do" hint="Puste = bez końca.">
            <Input value={form.activeTo} onChange={set("activeTo")} type="date" />
          </Field>
        </div>
        {error ? <FormNoticeMessage message={formError("Nie zapisano", error)} /> : null}
        {saved ? (
          <FormNoticeMessage message={formSuccess("Zapisano", "Kliknij „Sprawdź ponownie”, żeby przeliczyć miesiąc.")} />
        ) : null}
      </div>
    </ModalShell>
  );
}
