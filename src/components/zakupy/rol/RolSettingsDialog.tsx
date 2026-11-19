"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { actionSaveRolProgram } from "@/app/actions/rol";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Field";
import { FormNoticeMessage } from "@/components/ui/FormNoticeMessage";
import { ModalShell } from "@/components/ui/ModalShell";
import { SubiektClientNameField } from "@/components/subiekt/SubiektClientNameField";
import type { RolProgram } from "@/lib/rol/data";
import { ROL_FREQUENCIES, ROL_FREQUENCY_LABEL } from "@/lib/rol/constants";
import { applyKontrahentToRolInput, type RolProgramInput } from "@/lib/rol/program";
import type { SubiektKontrahent } from "@/lib/subiekt/types";
import { formError, formSuccess } from "@/lib/ui/notice-copy";

const NEW = "__new__";
const NO_SEARCH = { clientName: "", clientKhId: null };

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
    active: p?.active ?? true,
    reportFrequency: p?.reportFrequency ?? "month",
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
  const [search, setSearch] = useState<{ clientName: string; clientKhId: number | null }>(NO_SEARCH);
  const [picked, setPicked] = useState<string | null>(null);

  const pick = (id: string) => {
    setSelected(id);
    setForm(toInput(programs.find((p) => p.id === id) ?? null));
    setError(null);
    setSaved(false);
    setSearch(NO_SEARCH);
    setPicked(null);
  };
  const set = (key: Exclude<keyof RolProgramInput, "active">) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setSaved(false);
  };

  const fillFromSubiekt = (k: SubiektKontrahent) => {
    const res = applyKontrahentToRolInput(form, k);
    setForm(res.form);
    setSaved(false);
    setPicked(
      res.filled.length
        ? `Uzupełniono: ${res.filled.join(", ")}. Sprawdź i zapisz.`
        : "Ta kartoteka jest już na liście, a pola są wypełnione — nic nie zmieniono."
    );
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
      description="Klienci z dodatkowym rabatem Ivoclar. OnTime szuka ich FS po kartotekach z Subiekta: co miesiąc, a dla wybranych także co tydzień lub co 2 tygodnie."
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
        <Field label="Szukaj klienta w Subiekcie">
          <SubiektClientNameField
            value={search.clientName}
            clientKhId={search.clientKhId}
            onChange={(patch) => {
              setSearch(patch);
              setPicked(null);
            }}
            onPick={fillFromSubiekt}
            maxLength={120}
            placeholder="Nazwa, nazwisko, NIP lub miasto"
            hint={picked ?? "Wybór z listy dopisze kartotekę i uzupełni puste pola poniżej."}
            unavailableHint="Wpisz dane klienta ręcznie w polach poniżej."
          />
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
        <Field
          label="Adres klienta (w treści maila)"
          hint="Ulica, kod i miasto, jedna linia na wiersz, maks. 4. Adresy e-mail wpisz w „Do” / „DW”."
        >
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
          <Field
            label="Raport co"
            hint={
              form.reportFrequency === "month"
                ? "Raport za miesiąc idzie 1. dnia następnego miesiąca."
                : form.reportFrequency === "week"
                  ? "W poniedziałek raport za miniony tydzień; 1. dnia miesiąca reszta FS, której jeszcze nie zgłoszono."
                  : "Co drugi poniedziałek raport za minione 2 tygodnie; 1. dnia miesiąca reszta FS, której jeszcze nie zgłoszono."
            }
          >
            <Select value={form.reportFrequency} onChange={set("reportFrequency")}>
              {ROL_FREQUENCIES.map((f) => (
                <option key={f} value={f}>
                  {ROL_FREQUENCY_LABEL[f]}
                </option>
              ))}
            </Select>
          </Field>
          <label className="flex cursor-pointer items-start justify-between gap-4 sm:pt-6">
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-sm font-medium text-slate-900">Aktywny ROL</span>
              <span className="text-xs leading-snug text-slate-500">
                {form.active ? "Trafia do kolejnych raportów." : "Wyłączony: bez nowych raportów, wysłane zostają w historii."}
              </span>
            </span>
            <input
              type="checkbox"
              role="switch"
              checked={form.active}
              onChange={(e) => {
                setForm((f) => ({ ...f, active: e.target.checked }));
                setSaved(false);
              }}
              className="toggle-switch toggle-indigo mt-0.5 shrink-0"
            />
          </label>
        </div>
        {error ? <FormNoticeMessage message={formError("Nie zapisano", error)} /> : null}
        {saved ? (
          <FormNoticeMessage message={formSuccess("Zapisano", "Kliknij „Sprawdź ponownie”, żeby przeliczyć miesiąc.")} />
        ) : null}
      </div>
    </ModalShell>
  );
}
