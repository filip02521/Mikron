"use client";

import { useEffect, useId, useRef, useState } from "react";
import { actionSubiektSuggestClients, actionSubiektSuggestProducts } from "@/app/actions/subiekt";
import { fieldLabelClass } from "@/lib/ui/serwis-theme";

export const pickerInputClass =
  "h-11 w-full rounded-lg border border-slate-200 bg-card px-3 text-base focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 sm:h-10 sm:text-sm";

export type PickedClient = { khId: number | null; name: string; phone: string | null };

/** Klient z Subiekta (podpowiedzi) albo wpisany ręcznie, gdy Subiekt nie odpowiada. */
export function ClientPicker({
  value,
  onChange,
  label = "Klient (kontrahent z Subiekta)",
  autoFocus,
}: {
  value: PickedClient | null;
  onChange: (c: PickedClient | null) => void;
  label?: string;
  autoFocus?: boolean;
}) {
  const id = useId();
  const [q, setQ] = useState(value?.name ?? "");
  const [items, setItems] = useState<PickedClient[]>([]);
  const [hint, setHint] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2 || (value && value.name === q && value.khId != null)) return;
    const mine = ++seq.current;
    const t = setTimeout(async () => {
      const res = await actionSubiektSuggestClients(term);
      if (mine !== seq.current) return;
      if (!res.ok) {
        setItems([]);
        setHint(res.feedback.message);
        return;
      }
      setHint(res.feedback?.hint ?? null);
      setItems(
        res.items.map((k) => ({
          khId: k.kh_Id,
          name: String(k.adr_NazwaPelna || k.adr_Nazwa || k.kh_Symbol || `Kontrahent ${k.kh_Id}`).trim(),
          phone: String(k.adr_Telefon || k.kh_Telefon || "").trim() || null,
        }))
      );
      setOpen(true);
    }, 250);
    return () => clearTimeout(t);
  }, [q, value]);

  return (
    <div className="relative">
      <label htmlFor={id} className={fieldLabelClass}>
        {label}
      </label>
      <input
        id={id}
        value={q}
        autoComplete="off"
        autoFocus={autoFocus}
        placeholder="Zacznij pisać nazwę, miasto albo NIP"
        onChange={(e) => {
          setQ(e.target.value);
          // Bez wyboru z listy zapisujemy nazwę wpisaną ręcznie (kh_Id pusty).
          onChange(e.target.value.trim() ? { khId: null, name: e.target.value.trim(), phone: null } : null);
        }}
        onFocus={() => items.length && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-autocomplete="list"
        className={pickerInputClass}
      />
      {open && items.length ? (
        <ul id={`${id}-list`} role="listbox" className="absolute z-[90] mt-1 max-h-64 w-full overflow-auto rounded-lg border border-slate-200 bg-raised py-1 shadow-lg">
          {items.map((c) => (
            <li key={c.khId ?? c.name} role="option" aria-selected={value?.khId === c.khId}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(c);
                  setQ(c.name);
                  setOpen(false);
                }}
                className="flex w-full flex-col px-3 py-2 text-left text-sm transition-colors duration-150 hover:bg-slate-50"
              >
                <span className="font-medium text-slate-900">{c.name}</span>
                {c.phone ? <span className="text-xs text-slate-500">tel. {c.phone}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {/* Podpowiedź Subiekta tylko przy wyszukiwaniu; przy nazwie wpisanej ręcznie mówi to zdanie niżej. */}
      {hint && !(value && value.khId == null && value.name) ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
      {value && value.khId == null && value.name ? (
        <p className="mt-1 text-xs text-slate-500">Bez wyboru z listy zapiszemy nazwę bez powiązania z Subiektem.</p>
      ) : null}
    </div>
  );
}

export type PickedProduct = { twId: number | null; symbol: string | null; name: string };

/**
 * Towar z Subiekta z podpowiedzi. Z `allowFreeText` wpisana nazwa bez wyboru z listy też jest wartością
 * (sprzęt klienta spoza kartoteki) — wtedy `twId` jest pusty.
 */
export function ProductPicker({
  value,
  onChange,
  label,
  placeholder,
  allowFreeText = false,
  freeTextHint,
  autoFocus,
}: {
  value: PickedProduct | null;
  onChange: (p: PickedProduct | null) => void;
  label: string;
  placeholder: string;
  allowFreeText?: boolean;
  freeTextHint?: string;
  autoFocus?: boolean;
}) {
  const id = useId();
  const [q, setQ] = useState(value?.name ?? "");
  const [items, setItems] = useState<PickedProduct[]>([]);
  const [hint, setHint] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2 || (value && value.twId != null && value.name === q)) return;
    const mine = ++seq.current;
    const t = setTimeout(async () => {
      const res = await actionSubiektSuggestProducts(term);
      if (mine !== seq.current) return;
      if (!res.ok) {
        setItems([]);
        setHint(res.feedback.message);
        return;
      }
      setHint(res.items.length ? null : "Subiekt nie ma takiego towaru.");
      setItems(res.items.map((p) => ({ twId: p.tw_Id, symbol: p.tw_Symbol ?? null, name: String(p.tw_Nazwa ?? p.tw_Symbol ?? p.tw_Id) })));
      setOpen(true);
    }, 250);
    return () => clearTimeout(t);
  }, [q, value]);

  return (
    <div className="relative">
      <label htmlFor={id} className={fieldLabelClass}>
        {label}
      </label>
      <input
        id={id}
        value={q}
        autoComplete="off"
        autoFocus={autoFocus}
        placeholder={placeholder}
        onChange={(e) => {
          const v = e.target.value;
          setQ(v);
          onChange(allowFreeText && v.trim() ? { twId: null, symbol: null, name: v.trim() } : null);
        }}
        onFocus={() => items.length && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-autocomplete="list"
        className={pickerInputClass}
      />
      {open && items.length ? (
        <ul id={`${id}-list`} role="listbox" className="absolute z-[90] mt-1 max-h-60 w-full overflow-auto rounded-lg border border-slate-200 bg-raised py-1 shadow-lg">
          {items.map((p) => (
            <li key={p.twId} role="option" aria-selected={value?.twId === p.twId}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(p);
                  setQ(p.name);
                  setOpen(false);
                }}
                className="flex w-full flex-col px-3 py-2 text-left text-sm transition-colors duration-150 hover:bg-slate-50"
              >
                <span className="font-medium text-slate-900">{p.name}</span>
                {p.symbol ? <span className="font-mono text-xs text-slate-500">{p.symbol}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
      {allowFreeText && value && value.twId == null && value.name && freeTextHint ? (
        <p className="mt-1 text-xs text-slate-500">{freeTextHint}</p>
      ) : null}
    </div>
  );
}
