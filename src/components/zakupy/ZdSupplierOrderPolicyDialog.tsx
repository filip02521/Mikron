"use client";

import { useId, useState, useTransition } from "react";
import { actionSaveZdSupplierOrderPolicy } from "@/app/actions/zd-estimate";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Field";
import { ModalShell } from "@/components/ui/ModalShell";
import { LinkChevron } from "@/components/ui/UiGlyphs";
import { cn } from "@/lib/cn";
import { polishPluralWord } from "@/lib/email/polish-plural";
import type { ZdAutoLevel, ZdSupplierOrderPolicyRow } from "@/lib/data/zd-supplier-order-policy";
import type { ZdDemandStrategy } from "@/lib/orders/zd-demand-policy";

/** Stopnie autonomii (spec §4.4); `soon` = zapisany, ale działa dopiero od wdrożenia tej części. */
export const ZD_AUTO_LEVEL_OPTIONS: { value: ZdAutoLevel; label: string; body: string; soon?: string }[] = [
  { value: 0, label: "0 · Ręcznie", body: "Nic nie powstaje samo - Przygotuj ZD liczy na żywo, jak dotąd." },
  { value: 1, label: "1 · Propozycja ZD", body: "Propozycja powstaje sama i czeka w Kreatorze na akceptację - nic nie jest wysyłane samo." },
  {
    value: 2,
    label: "2 · Okno handlowców",
    body: "Handlowcy dokładają do propozycji do godziny odcięcia, potem propozycja jest zamrażana i przeliczana. Zakupy zatwierdzają.",
    soon: "okna handlowców",
  },
  {
    value: 3,
    label: "3 · Auto-zatwierdzanie",
    body: "Linie bez flag bezpieczników zatwierdzają się same, zakupy widzą tylko wyjątki.",
    soon: "auto-zatwierdzania",
  },
  { value: 4, label: "4 · Auto-mail", body: "Zatwierdzone ZD idzie mailem z PDF do dostawcy bez klikania.", soon: "auto-maila do dostawcy" },
];

/** Wartości startowe testu — wynik backtestu Polkardu (10.2025–10.2026). */
export const ZD_TEST_POLICY_DEFAULTS = { targetDays: 25, cycleDays: 3 } as const;

export function zdSupplierPolicyLabel(p: Pick<ZdSupplierOrderPolicyRow, "strategy" | "targetDays" | "cycleDays" | "autoProposals"> | null): string {
  if (!p || p.strategy === "classic") return "Strategia: jak dotąd";
  const parts = ["Strategia testowa"];
  if (p.targetDays) parts.push(`${p.targetDays} ${polishPluralWord(p.targetDays, "dzień", "dni", "dni")} zapasu`);
  if (p.cycleDays) parts.push(p.cycleDays === 1 ? "codziennie" : `co ${p.cycleDays} dni`);
  if (p.autoProposals) parts.push("propozycje");
  return parts.join(" · ");
}

/** Krótka etykieta w linii faktów zakresu (dni zapasu są już w tej linii). */
export function zdSupplierPolicyShortLabel(p: Pick<ZdSupplierOrderPolicyRow, "strategy" | "cycleDays"> | null): string {
  if (!p || p.strategy === "classic") return "Strategia: jak dotąd";
  return p.cycleDays
    ? `Strategia testowa · ZD ${p.cycleDays === 1 ? "codziennie" : `co ${p.cycleDays} dni`}`
    : "Strategia testowa";
}

