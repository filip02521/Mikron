"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { ModalShell } from "@/components/ui/ModalShell";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { actionAddLoanerUnit, actionSuggestLoanerCode } from "@/app/actions/service-loaners";
import { actionSubiektSuggestProducts } from "@/app/actions/subiekt";
import { LOANER_CONDITIONS } from "@/lib/orders/service-loaners";

type Product = { twId: number; symbol: string | null; name: string };

const inputClass =
  "h-11 w-full rounded-lg border border-slate-200 bg-card px-3 text-base focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 sm:h-10 sm:text-sm";

export function LoanerAddDialog({ onClose, onDone }: { onClose: () => void; onDone: (message: string) => void }) {
  const formId = useId();
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Product[]>([]);
  const [hint, setHint] = useState<string | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [useSerial, setUseSerial] = useState(false);
  const [code, setCode] = useState("");
  const [serial, setSerial] = useState("");
  const [cond, setCond] = useState<string>("dobry");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const seq = useRef(0);

  useEffect(() => {
    let alive = true;
    actionSuggestLoanerCode().then((c) => {
      if (alive) setCode((prev) => prev || c);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2 || (product && product.name === q)) return;
    const mine = ++seq.current;
    const t = setTimeout(async () => {
      const res = await actionSubiektSuggestProducts(term);
      if (mine !== seq.current) return;
      if (!res.ok) {
        setItems([]);
        setHint(res.feedback.message);
        return;
      }
      setHint(null);
      setItems(res.items.map((p) => ({ twId: p.tw_Id, symbol: p.tw_Symbol ?? null, name: String(p.tw_Nazwa ?? p.tw_Symbol ?? p.tw_Id) })));
    }, 250);
    return () => clearTimeout(t);
  }, [q, product]);

  // Egzemplarz z numerem seryjnym: numer seryjny jest jego numerem w OnTime (jak na naklejce producenta).
  const finalCode = useSerial ? (serial.trim() ? `SN ${serial.trim()}` : "") : code;

  return (
    <ModalShell
      open
      className="touch-ui"
      onClose={onClose}
      title="Dodaj egzemplarz"
      description="Model to towar z Subiekta. OnTime prowadzi numer egzemplarza i jego historię."
      size="md"
      bodyClassName="space-y-5 px-5 py-4 sm:px-6 sm:py-5"
      loadingMessage={pending ? "Dodaję…" : null}
      footer={
        <div className="flex w-full justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={pending}>
            Anuluj
          </Button>
          <Button type="submit" form={formId} disabled={pending || !product || !finalCode}>
            {pending ? "Dodaję…" : finalCode ? `Dodaj ${finalCode}` : "Dodaj"}
          </Button>
        </div>
      }
    >
      <form
        id={formId}
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (!product || !finalCode) return;
          setError(null);
          start(async () => {
            const res = await actionAddLoanerUnit({
              code: finalCode,
              serialNo: useSerial ? serial : null,
              twId: product.twId,
              twSymbol: product.symbol,
              twName: product.name,
              condition: cond,
            });
            if (!res.ok) setError(res.message);
            else onDone(res.message);
          });
        }}
      >
        <div className="relative">
          <label htmlFor={`${formId}-tw`} className="mb-1.5 block text-xs font-semibold text-slate-600">
            Towar z Subiekta
          </label>
          <input
            id={`${formId}-tw`}
            value={q}
            autoComplete="off"
            autoFocus
            placeholder="Np. prostnica Forte 200"
            onChange={(e) => {
              setQ(e.target.value);
              setProduct(null);
            }}
            className={inputClass}
          />
          {!product && items.length ? (
            <ul role="listbox" className="absolute z-[90] mt-1 max-h-60 w-full overflow-auto rounded-lg border border-slate-200 bg-raised py-1 shadow-lg">
              {items.map((p) => (
                <li key={p.twId} role="option" aria-selected={false}>
                  <button
                    type="button"
                    onClick={() => {
                      setProduct(p);
                      setQ(p.name);
                      setItems([]);
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
        </div>

        <div>
          <span className="mb-1.5 block text-xs font-semibold text-slate-600">Numer egzemplarza</span>
          <div role="radiogroup" aria-label="Rodzaj numeru" className="mb-2 inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
            {[
              { v: false, l: "Własny numer" },
              { v: true, l: "Numer seryjny" },
            ].map((o) => (
              <button
                key={o.l}
                type="button"
                role="radio"
                aria-checked={useSerial === o.v}
                onClick={() => setUseSerial(o.v)}
                className={cn(
                  "h-8 rounded-md px-3 text-[0.8125rem] font-medium transition-colors duration-150",
                  useSerial === o.v ? "bg-segment-active text-slate-900 shadow-[var(--shadow-control)]" : "text-slate-500 hover:text-slate-800"
                )}
              >
                {o.l}
              </button>
            ))}
          </div>
          {useSerial ? (
            <input id={`${formId}-sn`} value={serial} onChange={(e) => setSerial(e.target.value)} placeholder="Np. MK-0518" className={cn(inputClass, "font-mono")} />
          ) : (
            <input id={`${formId}-code`} value={code} onChange={(e) => setCode(e.target.value)} placeholder="ZAST-005" className={cn(inputClass, "font-mono")} />
          )}
        </div>

        <div>
          <span className="mb-1.5 block text-xs font-semibold text-slate-600">Stan techniczny</span>
          <div role="radiogroup" aria-label="Stan techniczny" className="flex flex-wrap gap-1.5">
            {LOANER_CONDITIONS.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={cond === c}
                onClick={() => setCond(c)}
                className={cn(
                  "h-8 rounded-full border px-3 text-[0.8125rem] transition-colors duration-150",
                  cond === c ? "border-indigo-600 bg-indigo-50 font-semibold text-indigo-900" : "border-slate-200 bg-card text-slate-600 hover:bg-slate-100"
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
      </form>
    </ModalShell>
  );
}
