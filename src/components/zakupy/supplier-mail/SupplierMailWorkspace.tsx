"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  actionMailForward,
  actionMailBoardMove,
  actionMailBoardSave,
  actionMailTriage,
  actionSupplierMailConversation,
  actionSupplierMailRemind,
  actionSupplierMailReply,
  actionSupplierMailSuggestReply,
  actionSupplierMailTranslate,
  actionSupplierMailView,
  type ConversationMessage,
} from "@/app/actions/supplier-mail";
import { IconCircleCheck, IconMail, IconPaperclip, IconPencil, IconSearch, IconSparkles, IconX } from "@/components/icons/StrokeIcons";
import { Button } from "@/components/ui/Button";
import { Kbd } from "@/components/ui/Kbd";
import { ModalShell } from "@/components/ui/ModalShell";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Spinner } from "@/components/ui/Spinner";
import {
  DetailEmpty,
  DetailHeader as WorkspaceDetailHeader,
  detailLinkClass,
  listColumnClass,
  listRowClass,
  RailCount,
  railClass,
  railGroupLabelClass,
  railItemClass,
  workspaceGridClass,
} from "@/components/zakupy/asystent/workspace";
import { cn } from "@/lib/cn";
import { procurementBoardQuestionHref } from "@/lib/data/department-board-shared";
import { BOARD_COLUMN_LABELS, BOARD_COLUMNS, type BoardColumn } from "@/lib/mail-board/board";
import { CUSTOMS_KIND_LABELS, domainOf, isFreeMailDomain } from "@/lib/mail-board/triage";
import type { GmailAttachmentRef } from "@/lib/google/gmail";
import type { BoardItem, MailConversation, MailPerson, SupplierMailView, WaitingCase } from "@/lib/supplier-mail/data";
import { businessDaysLabel } from "@/lib/suppliers/awaiting-supplier";
import { controlFocusClass } from "@/lib/ui/ontime-theme";
import { prepareMailAttachment } from "@/lib/client/compress-image";
import { EXTRA_ATTACHMENTS_ACCEPT, extraAttachmentsError } from "@/lib/email/extra-attachments";
import { formatFileSize } from "@/components/mail/MailPreview";
import { isInlineImage, isPreviewableImage } from "@/lib/mail/attachments";
import { splitEmphasis } from "@/lib/mail/emphasis";
import { looksPolish } from "@/lib/supplier-mail/translate-ai";

type Scope = "mine" | "all";
/** Kolumna tablicy albo półka „Do przejrzenia” (nieznani nadawcy — sprawa czy nie). */
type ViewTab = BoardColumn | "review";
type UndoInfo = { label: string; undo: () => Promise<{ ok: true } | { ok: false; message: string }> };

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
const DRAG_TYPE = "application/x-ontime-mail-item";

const attachmentUrl = (messageId: string, attachmentId: string) =>
  `/api/operations/supplier-mail/attachment?id=${encodeURIComponent(messageId)}&a=${encodeURIComponent(attachmentId)}`;

const inlineImagesLabel = (n: number) =>
  n === 1 ? "1 obrazek z treści maila" : `${n} ${n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? "obrazki" : "obrazków"} z treści maila`;

function shortWhen(iso: string): string {
  const d = new Date(iso);
  return dayFmt.format(d) === dayFmt.format(new Date()) ? timeFmt.format(d) : dayFmt.format(d);
}

/** „2026-10-13” → „13.10”. */
const shortDay = (key: string) => `${key.slice(8, 10)}.${key.slice(5, 7)}`;

const CATEGORY_TAG: Record<MailConversation["category"], { text: string; className: string }> = {
  confirmation: { text: "Potwierdzenie", className: "bg-emerald-50 text-emerald-800 ring-emerald-200" },
  reply: { text: "Odpowiedź", className: "bg-indigo-50 text-indigo-800 ring-indigo-200" },
  invoice: { text: "Faktura", className: "bg-slate-100 text-slate-700 ring-slate-200" },
  shipping: { text: "Wysyłka", className: "bg-slate-100 text-slate-700 ring-slate-200" },
};

function Tag({ text, className }: { text: string; className: string }) {
  return <span className={cn("shrink-0 rounded px-1.5 py-px text-[11px] font-medium ring-1", className)}>{text}</span>;
}

function ItemTag({ item }: { item: BoardItem }) {
  if (item.ref.type === "case") {
    const w = item.ref.item;
    return (
      <Tag
        text={w.kind === "zd" ? "Wysłane ZD" : "Zapytanie"}
        className="bg-slate-100 text-slate-700 ring-slate-200"
      />
    );
  }
  const c = item.ref.conv;
  const tag = c.bounce
    ? { text: "Mail nie doszedł", className: "bg-red-50 text-red-800 ring-red-200" }
    : c.autoReply
      ? { text: "Autoodpowiedź", className: "bg-slate-100 text-slate-700 ring-slate-200" }
      : CATEGORY_TAG[c.category];
  return <Tag {...tag} />;
}

const itemTitle = (i: BoardItem) => (i.ref.type === "conv" ? i.ref.conv.supplierName : i.ref.item.supplierName);
const itemSubject = (i: BoardItem) =>
  i.ref.type === "conv"
    ? i.ref.conv.subject || "(bez tematu)"
    : i.ref.item.kind === "zd"
      ? i.ref.item.label
      : `Pytanie z tablicy: ${i.ref.item.label}`;
/** Klucz sprawy (ZD / zapytanie), z której rozmowa przejmuje opis przy pierwszym zapisie. */
const inheritKeyOf = (i: BoardItem) =>
  i.ref.type === "conv" && i.ref.conv.caseKind && i.ref.conv.caseId && i.ref.conv.linkedBy !== "supplier"
    ? `${i.ref.conv.caseKind}:${i.ref.conv.caseId}`
    : null;

/** Bez wielkości liter i polskich znaków — „zolw” znajdzie „Żółw”. */
const fold = (t: string) => t.toLocaleLowerCase("pl").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ł/g, "l");

function matchesSearch(i: BoardItem, q: string): boolean {
  const conv = i.ref.type === "conv" ? i.ref.conv : null;
  const hay = [itemTitle(i), itemSubject(i), i.note, i.waitingOn, conv?.zdLabel ?? "", conv?.snippet ?? "", conv?.lastFromEmail ?? ""].join(" ");
  return fold(q)
    .split(/\s+/)
    .filter(Boolean)
    .every((w) => fold(hay).includes(w));
}

/** Kolejność w kolumnie: w Do zrobienia najpierw to, co samo wróciło (zwrot, termin), w Czekam — najbliższy termin. */
function sortColumn(column: BoardColumn, list: BoardItem[]): BoardItem[] {
  const sorted = [...list].sort((a, b) => b.sortAt.localeCompare(a.sortAt));
  if (column === "todo") return sorted.sort((a, b) => Number(Boolean(b.reason)) - Number(Boolean(a.reason)));
  if (column === "waiting") return sorted.sort((a, b) => (a.remindOn ?? "9").localeCompare(b.remindOn ?? "9"));
  return sorted;
}

/**
 * Poczta dostawców jako tablica spraw: Do zrobienia / W trakcie / Czekam / Do zapłaty / Zakończone.
 * Sprawę przeciąga się na zakładkę (albo wybiera kolumnę w szczegółach); poczta sama przesuwa ją z powrotem,
 * gdy przyjdzie nowa wiadomość, gdy odpowiesz albo gdy minie termin „wróć do tego”.
 */