/** Cichy przycisk na końcu linii faktów zakresu — strategia dostawcy, otwiera ustawienia. */
export function ZdSupplierOrderPolicyChip({
  policy,
  onClick,
  disabled,
}: {
  policy: ZdSupplierOrderPolicyRow | null;
  onClick: () => void;
  disabled?: boolean;
}) {
  const test = policy?.strategy === "max30_90";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={zdSupplierPolicyLabel(policy)}
      aria-label={`${zdSupplierPolicyLabel(policy)} - zmień strategię`}
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1 rounded-md px-1.5 text-xs font-medium transition-colors disabled:opacity-60",
        test ? "text-indigo-800 hover:bg-indigo-50" : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
      )}
    >
      {test ? <span aria-hidden className="size-1.5 rounded-full bg-indigo-600" /> : null}
      {/* Wąski ekran: sama „Strategia” — pełny opis w title / aria-label, fakty zakresu się mieszczą. */}
      <span className="hidden lg:inline">{zdSupplierPolicyShortLabel(policy)}</span>
      <span className="lg:hidden">Strategia</span>
      <LinkChevron size={12} tone="muted" />
    </button>
  );
}

function parseDays(raw: string, lo: number, hi: number): number | null {
  const n = Number(raw.trim());
  return Number.isInteger(n) && n >= lo && n <= hi ? n : null;
}

