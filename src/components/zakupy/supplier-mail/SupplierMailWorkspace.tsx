"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  actionSupplierMailConversation,
  actionSupplierMailHandle,
  actionSupplierMailRemind,
  actionSupplierMailReopen,
  actionSupplierMailReopenCase,
  actionSupplierMailReply,
  actionSupplierMailResolveCase,
  actionSupplierMailView,
  type ConversationMessage,
} from "@/app/actions/supplier-mail";
import { IconChevronLeft, IconMail, IconPaperclip } from "@/components/icons/StrokeIcons";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/cn";
import { procurementBoardQuestionHref } from "@/lib/data/department-board-shared";
import type { MailConversation, SupplierMailView, WaitingCase } from "@/lib/supplier-mail/data";
import { businessDaysLabel } from "@/lib/suppliers/awaiting-supplier";
import { controlFocusClass } from "@/lib/ui/ontime-theme";

type Filter = "open" | "waiting" | "documents" | "done";
type DoneInfo = { label: string; undo: () => Promise<{ ok: true } | { ok: false; message: string }> };
type Selection = { type: "conv"; key: string } | { type: "case"; kind: "zd" | "inquiry"; id: string } | null;

const timeFmt = new Intl.DateTimeFormat("pl-PL", { timeZone: "Europe/Warsaw", hour: "2-digit", minute: "2-digit" });
const dayFmt = new Intl.DateTimeFormat("pl-PL", { timeZone: "Europe/Warsaw", day: "2-digit", month: "2-digit" });
const fullFmt = new Intl.DateTimeFormat("pl-PL", {
  timeZone: "Europe/Warsaw",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** Obrazki z podpisu Outlooka (image001.png…) to nie załączniki — nie zaśmiecają listy. */
function visibleAttachments<T extends { filename: string }>(list: readonly T[]): T[] {
  return list.filter((a) => !/^image\d{3}\.(png|jpe?g|gif)$/i.test(a.filename));
}

function shortWhen(iso: string): string {
  const d = new Date(iso);
  return dayFmt.format(d) === dayFmt.format(new Date()) ? timeFmt.format(d) : dayFmt.format(d);
}

const CATEGORY_TAG: Record<MailConversation["category"], { text: string; className: string }> = {
  confirmation: { text: "Potwierdzenie", className: "bg-emerald-50 text-emerald-800 ring-emerald-200" },
  reply: { text: "Odpowiedź", className: "bg-indigo-50 text-indigo-800 ring-indigo-200" },
  invoice: { text: "Faktura", className: "bg-slate-100 text-slate-700 ring-slate-200" },
  shipping: { text: "Wysyłka", className: "bg-slate-100 text-slate-700 ring-slate-200" },
};

function ConversationTag({ c }: { c: MailConversation }) {
  const tag = c.bounce
    ? { text: "Mail nie doszedł", className: "bg-red-50 text-red-800 ring-red-200" }
    : c.autoReply
      ? { text: "Autoodpowiedź", className: "bg-slate-100 text-slate-700 ring-slate-200" }
      : CATEGORY_TAG[c.category];
  return <span className={cn("shrink-0 rounded px-1.5 py-px text-[11px] font-medium ring-1", tag.className)}>{tag.text}</span>;
}

/**
 * Poczta dostawców: odpowiedzi i potwierdzenia od dostawców (także OC osobnym mailem), zwroty, sprawy
 * bez odpowiedzi po terminie i dokumenty. Odpowiedź / przypomnienie z Gmaila zalogowanej osoby.
 */
export function SupplierMailWorkspace({
  initialView,
  initialMe,
  initialCanReply,
  initialSignature,
}: {
  initialView: SupplierMailView;
  initialMe: string | null;
  initialCanReply: boolean;
  initialSignature: string;
}) {
  const [view, setView] = useState(initialView);
  const [me, setMe] = useState(initialMe);
  const [canReply, setCanReply] = useState(initialCanReply);
  const [signature, setSignature] = useState(initialSignature);
  const [filter, setFilter] = useState<Filter>("open");
  const [selection, setSelection] = useState<Selection>(null);
  const [syncing, setSyncing] = useState(true);
  const [syncNote, setSyncNote] = useState<string | null>(null);

  const refresh = useCallback(
    (opts: { sync?: boolean; force?: boolean } = {}) =>
      actionSupplierMailView(opts)
        .then((res) => {
          if (!res.ok) {
            setSyncNote(res.message);
            return;
          }
          setView(res.view);
          setMe(res.me);
          setCanReply(res.canReply);
          setSignature(res.signature);
          setSyncNote(res.syncErrors.length ? `Nie udało się sprawdzić skrzynki: ${res.syncErrors[0]}` : null);
        })
        .catch(() => setSyncNote("Nie udało się odświeżyć poczty."))
        .finally(() => setSyncing(false)),
    []
  );

  // Przy wejściu: nowe maile z Gmaila (najwyżej co 5 min na skrzynkę), lista z bazy już jest.
  useEffect(() => {
    void refresh({ sync: true });
  }, [refresh]);

  const checkNow = () => {
    setSyncing(true);
    void refresh({ sync: true, force: true });
  };

  const conversations = useMemo(() => new Map([...view.open, ...view.documents, ...view.done].map((c) => [c.key, c])), [view]);
  const cases = useMemo(() => new Map([...view.overdue, ...view.waiting].map((c) => [`${c.kind}|${c.id}`, c])), [view]);

  /** Kolejność listy w bieżącym filtrze — do j/k i wyboru następnej pozycji po zamknięciu. */
  const order: Selection[] = useMemo(() => {
    const conv = (list: MailConversation[]) => list.map((c) => ({ type: "conv" as const, key: c.key }));
    const cs = (list: WaitingCase[]) => list.map((c) => ({ type: "case" as const, kind: c.kind, id: c.id }));
    if (filter === "open") return [...conv(view.open), ...cs(view.overdue)];
    if (filter === "waiting") return cs(view.waiting);
    if (filter === "documents") return conv(view.documents);
    return conv(view.done);
  }, [filter, view]);

  const sameSel = (a: Selection, b: Selection) =>
    a?.type === "conv" && b?.type === "conv"
      ? a.key === b.key
      : a?.type === "case" && b?.type === "case"
        ? a.kind === b.kind && a.id === b.id
        : false;
  const index = order.findIndex((s) => sameSel(s, selection));

  /** „Załatwione” z ostatnich 30 s — wszystkie do cofnięcia jednym kliknięciem (kilka szybkich kliknięć też). */
  const [undo, setUndo] = useState<DoneInfo[]>([]);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (undoTimer.current) clearTimeout(undoTimer.current);
  }, []);

  const afterDone = (done?: { label: string; undo: () => Promise<{ ok: true } | { ok: false; message: string }> }) => {
    // Następna pozycja w tej samej grupie — jak w skrzynce pocztowej.
    const next = order[index + 1] ?? order[index - 1] ?? null;
    setSelection(next);
    void refresh();
    if (done) {
      if (undoTimer.current) clearTimeout(undoTimer.current);
      setUndo((prev) => [...prev, done]);
      undoTimer.current = setTimeout(() => setUndo([]), 30_000);
    }
  };

  const runUndo = async () => {
    const items = undo;
    if (!items.length) return;
    setUndo([]);
    const results = await Promise.all(items.map((u) => u.undo().catch(() => ({ ok: false as const, message: "Nie udało się cofnąć." }))));
    const failed = results.find((r) => !r.ok);
    if (failed && !failed.ok) setSyncNote(failed.message);
    void refresh();
  };

  // Skróty tylko do przeglądania: j / k — następna / poprzednia (poza polami tekstowymi). Bez skrótów
  // zmieniających stan — jeden przypadkowy klawisz nie może zamknąć sprawy.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key !== "j" && e.key !== "k") return;
      e.preventDefault();
      const i = index < 0 ? (e.key === "j" ? 0 : order.length - 1) : index + (e.key === "j" ? 1 : -1);
      if (order[i]) setSelection(order[i]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, order]);

  const tabs: { id: Filter; label: string; count: number }[] = [
    { id: "open", label: "Do reakcji", count: view.open.length + view.overdue.length },
    { id: "waiting", label: "Czekają", count: view.waiting.length },
    { id: "documents", label: "Dokumenty", count: view.documents.length },
    { id: "done", label: "Załatwione", count: view.done.length },
  ];

  // Telefon: lista i rozmowa są jedna pod drugą — po wyborze przewijamy do rozmowy.
  const detailRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (selection && window.matchMedia("(max-width: 1023px)").matches) {
      detailRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
    }
  }, [selection]);

  const selectedConv = selection?.type === "conv" ? conversations.get(selection.key) : undefined;
  const selectedCase = selection?.type === "case" ? cases.get(`${selection.kind}|${selection.id}`) : undefined;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="tablist" aria-label="Poczta dostawców" className="flex flex-wrap gap-1 rounded-md bg-slate-100/70 p-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={filter === t.id}
              onClick={() => {
                setFilter(t.id);
                setSelection(null);
              }}
              className={cn(
                controlFocusClass,
                "inline-flex min-h-9 items-center gap-1.5 rounded px-3 text-sm font-medium transition-colors",
                filter === t.id ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200" : "text-slate-600 hover:text-slate-900"
              )}
            >
              {t.label}
              <span
                className={cn(
                  "min-w-5 rounded-full px-1.5 text-center text-xs tabular-nums",
                  t.id === "open" && t.count ? "bg-amber-100 text-amber-900" : "bg-slate-200/70 text-slate-600"
                )}
              >
                {t.count}
              </span>
            </button>
          ))}
        </div>
        <p className="flex items-center gap-2 text-xs text-slate-500" role="status" aria-live="polite">
          {syncing ? (
            <>
              <Spinner size="sm" /> Sprawdzam skrzynkę…
            </>
          ) : view.sync.at ? (
            `Skrzynka sprawdzona ${shortWhen(view.sync.at)}`
          ) : (
            "Skrzynka jeszcze nie była sprawdzana"
          )}
          <button
            type="button"
            onClick={checkNow}
            disabled={syncing}
            className="rounded px-1.5 py-1 font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
          >
            Sprawdź teraz
          </button>
        </p>
      </div>
      {undo.length ? (
        <p
          className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm text-white"
          role="status"
        >
          <span>{undo.length === 1 ? undo[0]!.label : `${undo.length} ${undo.length < 5 ? "sprawy" : "spraw"} - załatwione.`}</span>
          <button type="button" onClick={() => void runUndo()} className="rounded px-2 py-1 font-semibold text-indigo-200 hover:bg-white/10">
            Cofnij
          </button>
        </p>
      ) : null}
      {syncNote ? (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-200" role="alert">
          {syncNote}
        </p>
      ) : null}
      {!me ? (
        <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700 ring-1 ring-slate-200">
          Połącz swojego Gmaila w{" "}
          <Link href="/ustawienia" className="font-medium text-indigo-700 underline">
            Ustawieniach
          </Link>
          , żeby odpowiadać dostawcom z OnTime.
        </p>
      ) : null}

      {/* Na dużym ekranie jak program pocztowy: stała wysokość, lista i rozmowa przewijają się osobno,
          pole odpowiedzi zawsze widoczne na dole rozmowy. */}
      <div className="grid overflow-hidden rounded-[var(--radius-panel)] border border-slate-200 bg-white lg:h-[calc(100dvh-15rem)] lg:min-h-[32rem] lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <div className={cn("min-h-[24rem] border-slate-200 lg:min-h-0 lg:overflow-y-auto lg:border-r", selection ? "hidden lg:block" : "block")}>
          <MailList
            filter={filter}
            view={view}
            selection={selection}
            onSelect={setSelection}
            isSelected={(s) => sameSel(s, selection)}
          />
        </div>
        <div ref={detailRef} className={cn("min-h-[24rem] scroll-mt-20 lg:min-h-0", selection ? "block" : "hidden lg:block")}>
          {selectedConv ? (
            <ConversationDetail
              key={selectedConv.key}
              conv={selectedConv}
              me={me}
              canReply={canReply}
              onBack={() => setSelection(null)}
              onDone={afterDone}
            />
          ) : selectedCase ? (
            <CaseDetail
              key={`${selectedCase.kind}|${selectedCase.id}`}
              item={selectedCase}
              me={me}
              signature={signature}
              canReply={canReply}
              onBack={() => setSelection(null)}
              onDone={afterDone}
            />
          ) : (
            <div className="flex h-full min-h-[24rem] flex-col items-center justify-center gap-2 px-6 text-center text-sm text-slate-500">
              <IconMail size={22} className="text-slate-300" aria-hidden />
              <p>Wybierz wiadomość z listy.</p>
              <p className="text-xs text-slate-400">Skróty: j / k - następna / poprzednia.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MailList({
  filter,
  view,
  onSelect,
  isSelected,
}: {
  filter: Filter;
  view: SupplierMailView;
  selection: Selection;
  onSelect: (s: Selection) => void;
  isSelected: (s: Selection) => boolean;
}) {
  const convRow = (c: MailConversation) => {
    const sel: Selection = { type: "conv", key: c.key };
    return (
      <li key={c.key}>
        <button
          type="button"
          onClick={() => onSelect(sel)}
          aria-current={isSelected(sel) ? "true" : undefined}
          className={cn(
            "block w-full px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500/45",
            isSelected(sel) ? "bg-indigo-50/70" : "hover:bg-slate-50"
          )}
        >
          <span className="flex items-baseline justify-between gap-2">
            <span className={cn("min-w-0 truncate text-sm text-slate-900", c.open ? "font-semibold" : "font-medium")}>
              {c.supplierName}
            </span>
            <span className="shrink-0 text-xs tabular-nums text-slate-500">{shortWhen(c.lastAt)}</span>
          </span>
          <span className="mt-0.5 flex items-center gap-1.5">
            <ConversationTag c={c} />
            {c.zdLabel ? <span className="truncate text-xs font-medium text-slate-600">{c.zdLabel}</span> : null}
            {c.attachments ? <IconPaperclip size={12} className="shrink-0 text-slate-400" aria-label="Załączniki" /> : null}
            {c.count > 1 ? <span className="text-xs tabular-nums text-slate-400">{c.count}</span> : null}
          </span>
          <span className="mt-0.5 block truncate text-sm text-slate-700">{c.subject || "(bez tematu)"}</span>
          <span className="block truncate text-xs text-slate-500">{c.snippet}</span>
        </button>
      </li>
    );
  };
  const caseRow = (w: WaitingCase) => {
    const sel: Selection = { type: "case", kind: w.kind, id: w.id };
    return (
      <li key={`${w.kind}|${w.id}`}>
        <button
          type="button"
          onClick={() => onSelect(sel)}
          aria-current={isSelected(sel) ? "true" : undefined}
          className={cn(
            "block w-full px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500/45",
            isSelected(sel) ? "bg-indigo-50/70" : "hover:bg-slate-50"
          )}
        >
          <span className="flex items-baseline justify-between gap-2">
            <span className="min-w-0 truncate text-sm font-medium text-slate-900">{w.supplierName}</span>
            <span className="shrink-0 text-xs tabular-nums text-slate-500">{shortWhen(w.remindedAt ?? w.sentAt)}</span>
          </span>
          <span className="mt-0.5 flex items-center gap-1.5">
            <span
              className={cn(
                "shrink-0 rounded px-1.5 py-px text-[11px] font-medium ring-1",
                w.overdue ? "bg-red-50 text-red-800 ring-red-200" : "bg-slate-100 text-slate-600 ring-slate-200"
              )}
            >
              {w.overdue
                ? `Brak odpowiedzi · ${businessDaysLabel(w.businessDays)}`
                : w.businessDays === 0
                  ? "Wysłano dziś"
                  : `Czeka · ${businessDaysLabel(w.businessDays)}`}
            </span>
            {w.remindedAt ? <span className="text-xs text-slate-500">przypomniano</span> : null}
            {w.autoReply ? <span className="text-xs text-slate-500">autoodpowiedź</span> : null}
          </span>
          <span className="mt-0.5 block truncate text-sm text-slate-700">
            {w.kind === "zd" ? w.label : `Pytanie z tablicy: ${w.label}`}
          </span>
        </button>
      </li>
    );
  };

  const section = (title: string, items: React.ReactNode[], empty?: string) =>
    items.length || empty ? (
      <section aria-label={title}>
        <h3 className="sticky top-0 z-10 border-b border-slate-100 bg-white/95 px-4 py-2 text-xs font-semibold text-slate-500 backdrop-blur">
          {title} <span className="tabular-nums text-slate-400">{items.length}</span>
        </h3>
        {items.length ? (
          <ul className="divide-y divide-slate-100">{items}</ul>
        ) : (
          <p className="px-4 py-6 text-sm text-slate-500">{empty}</p>
        )}
      </section>
    ) : null;

  if (filter === "open") {
    const bounces = view.open.filter((c) => c.bounce);
    const rest = view.open.filter((c) => !c.bounce);
    if (!view.open.length && !view.overdue.length) {
      return <p className="px-4 py-10 text-center text-sm text-slate-500">Nic nie czeka na Twoją reakcję.</p>;
    }
    return (
      <div>
        {section("Mail nie doszedł", bounces.map(convRow))}
        {section("Odpowiedzi i potwierdzenia", rest.map(convRow))}
        {section("Brak odpowiedzi po terminie", view.overdue.map(caseRow))}
      </div>
    );
  }
  const list =
    filter === "waiting"
      ? view.waiting.map(caseRow)
      : (filter === "documents" ? view.documents : view.done).map(convRow);
  const empty = {
    waiting: "Żadne wysłane ZD ani zapytanie nie czeka w terminie.",
    documents: "Brak faktur i dokumentów wysyłki z ostatnich 30 dni.",
    done: "Brak załatwionych rozmów z ostatnich 14 dni.",
  }[filter];
  return list.length ? (
    <ul className="divide-y divide-slate-100">{list}</ul>
  ) : (
    <p className="px-4 py-10 text-center text-sm text-slate-500">{empty}</p>
  );
}

/** false przez chwilę po pokazaniu rozmowy / sprawy (komponent z key — nowy przy każdej zmianie). */
function useArmedAfterMount(ms = 800): boolean {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setArmed(true), ms);
    return () => clearTimeout(t);
  }, [ms]);
  return armed;
}