export function SupplierMailWorkspace({
  initialView,
  initialMe,
  initialMeId,
  initialCanReply,
  initialSignature,
  initialPaymentForwardEmail,
  initialSelectedKey = null,
  initialAiAvailable = false,
}: {
  initialView: SupplierMailView;
  initialMe: string | null;
  initialMeId: string;
  initialCanReply: boolean;
  initialSignature: string;
  initialPaymentForwardEmail: string;
  /** Link „?sprawa=…” (np. z odpraw celnych) — od razu otwarta rozmowa. */
  initialSelectedKey?: string | null;
  /** Klucz Gemini na serwerze — przycisk „Zaproponuj odpowiedź” w polu odpowiedzi. */
  initialAiAvailable?: boolean;
}) {
  const [view, setView] = useState(initialView);
  const [me, setMe] = useState(initialMe);
  const [meId, setMeId] = useState(initialMeId);
  const [canReply, setCanReply] = useState(initialCanReply);
  const [signature, setSignature] = useState(initialSignature);
  const [paymentForwardEmail, setPaymentForwardEmail] = useState(initialPaymentForwardEmail);
  const [column, setColumn] = useState<ViewTab>("todo");
  const [scope, setScope] = useState<Scope>("mine");
  const [selectedKey, setSelectedKey] = useState<string | null>(initialSelectedKey);
  const [search, setSearch] = useState("");
  const [dropTarget, setDropTarget] = useState<BoardColumn | null>(null);
  const [syncing, setSyncing] = useState(true);
  const [undo, setUndo] = useState<UndoInfo | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (undoTimer.current) clearTimeout(undoTimer.current);
  }, []);
  const [syncNote, setSyncNote] = useState<string | null>(null);

  const refresh = useCallback((opts: { sync?: boolean; force?: boolean } = {}) => {
    const load = (o: typeof opts): Promise<void> =>
      actionSupplierMailView(o).then((res) => {
        if (!res.ok) {
          setSyncNote(res.message);
          return;
        }
        setView(res.view);
        setMe(res.me);
        setMeId(res.meId);
        setCanReply(res.canReply);
        setSignature(res.signature);
        setPaymentForwardEmail(res.paymentForwardEmail);
        setSyncNote(res.syncErrors.length ? `Nie udało się sprawdzić skrzynki: ${res.syncErrors[0]}` : null);
        // Przebieg trwa w tle (np. pierwsza synchronizacja) — dołączamy do niego; lista rośnie po drodze.
        if (res.syncPending) return load({ sync: true });
      });
    return load(opts)
      .catch(() => setSyncNote("Nie udało się odświeżyć poczty."))
      .finally(() => setSyncing(false));
  }, []);

  // Przy wejściu: nowe maile z Gmaila (najwyżej co 5 min na skrzynkę), lista z bazy już jest.
  useEffect(() => {
    void refresh({ sync: true });
  }, [refresh]);

  const checkNow = () => {
    setSyncing(true);
    void refresh({ sync: true, force: true });
  };

  const people = useMemo(() => new Map(view.people.map((p) => [p.id, p.name])), [view.people]);
  const visible = useMemo(
    () => view.items.filter((i) => scope === "all" || !i.assigneeId || i.assigneeId === meId),
    [view.items, scope, meId]
  );
  const byColumn = useMemo(() => {
    const map = new Map<BoardColumn, BoardItem[]>(BOARD_COLUMNS.map((c) => [c, []]));
    for (const i of visible) map.get(i.column)!.push(i);
    for (const c of BOARD_COLUMNS) map.set(c, sortColumn(c, map.get(c)!));
    return map;
  }, [visible]);
  // Półka jako pozycje listy (ten sam wiersz i ta sama rozmowa), bez kolumny tablicy.
  const reviewItems = useMemo(
    () =>
      view.review
        .filter((c) => scope === "all" || !c.ownerUserId || c.ownerUserId === meId)
        .map(
          (c): BoardItem => ({
            key: `conv:${c.mailbox}|${c.threadId}`,
            ref: { type: "conv", conv: c },
            column: "todo",
            reason: null,
            fresh: false,
            remindOn: null,
            note: "",
            waitingOn: "",
            assigneeId: c.ownerUserId,
            manualColumn: null,
            sortAt: c.lastAt,
          })
        ),
    [view.review, scope, meId]
  );
  const searching = search.trim().length >= 2;
  const order = searching
    ? [...reviewItems, ...visible].filter((i) => matchesSearch(i, search)).sort((a, b) => b.sortAt.localeCompare(a.sortAt))
    : column === "review"
      ? reviewItems
      : byColumn.get(column)!;
  const reviewKeys = useMemo(() => new Set(reviewItems.map((i) => i.key)), [reviewItems]);
  const index = order.findIndex((i) => i.key === selectedKey);
  const reviewSelected = reviewItems.find((i) => i.key === selectedKey) ?? null;
  // Rozmowa agencji / spedytora otwarta z odpraw celnych (poza tablicą).
  const customsConv = view.items.some((i) => i.key === selectedKey)
    ? undefined
    : view.customs.find((c) => `conv:${c.mailbox}|${c.threadId}` === selectedKey);
  const customsSelected: BoardItem | null = customsConv
    ? {
        key: `conv:${customsConv.mailbox}|${customsConv.threadId}`,
        ref: { type: "conv", conv: customsConv },
        column: customsConv.handledVia ? "done" : "todo",
        reason: null,
        fresh: false,
        remindOn: null,
        note: "",
        waitingOn: "",
        assigneeId: customsConv.ownerUserId,
        manualColumn: null,
        sortAt: customsConv.lastAt,
      }
    : null;
  const selected = view.items.find((i) => i.key === selectedKey) ?? reviewSelected ?? customsSelected;

  /** Decyzja z półki: następna pozycja od razu, „Cofnij” przywraca rozmowę (i usuwa zapamiętaną regułę). */
  const triage = useCallback(
    async (conv: MailConversation, decision: "case" | "ignore" | "customs", remember: "none" | "sender" | "domain") => {
      const next = order[index + 1] ?? order[index - 1] ?? null;
      setSelectedKey(next?.key ?? null);
      setView((v) => ({ ...v, review: v.review.filter((c) => c.key !== conv.key) }));
      const res = await actionMailTriage({ mailbox: conv.mailbox, threadId: conv.threadId, decision, remember }).catch(() => null);
      if (!res?.ok) {
        setSyncNote(res?.message ?? "Nie udało się zapisać decyzji.");
        void refresh();
        return;
      }
      if (undoTimer.current) clearTimeout(undoTimer.current);
      const who = res.pattern ? ` · zawsze ${res.pattern}${res.alsoApplied ? ` (+${res.alsoApplied})` : ""}` : "";
      setUndo({
        label: `${conv.supplierName} → ${{ case: "sprawa", ignore: "nie sprawa", customs: "odprawy celne" }[decision]}${who}`,
        undo: () =>
          actionMailTriage({ mailbox: conv.mailbox, threadId: conv.threadId, decision: "review", forgetPattern: res.pattern }).then((r) =>
            r.ok ? { ok: true as const } : r
          ),
      });
      undoTimer.current = setTimeout(() => setUndo(null), 30_000);
      void refresh();
    },
    [index, order, refresh]
  );

  /** Przeniesienie: optymistycznie na liście, potem zapis; „Cofnij” przywraca poprzednią ręczną kolumnę. */
  const move = useCallback(
    async (item: BoardItem, to: BoardColumn) => {
      if (item.column === to) return;
      const prevManual = item.manualColumn;
      const prevRemind = item.remindOn;
      setView((v) => ({ ...v, items: v.items.map((i) => (i.key === item.key ? { ...i, column: to, reason: null } : i)) }));
      if (item.key === selectedKey && item.column === column) {
        const next = order[index + 1] ?? order[index - 1] ?? null;
        setSelectedKey(next?.key ?? null);
      }
      const res = await actionMailBoardMove({ key: item.key, inheritKey: inheritKeyOf(item), column: to }).catch(() => null);
      if (!res?.ok) {
        setSyncNote(res?.message ?? "Nie udało się przenieść sprawy.");
        void refresh();
        return;
      }
      if (undoTimer.current) clearTimeout(undoTimer.current);
      setUndo({
        label: `${itemTitle(item)} → ${BOARD_COLUMN_LABELS[to]}`,
        undo: () => actionMailBoardMove({ key: item.key, column: prevManual, remindOn: prevManual === "waiting" ? prevRemind : null }),
      });
      undoTimer.current = setTimeout(() => setUndo(null), 30_000);
      void refresh();
    },
    [column, index, order, refresh, selectedKey]
  );

  const runUndo = async () => {
    const u = undo;
    if (!u) return;
    setUndo(null);
    const res = await u.undo().catch(() => ({ ok: false as const, message: "Nie udało się cofnąć." }));
    if (!res.ok) setSyncNote(res.message);
    void refresh();
  };

  // Skróty tylko do przeglądania: j / k — następna / poprzednia (poza polami tekstowymi). Bez skrótów
  // zmieniających stan — jeden przypadkowy klawisz nie może przenieść sprawy.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key !== "j" && e.key !== "k") return;
      e.preventDefault();
      const i = index < 0 ? (e.key === "j" ? 0 : order.length - 1) : index + (e.key === "j" ? 1 : -1);
      if (order[i]) setSelectedKey(order[i]!.key);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, order]);

  // Telefon: lista i rozmowa są jedna pod drugą — po wyborze przewijamy do rozmowy.
  const detailRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (selectedKey && window.matchMedia("(max-width: 1023px)").matches) {
      detailRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
    }
  }, [selectedKey]);

  const dropOn = (target: BoardColumn) => (e: React.DragEvent) => {
    e.preventDefault();
    setDropTarget(null);
    const key = e.dataTransfer.getData(DRAG_TYPE);
    // Z półki „Do przejrzenia” nie przeciąga się — najpierw decyzja „To sprawa”.
    const item = view.items.find((i) => i.key === key);
    if (item) void move(item, target);
  };

  const panel =
    selected?.ref.type === "conv" || selected?.ref.type === "case" ? (
      <BoardPanel key={`panel-${selected.key}`} item={selected} people={view.people} onMove={(to) => void move(selected, to)} onSaved={() => void refresh()} />
    ) : null;

  const columnTab = (c: ViewTab, label: string, count: number, tone: "attention" | "info" | "neutral") => (
    <button
      key={c}
      type="button"
      role="tab"
      aria-selected={column === c}
      onClick={() => {
        setColumn(c);
        setSelectedKey(null);
      }}
      onDragOver={
        c === "review"
          ? undefined
          : (e) => {
              if (!e.dataTransfer.types.includes(DRAG_TYPE)) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              setDropTarget(c);
            }
      }
      onDragLeave={c === "review" ? undefined : () => setDropTarget((t) => (t === c ? null : t))}
      onDrop={c === "review" ? undefined : dropOn(c)}
      className={cn(railItemClass(column === c), dropTarget === c && "bg-indigo-50 text-indigo-900 ring-2 ring-indigo-400")}
    >
      {label}
      <RailCount value={count} tone={tone} />
    </button>
  );

  return (
    <div className={workspaceGridClass}>
      <nav aria-label="Sprawy" className={railClass}>
        <p className={cn(railGroupLabelClass, "hidden 2xl:block")}>Sprawy</p>
        <div role="tablist" aria-label="Sprawy" className="flex min-w-0 gap-1 overflow-x-auto lg:shrink-0 lg:overflow-visible 2xl:flex-col">
          {reviewItems.length || column === "review" ? columnTab("review", "Do przejrzenia", reviewItems.length, "info") : null}
          {BOARD_COLUMNS.map((c) => columnTab(c, BOARD_COLUMN_LABELS[c], byColumn.get(c)!.length, c === "todo" ? "attention" : "neutral"))}
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 lg:shrink-0 2xl:mt-auto 2xl:flex-col 2xl:items-stretch 2xl:gap-3">
          <SegmentedControl
            value={scope}
            onChange={setScope}
            ariaLabel="Czyje sprawy"
            density="compact"
            className="2xl:w-full 2xl:[&>button]:flex-1"
            options={[
              { value: "mine", label: "Moje" },
              { value: "all", label: "Wszystkie" },
            ]}
          />
          <p className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-slate-500" role="status" aria-live="polite">
            {syncing ? (
              <>
                <Spinner size="sm" /> Sprawdzam skrzynkę…
              </>
            ) : (
              <>
                <span className="truncate">
                  {view.sync.at ? `Skrzynka sprawdzona ${shortWhen(view.sync.at)}` : "Skrzynka jeszcze nie była sprawdzana"}
                </span>
                <span aria-hidden className="text-slate-300 2xl:hidden">
                  ·
                </span>
                <button type="button" onClick={checkNow} className="shrink-0 rounded font-medium text-indigo-700 hover:underline">
                  Sprawdź teraz
                </button>
              </>
            )}
          </p>
          {!me ? (
            <p className="w-full text-xs leading-relaxed text-slate-600 2xl:w-auto">
              Połącz swojego Gmaila w{" "}
              <Link href="/ustawienia" className="font-medium text-indigo-700 underline">
                Ustawieniach
              </Link>
              , żeby odpowiadać dostawcom z OnTime.
            </p>
          ) : null}
        </div>
      </nav>

      <div className={cn(listColumnClass, selected ? "hidden lg:block" : "block")}>
        <div className="sticky top-0 z-10 border-b border-slate-100 bg-white/95 px-3 py-2 backdrop-blur-sm">
          <label htmlFor="mail-board-search" className="sr-only">
            Szukaj sprawy
          </label>
          <div className="relative">
            <IconSearch size={14} aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              id="mail-board-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Szukaj: dostawca, temat, ZD, opis…"
              className={cn(controlFocusClass, "min-h-9 w-full rounded-md border border-slate-200 bg-white pl-8 pr-2.5 text-sm")}
            />
          </div>
        </div>
        {/* Błąd z ostatniego przebiegu w tle (odpytywanie) — inaczej skrzynka mogła milczeć bez śladu. */}
        {syncNote || view.sync.error ? (
          <p className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs leading-relaxed text-amber-900" role="alert">
            {syncNote ?? `Ostatnie sprawdzenie skrzynki nie powiodło się: ${view.sync.error}`}
          </p>
        ) : null}
        <BoardList
          column={column}
          items={order}
          searching={searching}
          reviewKeys={reviewKeys}
          draggable={column !== "review" && !searching}
          people={scope === "all" ? people : null}
          selectedKey={selectedKey}
          onSelect={setSelectedKey}
        />
      </div>

      <div ref={detailRef} className={cn("min-h-0 scroll-mt-20 flex-col", selected ? "flex" : "hidden lg:flex")}>
        {reviewSelected && reviewSelected.ref.type === "conv" ? (
          <ConversationDetail
            key={reviewSelected.key}
            item={reviewSelected}
            conv={reviewSelected.ref.conv}
            me={me}
            canReply={false}
            paymentForwardEmail=""
            panel={<TriageBar key={`triage-${reviewSelected.key}`} conv={reviewSelected.ref.conv} onDecide={triage} />}
            hideDone
            onBack={() => setSelectedKey(null)}
            onMove={() => undefined}
            onChanged={() => void refresh()}
          />
        ) : customsSelected && customsSelected.ref.type === "conv" ? (
          <ConversationDetail
            key={customsSelected.key}
            item={customsSelected}
            conv={customsSelected.ref.conv}
            me={me}
            canReply={canReply}
            paymentForwardEmail={paymentForwardEmail}
            aiAvailable={initialAiAvailable}
            panel={
              <p className="border-b border-slate-200 bg-amber-50/60 px-4 py-2.5 text-sm text-amber-950 sm:px-5">
                Agencja / spedytor - sprawa z{" "}
                <Link href="/zakupy/odprawy" className="font-medium underline">
                  odpraw celnych
                </Link>
                : {CUSTOMS_KIND_LABELS[customsSelected.ref.conv.customsKind ?? "request"]}.
              </p>
            }
            onBack={() => setSelectedKey(null)}
            onMove={(to) => void move(customsSelected, to)}
            onChanged={() => void refresh()}
          />
        ) : selected?.ref.type === "conv" ? (
          <ConversationDetail
            key={selected.key}
            item={selected}
            conv={selected.ref.conv}
            me={me}
            canReply={canReply}
            paymentForwardEmail={paymentForwardEmail}
            aiAvailable={initialAiAvailable}
            panel={panel}
            onBack={() => setSelectedKey(null)}
            onMove={(to) => void move(selected, to)}
            onChanged={() => void refresh()}
          />
        ) : selected?.ref.type === "case" ? (
          <CaseDetail
            key={selected.key}
            item={selected.ref.item}
            me={me}
            signature={signature}
            canReply={canReply}
            panel={panel}
            done={selected.column === "done"}
            onBack={() => setSelectedKey(null)}
            onMove={(to) => void move(selected, to)}
            onChanged={() => void refresh()}
          />
        ) : (
          <DetailEmpty
            icon={<IconMail size={22} />}
            title="Wybierz sprawę z listy"
            hint="Przeciągnij sprawę na kolumnę po lewej, żeby ją przenieść. Na telefonie zmienisz kolumnę w szczegółach sprawy."
            className="flex-1"
          >
            <p className="mt-4 flex items-center gap-1.5 text-xs text-slate-500">
              <Kbd>j</Kbd>
              <Kbd>k</Kbd>
              <span>następna / poprzednia sprawa</span>
            </p>
          </DetailEmpty>
        )}
      </div>

      {/* „Cofnij” po przeniesieniu / decyzji — 30 s: nad dolną nawigacją na telefonie; na desktopie dołem nad listą
          (jak w Gmailu) — nie zasłania paska kolumn ani pola odpowiedzi. Od 2xl lista zaczyna się za szyną 14rem. */}
      {undo ? (
        <div className="pointer-events-none fixed inset-x-3 bottom-[calc(1rem+var(--mobile-bottom-chrome,0px))] z-40 flex justify-center lg:absolute lg:inset-x-auto lg:bottom-4 lg:left-4 lg:justify-start 2xl:left-[15rem]">
          <div
            role="status"
            className="pointer-events-auto flex max-w-[min(100%,28rem)] items-center gap-3 rounded-md border border-slate-200/90 bg-white px-3 py-2 text-sm text-slate-900 shadow-[var(--shadow-card-elevated)]"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-indigo-600 text-white">
              <IconCircleCheck size={16} strokeWidth={2.25} aria-hidden />
            </span>
            <span className="min-w-0 truncate">{undo.label}</span>
            <Button type="button" size="sm" onClick={() => void runUndo()} className="shrink-0">
              Cofnij
            </Button>
            <button
              type="button"
              onClick={() => setUndo(null)}
              aria-label="Zamknij"
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
            >
              <IconX size={14} aria-hidden />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const EMPTY: Record<ViewTab, string> = {
  review: "Wszystko przejrzane - nowi nadawcy pojawią się tutaj.",
  todo: "Nic nie czeka na Twój ruch.",
  doing: "Nic nie jest w trakcie.",
  waiting: "Na nic nie czekasz.",
  invoices: "Brak faktur do wpisania do Subiekta.",
  to_pay: "Brak przedpłat do przekazania do zapłaty.",
  done: "Brak spraw zakończonych w ostatnich 14 dniach.",
};

function BoardList({
  column,
  items,
  searching,
  reviewKeys,
  draggable,
  people,
  selectedKey,
  onSelect,
}: {
  column: ViewTab;
  items: BoardItem[];
  /** Wyniki wyszukiwania ze wszystkich kolumn — przy każdym widać, gdzie leży. */
  searching: boolean;
  reviewKeys: ReadonlySet<string>;
  draggable: boolean;
  /** Tylko w widoku „Wszystkie” — kto obsługuje. */
  people: Map<string, string> | null;
  selectedKey: string | null;
  onSelect: (key: string) => void;
}) {
  if (!items.length) {
    return <p className="px-4 py-10 text-center text-sm text-slate-500">{searching ? "Nic nie pasuje do wyszukiwania." : EMPTY[column]}</p>;
  }
  return (
    <ul className="divide-y divide-slate-100">
      {items.map((i) => {
        const conv = i.ref.type === "conv" ? i.ref.conv : null;
        const wc: WaitingCase | null = i.ref.type === "case" ? i.ref.item : null;
        const selected = i.key === selectedKey;
        return (
          <li
            key={i.key}
            draggable={draggable}
            onDragStart={(e) => {
              e.dataTransfer.setData(DRAG_TYPE, i.key);
              e.dataTransfer.effectAllowed = "move";
            }}
          >
            <button
              type="button"
              onClick={() => onSelect(i.key)}
              aria-current={selected ? "true" : undefined}
              className={cn(listRowClass(selected), draggable && "cursor-grab active:cursor-grabbing")}
            >
              <span className="flex items-baseline justify-between gap-2">
                <span className={cn("min-w-0 truncate text-sm text-slate-900", column === "todo" || column === "review" ? "font-semibold" : "font-medium")}>
                  {itemTitle(i)}
                </span>
                <span className="shrink-0 text-xs tabular-nums text-slate-500">{shortWhen(i.sortAt)}</span>
              </span>
              <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
                {searching ? (
                  <Tag
                    text={reviewKeys.has(i.key) ? "Do przejrzenia" : BOARD_COLUMN_LABELS[i.column]}
                    className="bg-white text-slate-700 ring-slate-300"
                  />
                ) : null}
                {i.reason ? <Tag text={i.reason} className="bg-amber-50 text-amber-900 ring-amber-200" /> : <ItemTag item={i} />}
                {i.fresh ? <Tag text="Nowa wiadomość" className="bg-amber-50 text-amber-900 ring-amber-200" /> : null}
                {conv?.zdLabel ? <span className="truncate text-xs font-medium text-slate-600">{conv.zdLabel}</span> : null}
                {conv?.attachments ? <IconPaperclip size={12} className="shrink-0 text-slate-400" aria-label="Załączniki" /> : null}
                {conv && conv.count > 1 ? <span className="text-xs tabular-nums text-slate-400">{conv.count}</span> : null}
                {wc && !i.reason ? (
                  <span className="text-xs text-slate-500">
                    {wc.businessDays === 0 ? "wysłano dziś" : `wysłano ${businessDaysLabel(wc.businessDays)} temu`}
                  </span>
                ) : null}
                {people && i.assigneeId ? <span className="ml-auto text-xs text-slate-500">{people.get(i.assigneeId) ?? ""}</span> : null}
              </span>
              <span className="mt-0.5 block truncate text-sm text-slate-700">{itemSubject(i)}</span>
              {i.note ? (
                <span className="mt-0.5 block truncate text-xs font-medium text-indigo-900">{i.note}</span>
              ) : conv ? (
                <span className="block truncate text-xs text-slate-500">{conv.snippet}</span>
              ) : null}
              {i.column === "waiting" ? (
                <span className="mt-0.5 block truncate text-xs text-slate-500">
                  Czekam na {i.waitingOn}
                  {i.remindOn ? ` · do ${shortDay(i.remindOn)}` : ""}
                </span>
              ) : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** Stan sprawy: kolumna (dostępna bez przeciągania — telefon, klawiatura), opis, na kogo czekam, kto obsługuje. */
function BoardPanel({
  item,
  people,
  onMove,
  onSaved,
}: {
  item: BoardItem;
  people: MailPerson[];
  onMove: (to: BoardColumn) => void;
  onSaved: () => void;
}) {
  const ids = { column: useId(), note: useId(), waitingOn: useId(), remindOn: useId(), assignee: useId() };
  const [note, setNote] = useState(item.note);
  const [waitingOn, setWaitingOn] = useState(item.waitingOn);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async (patch: Parameters<typeof actionMailBoardSave>[0]) => {
    setSaving(true);
    setError(null);
    const res = await actionMailBoardSave({ ...patch, inheritKey: inheritKeyOf(item) }).catch(() => null);
    setSaving(false);
    if (res?.ok) onSaved();
    else setError(res?.message ?? "Nie udało się zapisać.");
  };

  const field = cn(controlFocusClass, "min-h-9 w-full rounded-md border border-slate-200 bg-white px-2.5 text-sm");
  return (
    <div className="space-y-2 border-b border-slate-200 bg-slate-50/60 px-4 py-3 sm:px-5">
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[11rem_11rem_minmax(0,1fr)]">
        <div>
          <label htmlFor={ids.column} className="text-xs font-medium text-slate-500">
            Kolumna
          </label>
          <select id={ids.column} value={item.column} onChange={(e) => onMove(e.target.value as BoardColumn)} className={cn(field, "mt-1")}>
            {BOARD_COLUMNS.map((c) => (
              <option key={c} value={c}>
                {BOARD_COLUMN_LABELS[c]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={ids.assignee} className="text-xs font-medium text-slate-500">
            Obsługuje
          </label>
          <select
            id={ids.assignee}
            value={item.assigneeId ?? ""}
            onChange={(e) => void save({ key: item.key, assigneeId: e.target.value || null })}
            className={cn(field, "mt-1")}
          >
            <option value="">nikt</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2 xl:col-span-1">
          <label htmlFor={ids.note} className="text-xs font-medium text-slate-500">
            Opis sprawy
          </label>
          <textarea
            id={ids.note}
            value={note}
            maxLength={2000}
            rows={1}
            placeholder="Co to jest i co dalej - np. czekam na proformę, potem zapłata"
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => note.trim() !== item.note && void save({ key: item.key, note })}
            className={cn(controlFocusClass, "mt-1 min-h-9 w-full resize-y rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm leading-relaxed")}
          />
        </div>
      </div>
      {item.column === "waiting" ? (
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_10rem]">
          <div>
            <label htmlFor={ids.waitingOn} className="text-xs font-medium text-slate-500">
              Czekam na
            </label>
            <input
              id={ids.waitingOn}
              value={waitingOn}
              maxLength={200}
              onChange={(e) => setWaitingOn(e.target.value)}
              onBlur={() => waitingOn.trim() !== item.waitingOn && void save({ key: item.key, waitingOn })}
              className={cn(field, "mt-1")}
            />
          </div>
          <div>
            <label htmlFor={ids.remindOn} className="text-xs font-medium text-slate-500">
              Wróć do tego
            </label>
            <input
              id={ids.remindOn}
              type="date"
              value={item.remindOn ?? ""}
              onChange={(e) => void save({ key: item.key, remindOn: e.target.value || null })}
              className={cn(field, "mt-1 tabular-nums")}
            />
          </div>
        </div>
      ) : null}
      {saving ? (
        <p className="text-xs text-slate-500" role="status">
          Zapisuję…
        </p>
      ) : error ? (
        <p className="text-xs text-red-700" role="alert">
          {error}
        </p>
      ) : null}
    </div>
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
    <WorkspaceDetailHeader
      title={title}
      subtitle={subtitle}
      back={{ onClick: onBack }}
      actions={
        <>
          {supplierId ? (
            <Link href={`/podsumowanie?supplierId=${encodeURIComponent(supplierId)}`} className={detailLinkClass}>
              Karta dostawcy
            </Link>
          ) : null}
          {children}
        </>
      }
    />
  );
}

function ConversationDetail({
  item,
  conv,
  me,
  canReply,
  paymentForwardEmail,
  aiAvailable = false,
  panel,
  hideDone = false,
  onBack,
  onMove,
  onChanged,
}: {
  item: BoardItem;
  conv: MailConversation;
  /** Półka „Do przejrzenia” — bez przenoszenia, najpierw decyzja. */
  hideDone?: boolean;
  me: string | null;
  canReply: boolean;
  paymentForwardEmail: string;
  aiAvailable?: boolean;
  panel: React.ReactNode;
  onBack: () => void;
  onMove: (to: BoardColumn) => void;
  onChanged: () => void;
}) {
  const [messages, setMessages] = useState<ConversationMessage[] | null>(null);
  // Przekazanie całej rozmowy albo jednej wiadomości (przycisk przy wiadomości).
  const [forwarding, setForwarding] = useState<false | "thread" | { messageId: string }>(false);
  // Po przejściu do następnej rozmowy „Załatwione” jest pod kursorem — chwila przerwy chroni przed seryjnym zamykaniem.
  const armed = useArmedAfterMount();
  const [signature, setSignature] = useState("");
  const [error, setError] = useState<string | null>(null);

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

  const foreign = me ? me.toLowerCase() !== conv.mailbox : true;
  const hasSupplierMessage = Boolean(messages?.some((m) => m.kind !== "bounce" && m.kind !== "mine"));

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
            className={detailLinkClass}
          >
            Przekaż handlowcowi
          </Link>
        ) : null}
        {canReply && !hideDone ? (
          <button
            type="button"
            onClick={() => setForwarding((v) => (v ? false : "thread"))}
            aria-pressed={Boolean(forwarding)}
            className={detailLinkClass}
          >
            Przekaż dalej
          </button>
        ) : null}
        {item.column !== "done" && !hideDone ? (
          <Button type="button" size="sm" variant="secondary" disabled={!armed} onClick={() => onMove("done")}>
            {item.column === "invoices" ? "Wpisana do Subiekta" : "Zakończone"}
          </Button>
        ) : null}
      </DetailHeader>
      {panel}

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
        {messages?.map((m) => (
          <MessageCard
            key={m.id}
            m={m}
            aiAvailable={aiAvailable}
            onForward={canReply && !hideDone && m.kind !== "mine" ? () => setForwarding({ messageId: m.id }) : undefined}
          />
        ))}
        {conv.mailbox !== me && me ? (
          <p className="text-xs text-slate-500">Rozmowa jest w skrzynce {conv.mailbox}.</p>
        ) : null}
      </div>

      {forwarding && canReply ? (
        <ForwardForm
          key={`fwd-${conv.key}-${forwarding === "thread" ? "thread" : forwarding.messageId}`}
          conv={conv}
          me={me}
          purpose="plain"
          defaultTo=""
          message={forwarding === "thread" ? null : (messages?.find((x) => x.id === forwarding.messageId) ?? null)}
          onSent={onChanged}
          onCancel={() => setForwarding(false)}
        />
      ) : item.column === "to_pay" && canReply ? (
        <ForwardForm key={conv.key} conv={conv} me={me} purpose="payment" defaultTo={paymentForwardEmail} onSent={onChanged} />
      ) : messages && hasSupplierMessage && canReply ? (
        <Composer
          key={conv.key}
          title={`Odpowiedz ${conv.supplierName}`}
          note={`Pójdzie z ${me} jako „Re:” do ostatniej wiadomości dostawcy${foreign ? `; ${conv.mailbox} dostanie kopię` : ""}.`}
          signature={signature}
          withCc
          withFiles
          suggest={aiAvailable ? (notes) => actionSupplierMailSuggestReply({ mailbox: conv.mailbox, threadId: conv.threadId, notes }) : undefined}
          send={(body, cc, files) => actionSupplierMailReply({ mailbox: conv.mailbox, threadId: conv.threadId, body, cc, files })}
          onSent={onChanged}
        />
      ) : null}
    </div>
  );
}

function MessageCard({ m, aiAvailable = false, onForward }: { m: ConversationMessage; aiAvailable?: boolean; onForward?: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const original = m.text?.trim() || m.snippet;
  // Tłumaczenie na polski (AI) — w miejscu treści, z powrotem do oryginału jednym kliknięciem.
  const [translation, setTranslation] = useState<string | null>(null);
  const [showTranslation, setShowTranslation] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [translateError, setTranslateError] = useState<string | null>(null);
  const canTranslate = aiAvailable && m.kind !== "mine" && !looksPolish(original);
  const translate = async () => {
    if (translation) {
      setShowTranslation(true);
      return;
    }
    setTranslating(true);
    setTranslateError(null);
    const res = await actionSupplierMailTranslate({ text: original, subject: m.subject }).catch(() => ({ ok: false as const, message: "Brak połączenia z serwerem." }));
    setTranslating(false);
    if (!res.ok) {
      setTranslateError(res.message);
      return;
    }
    setTranslation(res.translation);
    setShowTranslation(true);
  };
  const text = showTranslation && translation ? translation : original;
  const long = text.length > 700 || text.split("\n").length > 14;
  const files = m.attachments.filter((a) => !isInlineImage(a));
  const inlineImages = m.attachments.filter(isInlineImage);
  // Podgląd obrazka w nakładce — bez nawigacji, „Wstecz” nie wyrzuca z wątku.
  const [preview, setPreview] = useState<GmailAttachmentRef | null>(null);
  return (
    <article
      className={cn(
        "rounded-md px-3.5 py-3 ring-1",
        m.kind === "bounce"
          ? "bg-red-50/60 ring-red-200"
          : m.kind === "auto"
            ? "bg-slate-50 ring-slate-200"
            : m.kind === "mine"
              ? "ml-6 bg-indigo-50/50 ring-indigo-100"
              : "bg-white ring-slate-200"
      )}
    >
      <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-xs">
        <span className="min-w-0 font-medium text-slate-900">
          {m.kind === "mine" ? (
            <>
              Nasza odpowiedź <span className="font-normal text-slate-500">do {m.to}</span>
            </>
          ) : (
            <>
              {m.kind === "bounce" ? "Mail nie doszedł · " : m.kind === "auto" ? "Autoodpowiedź · " : ""}
              {m.fromName || m.from} <span className="font-normal text-slate-500">{m.fromName ? `<${m.from}>` : ""}</span>
            </>
          )}
        </span>
        <span className="flex items-center gap-2">
          <time className="tabular-nums text-slate-500" dateTime={m.receivedAt}>
            {fullFmt.format(new Date(m.receivedAt))}
          </time>
          {canTranslate ? (
            <button
              type="button"
              onClick={() => (showTranslation ? setShowTranslation(false) : void translate())}
              disabled={translating}
              className="inline-flex items-center gap-1 rounded font-medium text-indigo-700 hover:underline disabled:opacity-50"
            >
              {translating ? <Spinner size="sm" /> : null}
              {translating ? "Tłumaczę…" : showTranslation ? "Oryginał" : "Przetłumacz"}
            </button>
          ) : null}
          {onForward ? (
            <button type="button" onClick={onForward} className="rounded font-medium text-indigo-700 hover:underline">
              Przekaż
            </button>
          ) : null}
        </span>
      </header>
      {showTranslation && translation ? (
        <p className="mt-1.5 text-[11px] font-medium text-indigo-700">Tłumaczenie AI na polski — oryginał pod „Oryginał”.</p>
      ) : null}
      {translateError ? (
        <p className="mt-1.5 text-xs text-red-700" role="alert">
          {translateError}
        </p>
      ) : null}
      <p className={cn("mt-2 whitespace-pre-line break-words text-sm leading-relaxed text-slate-800", long && !expanded && "line-clamp-[14]")}>
        {splitEmphasis(text).map((run, i) =>
          run.bold ? (
            <strong key={i} className="font-semibold text-slate-900">
              {run.text}
            </strong>
          ) : (
            run.text
          )
        )}
      </p>
      {long ? (
        <button type="button" className="mt-1 text-xs font-medium text-indigo-700 hover:underline" onClick={() => setExpanded((v) => !v)}>
          {expanded ? "Zwiń" : "Pokaż całość"}
        </button>
      ) : null}
      {/* Dokumenty jako chipy, zdjęcia jako miniatury; logo z podpisu i obrazki z treści schowane pod zwijaną listą. */}
      {files.length ? (
        <ul className="mt-2 flex flex-wrap items-center gap-1.5">
          {files.map((a) => (
            <li key={a.attachmentId}>
              {isPreviewableImage(a) ? (
                <button
                  type="button"
                  onClick={() => setPreview(a)}
                  title={a.filename}
                  className="block overflow-hidden rounded-md ring-1 ring-slate-200 transition-shadow hover:ring-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/45"
                >
                  {/* Załącznik z własnego API za sesją — next/image nie ma tu czego optymalizować. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={attachmentUrl(m.id, a.attachmentId)} alt={a.filename} loading="lazy" className="h-20 w-20 bg-slate-100 object-cover" />
                </button>
              ) : (
                <a
                  href={attachmentUrl(m.id, a.attachmentId)}
                  target="_blank"
                  rel="noopener"
                  className="inline-flex max-w-[16rem] items-center gap-1 rounded bg-slate-50 px-2 py-1 text-xs text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100"
                  title={a.filename}
                >
                  <IconPaperclip size={12} aria-hidden className="shrink-0 text-slate-400" />
                  <span className="truncate">{a.filename}</span>
                </a>
              )}
            </li>
          ))}
        </ul>
      ) : null}
      {/* Logo i obrazki z treści zawsze widoczne (małe) — po nich łatwiej poznać, od kogo mail; nie liczą się jako załączniki. */}
      {inlineImages.length ? (
        <ul className="mt-2 flex flex-wrap items-center gap-1.5" aria-label={inlineImagesLabel(inlineImages.length)}>
            {inlineImages.map((a) => (
              <li key={a.attachmentId}>
                {isPreviewableImage(a) ? (
                  <button
                    type="button"
                    onClick={() => setPreview(a)}
                    title={a.filename}
                    className="block rounded-md ring-1 ring-slate-200 hover:ring-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/45"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={attachmentUrl(m.id, a.attachmentId)} alt={a.filename} loading="lazy" className="h-10 max-w-[9rem] rounded-md bg-white object-contain" />
                  </button>
                ) : (
                  <a href={attachmentUrl(m.id, a.attachmentId)} target="_blank" rel="noopener" className="block rounded-md px-2 py-1 text-xs text-slate-600 ring-1 ring-slate-200 hover:ring-slate-400">
                    {a.filename}
                  </a>
                )}
              </li>
            ))}
        </ul>
      ) : null}
      <ModalShell
        open={preview !== null}
        onClose={() => setPreview(null)}
        title={preview?.filename ?? "Obrazek"}
        size="xl"
        titleId={`preview-${m.id}`}
        footer={
          preview ? (
            <a href={attachmentUrl(m.id, preview.attachmentId)} target="_blank" rel="noopener" className={detailLinkClass}>
              Otwórz w nowej karcie
            </a>
          ) : null
        }
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={attachmentUrl(m.id, preview.attachmentId)} alt={preview.filename} className="mx-auto max-h-[75vh] w-auto max-w-full rounded-md" />
        ) : null}
      </ModalShell>
    </article>
  );
}

function CaseDetail({
  item,
  me,
  signature,
  canReply,
  panel,
  done,
  onBack,
  onMove,
  onChanged,
}: {
  item: WaitingCase;
  me: string | null;
  signature: string;
  canReply: boolean;
  panel: React.ReactNode;
  done: boolean;
  onBack: () => void;
  onMove: (to: BoardColumn) => void;
  onChanged: () => void;
}) {
  const armed = useArmedAfterMount();

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
            className={detailLinkClass}
          >
            Wątek na tablicy
          </Link>
        ) : null}
        {!done ? (
          <Button type="button" size="sm" variant="secondary" disabled={!armed} onClick={() => onMove("done")}>
            Zakończone
          </Button>
        ) : null}
      </DetailHeader>
      {panel}
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
          Dostawca odpowiedział inną drogą (telefon, portal)? Kliknij „Zakończone”. Odpowiedź mailem pojawi się tu sama.
        </p>
      </div>
      {canReply && !done ? (
        <Composer
          key={`${item.kind}|${item.id}`}
          title="Przypomnij dostawcy"
          note={`Pójdzie z ${me} jako „Re:” do wysłanego ${item.kind === "zd" ? "zamówienia" : "zapytania"}, na te same adresy. Termin odpowiedzi liczy się od nowa.`}
          initialBody={reminder}
          signature={signature}
          send={(body) => actionSupplierMailRemind({ kind: item.kind, id: item.id, body })}
          onSent={onChanged}
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
  withFiles = false,
  suggest,
  send,
  onSent,
  sendLabel = "Wyślij odpowiedź",
}: {
  title: string;
  note: string;
  signature: string;
  initialBody?: string;
  withCc?: boolean;
  /** „Dodaj pliki” — PDF, Excel, zdjęcia (zdjęcia zmniejszone w przeglądarce). */
  withFiles?: boolean;
  /** AI: szkic odpowiedzi z rozmowy; to, co już wpisano, idzie jako notatka „co przekazać”. */
  suggest?: (notes: string) => Promise<{ ok: true; draft: string } | { ok: false; message: string }>;
  send: (body: string, cc?: string, files?: File[]) => Promise<{ ok: true } | { ok: false; message: string }>;
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
  const [files, setFiles] = useState<File[]>([]);
  const [preparing, setPreparing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Zwinięte do jednego wiersza: treść rozmowy ma całą wysokość, dopóki nie zaczniesz pisać.
  const [open, setOpen] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  /** Treść sprzed propozycji AI — „Przywróć moją wersję”. */
  const [beforeSuggest, setBeforeSuggest] = useState<string | null>(null);

  const sig = signature.trim();
  const withoutSignature = (text: string) => (sig && text.trimEnd().endsWith(sig) ? text.trimEnd().slice(0, -sig.length).trimEnd() : text);
  const runSuggest = async () => {
    if (!suggest || suggesting) return;
    setSuggesting(true);
    setError(null);
    const res = await suggest(withoutSignature(body)).catch(() => ({ ok: false as const, message: "Brak połączenia z serwerem." }));
    setSuggesting(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    setBeforeSuggest(body);
    setBody(sig ? `${res.draft}\n\n${sig}` : res.draft);
    bodyRef.current?.focus();
  };
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (open) bodyRef.current?.focus();
  }, [open]);

  const addFiles = async (list: FileList) => {
    setError(null);
    setPreparing(true);
    const prepared = await Promise.all(Array.from(list).map(prepareMailAttachment));
    setPreparing(false);
    const problem = extraAttachmentsError([...files, ...prepared]);
    if (problem) setError(problem);
    else setFiles((prev) => [...prev, ...prepared]);
  };

  const submit = async () => {
    if (sending || preparing || !body.trim()) return;
    setSending(true);
    setError(null);
    const res = await send(body, cc.trim() || undefined, files.length ? files : undefined).catch(() => ({
      ok: false as const,
      message: "Brak połączenia z serwerem (pliki ponad ~1 MB mogą nie przejść przez serwer - zmniejsz PDF).",
    }));
    setSending(false);
    if (res.ok) onSent();
    else setError(res.message);
  };

  if (!open) {
    return (
      <div className="shrink-0 border-t border-slate-200 bg-slate-50/60 px-4 py-2.5 sm:px-5">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(
            controlFocusClass,
            "flex min-h-10 w-full items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-left text-sm text-slate-500 shadow-[var(--shadow-card)] transition-colors hover:border-slate-300 hover:text-slate-700"
          )}
        >
          <IconPencil size={14} aria-hidden className="shrink-0 text-slate-400" />
          <span className="truncate">{title}…</span>
        </button>
      </div>
    );
  }

  return (
    <form
      className="shrink-0 space-y-2 border-t border-slate-200 bg-slate-50/60 px-4 py-3 sm:px-5"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={bodyId} className="text-sm font-semibold text-slate-900">
          {title}
        </label>
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={sending}
          className="rounded-md px-1.5 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
        >
          Zwiń
        </button>
      </div>
      <textarea
        ref={bodyRef}
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
      {withFiles ? (
        <div className="space-y-1.5">
          {files.length ? (
            <ul className="flex flex-wrap gap-1.5">
              {files.map((f, i) => (
                <li key={`${i}-${f.name}`} className="inline-flex max-w-[16rem] items-center gap-1 rounded bg-white px-2 py-1 text-xs text-slate-700 ring-1 ring-slate-200">
                  <IconPaperclip size={12} aria-hidden className="shrink-0 text-slate-400" />
                  <span className="truncate">{f.name}</span>
                  <span className="shrink-0 tabular-nums text-slate-400">{formatFileSize(f.size)}</span>
                  <button
                    type="button"
                    onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                    disabled={sending}
                    aria-label={`Usuń ${f.name}`}
                    className="ml-0.5 rounded px-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <input
            ref={fileRef}
            type="file"
            multiple
            accept={EXTRA_ATTACHMENTS_ACCEPT}
            className="sr-only"
            tabIndex={-1}
            onChange={(e) => {
              if (e.target.files?.length) void addFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <div className="flex flex-wrap items-center gap-x-1 gap-y-1">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={sending || preparing}
              className="inline-flex min-h-8 items-center gap-1.5 rounded px-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
            >
              {preparing ? <Spinner size="sm" /> : <IconPaperclip size={14} aria-hidden />}
              {preparing ? "Przygotowuję pliki…" : "Dodaj pliki"}
            </button>
            {suggest ? (
              <button
                type="button"
                onClick={() => void runSuggest()}
                disabled={sending || suggesting}
                title="AI pisze szkic z rozmowy; to, co już wpisałeś, traktuje jako notatkę, co przekazać"
                className="inline-flex min-h-8 items-center gap-1.5 rounded px-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
              >
                {suggesting ? <Spinner size="sm" /> : <IconSparkles size={14} aria-hidden />}
                {suggesting ? "Piszę szkic…" : "Zaproponuj odpowiedź"}
              </button>
            ) : null}
            {beforeSuggest !== null ? (
              <button
                type="button"
                onClick={() => {
                  setBody(beforeSuggest);
                  setBeforeSuggest(null);
                }}
                disabled={sending}
                className="inline-flex min-h-8 items-center rounded px-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              >
                Przywróć moją wersję
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-500">{note}</p>
        <Button type="submit" disabled={sending || preparing || !body.trim()} aria-busy={sending}>
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

/**
 * Przekazanie rozmowy z załącznikami. `payment` (Do zapłaty): adres zapamiętuje się po pierwszym razie,
 * sprawa przechodzi do Czekam na płatność.
 */
function ForwardForm({
  conv,
  me,
  purpose,
  defaultTo,
  message = null,
  onSent,
  onCancel,
}: {
  conv: MailConversation;
  /** Skrzynka zalogowanej osoby — z niej idzie przekazanie. */
  me: string | null;
  purpose: "payment" | "plain";
  /** Tylko ta wiadomość (z jej załącznikami); null = cała rozmowa. */
  message?: ConversationMessage | null;
  defaultTo: string;
  onSent: () => void;
  onCancel?: () => void;
}) {
  const payment = purpose === "payment";
  const toId = useId();
  const noteId = useId();
  const [to, setTo] = useState(defaultTo);
  const [note, setNote] = useState(
    payment ? "Dzień dobry,\n\nproszę o opłacenie faktury w załączniku.\n\nDziękuję." : "Dzień dobry,\n\nprzekazuję do wiadomości.\n\n"
  );
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const submit = async () => {
    if (sending || !to.trim()) return;
    setSending(true);
    setResult(null);
    const res = await actionMailForward({ mailbox: conv.mailbox, threadId: conv.threadId, to, note, purpose, messageId: message?.id ?? null }).catch(() => ({
      ok: false as const,
      message: "Brak połączenia z serwerem.",
    }));
    setSending(false);
    if (res.ok) {
      setResult({ ok: true, text: `Przekazano do ${res.to} (${res.attachments} zał.).${payment ? " Sprawa czeka na płatność." : ""}` });
      onSent();
    } else setResult({ ok: false, text: res.message });
  };

  return (
    <form
      className="shrink-0 space-y-2 border-t border-slate-200 bg-slate-50/60 px-4 py-3 sm:px-5"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-900">
          {payment ? "Przekaż do zapłaty" : message ? `Przekaż dalej wiadomość od ${message.fromName || message.from}` : "Przekaż dalej"}
        </p>
        {onCancel ? (
          <button type="button" onClick={onCancel} className="rounded px-1.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100">
            Anuluj
          </button>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <label htmlFor={toId} className="shrink-0 text-xs font-medium text-slate-500">
          Do
        </label>
        <input
          id={toId}
          value={to}
          onChange={(e) => setTo(e.target.value)}
          disabled={sending}
          inputMode="email"
          autoComplete="off"
          placeholder={payment ? "adres osoby, która płaci" : "adres (kilka - po przecinku)"}
          className={cn(controlFocusClass, "min-h-9 w-full rounded-md border border-slate-200 bg-white px-2.5 text-sm")}
        />
      </div>
      <label htmlFor={noteId} className="sr-only">
        Treść
      </label>
      <textarea
        id={noteId}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={4}
        disabled={sending}
        className={cn(controlFocusClass, "w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm leading-relaxed")}
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-500">
          {(() => {
            const what = message ? `ta wiadomość z ${fullFmt.format(new Date(message.receivedAt))}` : "treść rozmowy";
            const n = message ? message.attachments.filter((a) => !isInlineImage(a)).length : conv.attachments;
            return n ? `Pójdzie ${what} z ${me} i załączniki (${n}).` : `Pójdzie ${what} z ${me}; bez załączników.`;
          })()}
          {payment ? " Potem sprawa czeka 3 dni rob. na płatność." : ""}
        </p>
        <Button type="submit" disabled={sending || !to.trim()} aria-busy={sending}>
          {sending ? "Wysyłam…" : "Przekaż"}
        </Button>
      </div>
      {result ? (
        <p className={cn("text-sm", result.ok ? "text-emerald-800" : "text-red-700")} role={result.ok ? "status" : "alert"}>
          {result.text}
        </p>
      ) : null}
    </form>
  );
}

/** Półka: sprawa czy nie; zapamiętanie nadawcy albo całej domeny (nie dla poczty prywatnej). */
function TriageBar({
  conv,
  onDecide,
}: {
  conv: MailConversation;
  onDecide: (conv: MailConversation, decision: "case" | "ignore" | "customs", remember: "none" | "sender" | "domain") => void;
}) {
  const rememberId = useId();
  const email = conv.lastFromEmail;
  const domain = domainOf(email);
  const [remember, setRemember] = useState<"none" | "sender" | "domain">("sender");
  const armed = useArmedAfterMount();
  return (
    <div className="space-y-2 border-b border-slate-200 bg-sky-50/60 px-4 py-3 sm:px-5">
      <p className="text-sm text-slate-800">
        Nowy nadawca <span className="font-medium">{email}</span>. To sprawa do załatwienia?
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" disabled={!armed} onClick={() => onDecide(conv, "case", remember)}>
          To sprawa
        </Button>
        <Button type="button" size="sm" variant="secondary" disabled={!armed} onClick={() => onDecide(conv, "ignore", remember)}>
          Nie sprawa
        </Button>
        <Button type="button" size="sm" variant="secondary" disabled={!armed} onClick={() => onDecide(conv, "customs", remember)}>
          Odprawa / spedycja
        </Button>
        <label htmlFor={rememberId} className="sr-only">
          Zapamiętaj
        </label>
        <select
          id={rememberId}
          value={remember}
          onChange={(e) => setRemember(e.target.value as typeof remember)}
          className={cn(controlFocusClass, "min-h-9 rounded-md border border-slate-200 bg-white px-2 text-sm")}
        >
          <option value="sender">i zapamiętaj: zawsze od {email}</option>
          {domain && !isFreeMailDomain(domain) ? <option value="domain">i zapamiętaj: cała domena @{domain}</option> : null}
          <option value="none">tylko ta rozmowa</option>
        </select>
      </div>
    </div>
  );
}