export function ZdSupplierOrderPolicyDialog({
  supplierId,
  supplierName,
  policy,
  onClose,
  onSaved,
}: {
  supplierId: string;
  supplierName: string;
  policy: ZdSupplierOrderPolicyRow | null;
  onClose: () => void;
  onSaved: (policy: ZdSupplierOrderPolicyRow) => void;
}) {
  const daysId = useId();
  const cycleId = useId();
  const levelId = useId();
  const cutoffId = useId();
  const [strategy, setStrategy] = useState<ZdDemandStrategy>(policy?.strategy ?? "classic");
  const [days, setDays] = useState(String(policy?.targetDays ?? ZD_TEST_POLICY_DEFAULTS.targetDays));
  const [cycle, setCycle] = useState(String(policy?.cycleDays ?? ZD_TEST_POLICY_DEFAULTS.cycleDays));
  const [level, setLevel] = useState<ZdAutoLevel>(policy?.autoLevel ?? 0);
  const [cutoff, setCutoff] = useState(policy?.cutoffTime ?? "14:00");
  const [error, setError] = useState<string | null>(null);
  /** Zapis bez części pól (baza bez migracji 194) — dialog zostaje z ostrzeżeniem, zamknięcie oddaje politykę. */
  const [savedWithWarning, setSavedWithWarning] = useState<{ policy: ZdSupplierOrderPolicyRow; warning: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const test = strategy === "max30_90";

  const save = () => {
    const targetDays = test ? parseDays(days, 1, 180) : null;
    const cycleDays = test ? parseDays(cycle, 1, 60) : null;
    if (test && targetDays == null) return setError("Dni zapasu: liczba całkowita od 1 do 180.");
    if (test && cycleDays == null) return setError("Co ile dni: liczba całkowita od 1 do 60.");
    const cutoffOk = /^\d{2}:\d{2}$/.test(cutoff);
    if (test && level >= 2 && !cutoffOk) return setError("Podaj godzinę odcięcia, np. 14:00.");
    setError(null);
    startTransition(async () => {
      const res = await actionSaveZdSupplierOrderPolicy({
        supplierId,
        strategy,
        targetDays,
        cycleDays,
        autoLevel: test ? level : 0,
        cutoffTime: cutoffOk ? cutoff : (policy?.cutoffTime ?? "14:00"),
      });
      if (!res.ok) return setError(res.message);
      if (res.warning) return setSavedWithWarning({ policy: res.policy, warning: res.warning });
      onSaved(res.policy);
    });
  };

  const option = (value: ZdDemandStrategy, title: string, body: string) => (
    <label
      className={cn(
        "flex cursor-pointer gap-3 rounded-md border px-3.5 py-3",
        strategy === value ? "border-indigo-300 bg-indigo-50/60" : "border-slate-200 hover:bg-slate-50"
      )}
    >
      <input
        type="radio"
        name="zd-order-strategy"
        className="mt-0.5"
        checked={strategy === value}
        onChange={() => setStrategy(value)}
      />
      <span>
        <span className="block text-sm font-semibold text-slate-900">{title}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-slate-600">{body}</span>
      </span>
    </label>
  );

  return (
    <ModalShell
      open
      onClose={savedWithWarning ? () => onSaved(savedWithWarning.policy) : onClose}
      title={`Strategia zamawiania - ${supplierName}`}
      size="md"
      bodyClassName="space-y-4 px-5 py-5 sm:px-6"
      loadingMessage={pending ? "Zapisuję…" : null}
      disableBackdropClose={pending}
      footer={
        savedWithWarning ? (
          <div className="flex w-full justify-end">
            <Button type="button" onClick={() => onSaved(savedWithWarning.policy)}>
              Rozumiem
            </Button>
          </div>
        ) : (
          <div className="flex w-full justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose} disabled={pending}>
              Anuluj
            </Button>
            <Button type="button" onClick={save} disabled={pending}>
              Zapisz
            </Button>
          </div>
        )
      }
    >
      <div className="space-y-2" role="radiogroup" aria-label="Strategia">
        {option("classic", "Jak dotąd", "Cel = sprzedaż z okna Kreatora × dni zapasu dostawcy.")}
        {option(
          "max30_90",
          "Test: częstsze ZD, krótszy zapas, podłoga 90 dni",
          "Tempo nie niższe niż średnia z 90 dni (towar, który miał słabszy miesiąc, nie znika ze stanu). Cel na mniej dni, zamawiane częściej - jednorazowa duża sprzedaż wraca na ZD tylko w części."
        )}
      </div>

      {test ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor={daysId} className="text-xs font-medium text-slate-700">
              Dni zapasu w celu
            </label>
            <Input id={daysId} inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} className="mt-1" />
          </div>
          <div>
            <label htmlFor={cycleId} className="text-xs font-medium text-slate-700">
              ZD co ile dni
            </label>
            <Input id={cycleId} inputMode="numeric" value={cycle} onChange={(e) => setCycle(e.target.value)} className="mt-1" />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor={levelId} className="text-xs font-medium text-slate-700">
              Automat ZD
            </label>
            <Select
              id={levelId}
              value={level}
              onChange={(e) => setLevel(Number(e.target.value) as ZdAutoLevel)}
              className="mt-1"
            >
              {ZD_AUTO_LEVEL_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">
              {ZD_AUTO_LEVEL_OPTIONS[level].body}
              {level >= 1
                ? ` Propozycja ${parseDays(cycle, 1, 60) === 1 ? "codziennie" : `co ${parseDays(cycle, 1, 60) ?? "…"} dni`}.`
                : ""}
            </p>
          </div>
          {level >= 2 ? (
            <>
              <div>
                <label htmlFor={cutoffId} className="text-xs font-medium text-slate-700">
                  Do której handlowcy dokładają
                </label>
                <Input
                  id={cutoffId}
                  type="time"
                  step={60}
                  value={cutoff}
                  onChange={(e) => setCutoff(e.target.value)}
                  className="mt-1"
                />
                <span className="mt-1 block text-xs text-slate-500">Dzień przed wysyłką ZD.</span>
              </div>
              <p className="rounded-md bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900 sm:col-span-2">
                Zapisane, ale działa od wdrożenia {ZD_AUTO_LEVEL_OPTIONS[level].soon}. Do tego czasu propozycja czeka
                na akceptację jak w stopniu 1.
              </p>
            </>
          ) : null}
        </div>
      ) : null}

      <p className="rounded-md bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600">
        Backtest 10.2025-10.2026: przy dostawie do 3 dni (27 dostawców) strategia testowa dała mniej dni bez towaru i
        mniejszy zapas niż rzeczywistość (Polkard, 25 dni co 3 dni: −33% dni bez towaru, −33% zapasu). Przy dłuższej
        dostawie cel rośnie sam: co najmniej cykl zamawiania + czas dostawy + 25% czasu dostawy (dni wyżej to
        minimum). Zmiana działa od następnego Policz.
      </p>
      {savedWithWarning ? (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm leading-relaxed text-amber-900" role="status">
          {savedWithWarning.warning}
        </p>
      ) : null}
      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
    </ModalShell>
  );
}