function DetailHeader({
  title,
  subtitle,
  supplierId,
  onBack,
  children,
}: {
  title: string;
  subtitle: React.ReactNode;
  supplierId: string | null;
  onBack: () => void;
  children?: React.ReactNode;
}) {
  return (
    <header className="border-b border-slate-200 px-4 py-3 sm:px-5">
      <button
        type="button"
        onClick={onBack}
        className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-indigo-700 lg:hidden"
      >
        <IconChevronLeft size={16} aria-hidden /> Lista
      </button>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          <p className="mt-0.5 text-sm text-slate-600">{subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {supplierId ? (
            <Link
              href={`/podsumowanie?supplierId=${encodeURIComponent(supplierId)}`}
              className="rounded px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-50"
            >
              Karta dostawcy
            </Link>
          ) : null}
          {children}
        </div>
      </div>
    </header>
  );
}

function ConversationDetail({
  conv,
  me,
  canReply,
  onBack,
  onDone,
}: {
  conv: MailConversation;
  me: string | null;
  canReply: boolean;
  onBack: () => void;
  onDone: (done?: DoneInfo) => void;
}) {
  const [messages, setMessages] = useState<ConversationMessage[] | null>(null);
  // Po przejściu do następnej rozmowy „Załatwione” jest pod kursorem — chwila przerwy chroni przed seryjnym zamykaniem.
  const armed = useArmedAfterMount();
  const [signature, setSignature] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    actionSupplierMailConversation({ mailbox: conv.mailbox, threadId: conv.threadId })
      .then((res) => {
        if (!alive) return;
        if (res.ok) {
          setMessages(res.messages);
          setSignature(res.signature);
        } else setError(res.message);
      })
      .catch(() => alive && setError("Nie udało się wczytać rozmowy."));
    return () => {
      alive = false;
    };
  }, [conv.mailbox, conv.threadId]);

  const handle = useCallback(async () => {
    if (!conv.open) return;
    setBusy(true);
    setError(null);
    const res = await actionSupplierMailHandle({ mailbox: conv.mailbox, threadId: conv.threadId }).catch(() => null);
    setBusy(false);
    if (res?.ok) {
      onDone({
        label: `Rozmowa z ${conv.supplierName} - załatwione.`,
        undo: () => actionSupplierMailReopen({ mailbox: conv.mailbox, threadId: conv.threadId }),
      });
    } else setError(res?.message ?? "Nie udało się oznaczyć rozmowy.");
  }, [conv, onDone]);

  const foreign = me ? me.toLowerCase() !== conv.mailbox : true;
  const hasSupplierMessage = Boolean(messages?.some((m) => m.kind !== "bounce"));

  return (
    <div className="flex h-full min-h-0 flex-col">
      <DetailHeader
        title={conv.supplierName}
        subtitle={
          <>
            {conv.subject || "(bez tematu)"}
            {conv.zdLabel ? (
              <span className="text-slate-500">
                {" "}
                · {conv.caseKind === "inquiry" ? "Pytanie z tablicy" : conv.zdLabel}
                {conv.linkedBy === "supplier" ? " (ostatnie ZD dostawcy)" : ""}
              </span>
            ) : null}
          </>
        }
        supplierId={conv.supplierId}
        onBack={onBack}
      >
        {conv.boardThreadId ? (
          <Link
            href={procurementBoardQuestionHref(conv.boardThreadId)}
            className="rounded px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-50"
          >
            Przekaż handlowcowi
          </Link>
        ) : null}
        {conv.open ? (
          <Button type="button" size="sm" variant="secondary" disabled={busy || !armed} onClick={() => void handle()}>
            {busy ? "Zapisuję…" : "Załatwione"}
          </Button>
        ) : null}
      </DetailHeader>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4 sm:px-5">
        {error ? (
          <p className="text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}
        {!messages && !error ? (
          <p className="flex items-center gap-2 text-sm text-slate-500" role="status">
            <Spinner size="sm" /> Wczytuję treść z Gmaila…
          </p>
        ) : null}
        {messages?.map((m) => <MessageCard key={m.id} m={m} />)}
        {conv.mailbox !== me && me ? (
          <p className="text-xs text-slate-500">Rozmowa jest w skrzynce {conv.mailbox}.</p>
        ) : null}
      </div>

      {messages && hasSupplierMessage && canReply ? (
        <Composer
          key={conv.key}
          title={`Odpowiedz ${conv.supplierName}`}
          note={`Pójdzie z ${me} jako „Re:” do ostatniej wiadomości dostawcy${foreign ? `; ${conv.mailbox} dostanie kopię` : ""}.`}
          signature={signature}
          withCc
          send={(body, cc) => actionSupplierMailReply({ mailbox: conv.mailbox, threadId: conv.threadId, body, cc })}
          onSent={onDone}
        />
      ) : null}
    </div>
  );
}

function MessageCard({ m }: { m: ConversationMessage }) {
  const [expanded, setExpanded] = useState(false);
  const text = m.text?.trim() || m.snippet;
  const long = text.length > 700 || text.split("\n").length > 14;
  return (
    <article
      className={cn(
        "rounded-md px-3.5 py-3 ring-1",
        m.kind === "bounce" ? "bg-red-50/60 ring-red-200" : m.kind === "auto" ? "bg-slate-50 ring-slate-200" : "bg-white ring-slate-200"
      )}
    >
      <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-xs">
        <span className="min-w-0 font-medium text-slate-900">
          {m.kind === "bounce" ? "Mail nie doszedł · " : m.kind === "auto" ? "Autoodpowiedź · " : ""}
          {m.fromName || m.from} <span className="font-normal text-slate-500">{m.fromName ? `<${m.from}>` : ""}</span>
        </span>
        <time className="tabular-nums text-slate-500" dateTime={m.receivedAt}>
          {fullFmt.format(new Date(m.receivedAt))}
        </time>
      </header>
      <p className={cn("mt-2 whitespace-pre-line break-words text-sm leading-relaxed text-slate-800", long && !expanded && "line-clamp-[14]")}>
        {text}
      </p>
      {long ? (
        <button type="button" className="mt-1 text-xs font-medium text-indigo-700 hover:underline" onClick={() => setExpanded((v) => !v)}>
          {expanded ? "Zwiń" : "Pokaż całość"}
        </button>
      ) : null}
      {visibleAttachments(m.attachments).length ? (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {visibleAttachments(m.attachments).map((a) => (
            <li key={a.attachmentId}>
              <a
                href={`/api/operations/supplier-mail/attachment?id=${encodeURIComponent(m.id)}&a=${encodeURIComponent(a.attachmentId)}`}
                target="_blank"
                rel="noopener"
                className="inline-flex max-w-[16rem] items-center gap-1 rounded bg-slate-50 px-2 py-1 text-xs text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100"
                title={a.filename}
              >
                <IconPaperclip size={12} aria-hidden className="shrink-0 text-slate-400" />
                <span className="truncate">{a.filename}</span>
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

function CaseDetail({
  item,
  me,
  signature,
  canReply,
  onBack,
  onDone,
}: {
  item: WaitingCase;
  me: string | null;
  signature: string;
  canReply: boolean;
  onBack: () => void;
  onDone: (done?: DoneInfo) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const armed = useArmedAfterMount();

  const resolve = useCallback(async () => {
    setBusy(true);
    setError(null);
    const res = await actionSupplierMailResolveCase({ kind: item.kind, id: item.id }).catch(() => null);
    setBusy(false);
    if (res?.ok) {
      onDone({
        label: `${item.supplierName}: ${item.label} - załatwione.`,
        undo: () => actionSupplierMailReopenCase({ kind: item.kind, id: item.id }),
      });
    } else setError(res?.message ?? "Nie udało się zamknąć sprawy.");
  }, [item, onDone]);

  // Język jak w pierwszej wiadomości: zagranica i import po angielsku.
  const sent = dayFmt.format(new Date(item.sentAt));
  const reminder = item.english
    ? item.kind === "zd"
      ? `Dear Sir or Madam,\n\ncould you please confirm our order sent on ${sent} and let us know the expected delivery date?\n\nThank you.`
      : `Dear Sir or Madam,\n\nkindly reminding you of our inquiry sent on ${sent} - could you let us know the price, availability and lead time?\n\nThank you.`
    : item.kind === "zd"
      ? `Dzień dobry,\n\nuprzejmie proszę o potwierdzenie zamówienia wysłanego ${sent} i podanie przewidywanego terminu dostawy.\n\nDziękuję.`
      : `Dzień dobry,\n\nuprzejmie przypominam o zapytaniu z ${sent} - czy mogą Państwo podać cenę, dostępność i termin realizacji?\n\nDziękuję.`;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <DetailHeader
        title={item.supplierName}
        subtitle={item.kind === "zd" ? item.label : `Pytanie z tablicy: ${item.label}`}
        supplierId={item.supplierId}
        onBack={onBack}
      >
        {item.boardThreadId ? (
          <Link
            href={procurementBoardQuestionHref(item.boardThreadId)}
            className="rounded px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-50"
          >
            Wątek na tablicy
          </Link>
        ) : null}
        <Button type="button" size="sm" variant="secondary" disabled={busy || !armed} onClick={() => void resolve()}>
          {busy ? "Zapisuję…" : "Załatwione"}
        </Button>
      </DetailHeader>
      <div className="space-y-3 px-4 py-4 sm:px-5">
        <dl className="grid grid-cols-[8rem_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-sm">
          <dt className="text-slate-500">Wysłano</dt>
          <dd className="text-slate-900">
            {fullFmt.format(new Date(item.sentAt))} z {item.from}
          </dd>
          <dt className="text-slate-500">Do</dt>
          <dd className="break-words text-slate-900">{item.to.join(", ") || "-"}</dd>
          {item.remindedAt ? (
            <>
              <dt className="text-slate-500">Przypomnienie</dt>
              <dd className="text-slate-900">{fullFmt.format(new Date(item.remindedAt))}</dd>
            </>
          ) : null}
          <dt className="text-slate-500">Odpowiedź</dt>
          <dd className={item.overdue ? "font-medium text-red-700" : "text-slate-900"}>
            {item.autoReply ? "tylko autoodpowiedź · " : "brak · "}
            {item.overdue
              ? `po terminie (${businessDaysLabel(item.businessDays)}, termin ${item.dueDays} ${item.dueDays === 1 ? "dzień rob." : "dni rob."})`
              : `w terminie (${item.dueDays === 1 ? "1 dzień rob." : `${item.dueDays} dni rob.`})`}
          </dd>
        </dl>
        <p className="text-xs text-slate-500">
          Dostawca odpowiedział inną drogą (telefon, portal)? Kliknij „Załatwione”. Odpowiedź mailem pojawi się tu sama.
        </p>
        {error ? (
          <p className="text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}
      </div>
      {canReply ? (
        <Composer
          key={`${item.kind}|${item.id}`}
          title="Przypomnij dostawcy"
          note={`Pójdzie z ${me} jako „Re:” do wysłanego ${item.kind === "zd" ? "zamówienia" : "zapytania"}, na te same adresy. Termin odpowiedzi liczy się od nowa.`}
          initialBody={reminder}
          signature={signature}
          send={(body) => actionSupplierMailRemind({ kind: item.kind, id: item.id, body })}
          onSent={onDone}
          sendLabel="Wyślij przypomnienie"
        />
      ) : null}
    </div>
  );
}

function Composer({
  title,
  note,
  signature,
  initialBody = "",
  withCc = false,
  send,
  onSent,
  sendLabel = "Wyślij odpowiedź",
}: {
  title: string;
  note: string;
  signature: string;
  initialBody?: string;
  withCc?: boolean;
  send: (body: string, cc?: string) => Promise<{ ok: true } | { ok: false; message: string }>;
  onSent: () => void;
  sendLabel?: string;
}) {
  const bodyId = useId();
  const ccId = useId();
  const [body, setBody] = useState(() => {
    const sig = signature.trim();
    return sig ? `${initialBody}\n\n${sig}`.replace(/^\n+/, "\n\n") : initialBody;
  });
  const [cc, setCc] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (sending || !body.trim()) return;
    setSending(true);
    setError(null);
    const res = await send(body, cc.trim() || undefined).catch(() => ({ ok: false as const, message: "Brak połączenia z serwerem." }));
    setSending(false);
    if (res.ok) onSent();
    else setError(res.message);
  };

  return (
    <form
      className="shrink-0 space-y-2 border-t border-slate-200 bg-slate-50/60 px-4 py-3 sm:px-5"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <label htmlFor={bodyId} className="text-sm font-semibold text-slate-900">
        {title}
      </label>
      <textarea
        id={bodyId}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            void submit();
          }
        }}
        rows={5}
        disabled={sending}
        className={cn(controlFocusClass, "w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm leading-relaxed")}
      />
      {withCc ? (
        <div className="flex items-center gap-2">
          <label htmlFor={ccId} className="shrink-0 text-xs font-medium text-slate-500">
            DW
          </label>
          <input
            id={ccId}
            value={cc}
            onChange={(e) => setCc(e.target.value)}
            disabled={sending}
            inputMode="email"
            autoComplete="off"
            placeholder="opcjonalnie"
            className={cn(controlFocusClass, "min-h-9 w-full rounded-md border border-slate-200 bg-white px-2.5 text-sm")}
          />
        </div>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-500">{note}</p>
        <Button type="submit" disabled={sending || !body.trim()} aria-busy={sending}>
          {sending ? "Wysyłam…" : sendLabel}
        </Button>
      </div>
      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
