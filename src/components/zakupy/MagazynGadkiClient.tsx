"use client";

import {
  useDeferredValue,
  useMemo,
  useState,
  useTransition,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import {
  userFacingErrorText,
  userFacingErrorTextFromMessage,
} from "@/lib/ui/user-facing-error";
import {
  actionAddGadkiSiteNote,
  actionDeleteGadkiSiteNote,
  actionLinkGadkiZk,
  actionPurgeGadkiOrphanMeta,
  actionRefreshGadkiZk,
  actionRenameGadkiPallet,
  actionSearchGadkiZk,
  actionSetGadkiLineNote,
  actionSetGadkiLinePallet,
  actionSetGadkiLinePalletShares,
  actionUnlinkGadkiZk,
  actionUpdateGadkiSiteNote,
} from "@/app/actions/external-warehouse-gadki";
import type {
  GadkiChangeLogView,
  GadkiNoteView,
  GadkiZkLinkView,
} from "@/lib/data/external-warehouse-gadki";
import { MAX_EXTERNAL_WAREHOUSE_PALLET_SHARES_PER_LINE } from "@/lib/external-warehouse/constants";
import type { ExternalWarehouseLineDto } from "@/lib/external-warehouse/lines";
import { groupByPallet } from "@/lib/external-warehouse/group-by-pallet";
import { isGadkiZkContentLogKind } from "@/lib/external-warehouse/change-log-copy";
import type { ZkSearchCandidate } from "@/lib/subiekt/resolve-zk-document";
import { formatWarsawDateTime } from "@/lib/time/warsaw";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { fieldControlClass } from "@/components/ui/Field";
import { PanelSummaryMetric } from "@/components/ui/PanelSummaryMetric";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Spinner } from "@/components/ui/Spinner";
import { ZkWatchAddBar } from "@/components/notatnik/ZkWatchAddBar";
import { SectionHeadingIcon } from "@/components/icons/SectionHeadingIcon";
import {
  IconChevronDown,
  IconClipboardList,
  IconClock,
  IconLayers,
  IconLink,
  IconLinkOff,
  IconMagazynGadki,
  IconNotepad,
  IconPackage,
  IconPencil,
  IconPlusCircle,
  IconSearch,
  IconTrash2,
} from "@/components/icons/StrokeIcons";
import { cn } from "@/lib/cn";
import {
  panelSectionInsetClass,
  panelSubsectionInsetClass,
  panelTypography,
  sectionIconTileBrandClass,
} from "@/lib/ui/ontime-theme";

export type GadkiSyncBanner = {
  changes: { zkNumber: string; text: string }[];
  errors: { zkNumber: string; message: string }[];
  locked?: boolean;
  readOnly?: boolean;
};

type Props = {
  siteName: string;
  links: GadkiZkLinkView[];
  notes: GadkiNoteView[];
  changeLog: GadkiChangeLogView[];
  subiektLabel: string;
  subiektMessage: string;
  subiektReachable: boolean;
  canMutate: boolean;
  syncBanner: GadkiSyncBanner | null;
};

function matchesSearch(line: ExternalWarehouseLineDto, q: string): boolean {
  if (!q) return true;
  const hay =
    `${line.symbol ?? ""} ${line.product} ${line.note ?? ""} ${line.lineNote ?? ""} ${line.palletLabel ?? ""}`.toLowerCase();
  return hay.includes(q);
}

function GadkiSection({
  title,
  hint,
  icon,
  iconTileClassName,
  headerAside,
  children,
  className,
}: {
  title: string;
  hint?: string;
  icon: React.ReactNode;
  iconTileClassName?: string;
  headerAside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-md border border-slate-200/80 bg-[var(--card)] shadow-sm",
        className
      )}
    >
      <CardHeader
        inset
        density="compact"
        leading={
          <SectionHeadingIcon tileClassName={iconTileClassName ?? sectionIconTileBrandClass}>
            {icon}
          </SectionHeadingIcon>
        }
        title={title}
        hint={hint}
        action={headerAside}
        actionAlign="inline"
      />
      <div className={cn(panelSubsectionInsetClass, "pb-4 pt-3")}>{children}</div>
    </section>
  );
}

export function MagazynGadkiClient({
  siteName,
  links,
  notes,
  changeLog,
  subiektLabel,
  subiektMessage,
  subiektReachable,
  canMutate,
  syncBanner,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [chooseHint, setChooseHint] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<ZkSearchCandidate[]>([]);
  const [linksOpen, setLinksOpen] = useState(links.length === 0);
  const [lineSearch, setLineSearch] = useState("");
  const deferredSearch = useDeferredValue(lineSearch.trim().toLowerCase());
  const [viewMode, setViewMode] = useState<"pallet" | "list">("pallet");
  const [logOpen, setLogOpen] = useState(false);
  const [logFilter, setLogFilter] = useState<"zk" | "all">("zk");
  const [noteDraft, setNoteDraft] = useState("");
  const [noteZkFilter, setNoteZkFilter] = useState<string>("");
  const [noteListFilter, setNoteListFilter] = useState<string>("");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteBody, setEditingNoteBody] = useState("");
  const [unlinkTarget, setUnlinkTarget] = useState<GadkiZkLinkView | null>(null);

  const canAddZk = canMutate && subiektReachable;
  /** Pusta lista zawsze rozwinięta (CTA dodawania); inaczej honoruj przełącznik. */
  const linksExpanded = links.length === 0 || linksOpen;

  const latestSync = useMemo(() => {
    const times = links.map((l) => l.lastSyncedAt).filter(Boolean) as string[];
    if (!times.length) return null;
    return times.sort().at(-1) ?? null;
  }, [links]);

  const totalLines = useMemo(
    () =>
      links.reduce(
        (sum, l) => sum + new Set(l.lines.map((row) => row.key)).size,
        0
      ),
    [links]
  );

  const totalPallets = useMemo(() => {
    const set = new Set<string>();
    for (const link of links) {
      for (const label of link.palletLabels) set.add(`${link.id}:${label}`);
    }
    return set.size;
  }, [links]);

  const visibleNotes = useMemo(() => {
    if (!noteListFilter) return notes;
    return notes.filter((n) => n.zkLinkId === noteListFilter);
  }, [notes, noteListFilter]);

  const filteredChangeLog = useMemo(() => {
    if (logFilter === "all") return changeLog;
    return changeLog.filter((row) => isGadkiZkContentLogKind(row.kind));
  }, [changeLog, logFilter]);

  function run(fn: () => Promise<void>) {
    setError(null);
    startTransition(() => {
      void (async () => {
        try {
          await fn();
          router.refresh();
        } catch (e) {
          setError(userFacingErrorText(e, "Operacja nie powiodła się"));
        }
      })();
    });
  }

  async function onSearchSubmit() {
    if (!canAddZk) return;
    setSearchLoading(true);
    setError(null);
    try {
      const result = await actionSearchGadkiZk(query);
      if (result.kind === "error") {
        setError(userFacingErrorTextFromMessage(result.message, "Błąd wyszukiwania ZK"));
        setCandidates([]);
        setChooseHint(null);
        return;
      }
      if (result.kind === "choose") {
        setCandidates(result.candidates);
        setChooseHint(result.hint);
        return;
      }
      setCandidates([]);
      setChooseHint(null);
      const linked = await actionLinkGadkiZk({ subiektDokId: result.dokId });
      if (!linked.ok) {
        setError(userFacingErrorTextFromMessage(linked.message, "Błąd powiązania ZK"));
        return;
      }
      setQuery("");
      router.refresh();
    } catch (e) {
      setError(userFacingErrorText(e, "Błąd wyszukiwania ZK"));
    } finally {
      setSearchLoading(false);
    }
  }

  async function onPickCandidate(c: ZkSearchCandidate) {
    setSearchLoading(true);
    setError(null);
    try {
      const linked = await actionLinkGadkiZk({ subiektDokId: c.subiektDokId });
      if (!linked.ok) {
        setError(userFacingErrorTextFromMessage(linked.message, "Błąd powiązania ZK"));
        return;
      }
      setQuery("");
      setCandidates([]);
      setChooseHint(null);
      router.refresh();
    } catch (e) {
      setError(userFacingErrorText(e, "Błąd powiązania ZK"));
    } finally {
      setSearchLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card padding={false} className="overflow-hidden">
        <CardHeader
          inset
          density="compact"
          leading={
            <SectionHeadingIcon tileClassName="bg-emerald-100 text-emerald-800" className="h-9 w-9">
              <IconMagazynGadki size={18} />
            </SectionHeadingIcon>
          }
          title={siteName}
          description="Stałe ZK magazynu zewnętrznego — palety, notatki i zmiany z Subiekta."
          hint="Pozycje synchronizują się przy wejściu (co 45 s) oraz po „Odśwież teraz”. Koszty pakowania/dostawy są ukryte."
          actionAlign="inline"
          action={
            canMutate ? (
              <Button
                type="button"
                size="sm"
                disabled={pending || links.length === 0}
                onClick={() =>
                  run(async () => {
                    await actionRefreshGadkiZk();
                  })
                }
                className="gap-1.5"
              >
                {pending ? <Spinner size="sm" /> : null}
                Odśwież teraz
              </Button>
            ) : null
          }
        />

        <div className={cn(panelSectionInsetClass, "space-y-3 border-b border-slate-100")}>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={subiektReachable ? "success" : "warning"}>
              {subiektReachable ? "Subiekt online" : "Subiekt offline"}
            </Badge>
            {!canMutate ? <Badge variant="warning">Podgląd</Badge> : null}
            {latestSync ? (
              <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                <IconClock size={13} strokeWidth={1.75} />
                <span className="tabular-nums">
                  Sync {formatWarsawDateTime(latestSync)}
                </span>
              </span>
            ) : (
              <span className="text-xs text-slate-500">Brak synchronizacji</span>
            )}
            <span className="text-xs text-slate-400" title={subiektMessage}>
              {subiektLabel}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <PanelSummaryMetric label="ZK" value={links.length} />
            <PanelSummaryMetric label="Pozycje" value={totalLines} />
            <PanelSummaryMetric label="Palety" value={totalPallets} />
            <PanelSummaryMetric label="Notatki" value={notes.length} />
          </div>
        </div>
      </Card>

      {!canMutate ? (
        <Alert tone="warning" title="Podgląd — bez sync">
          Tryb tylko do odczytu. Synchronizacja i zmiany są zablokowane.
        </Alert>
      ) : null}

      {syncBanner?.locked ? (
        <Alert tone="info" title="Trwa synchronizacja">
          Inne żądanie odświeża ZK — pokazano ostatni zapisany snapshot.
        </Alert>
      ) : null}

      {syncBanner?.errors?.length ? (
        <Alert tone="warning" title="Część ZK nie zsynchronizowała się">
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-sm">
            {syncBanner.errors.map((e) => (
              <li key={`${e.zkNumber}-${e.message}`}>
                <span className="font-medium">{e.zkNumber}</span>:{" "}
                {userFacingErrorTextFromMessage(e.message, "Błąd synchronizacji ZK")}
              </li>
            ))}
          </ul>
        </Alert>
      ) : null}

      {syncBanner?.changes?.length ? (
        <Alert tone="info" title="Zmiany od ostatniej wizyty">
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-sm">
            {syncBanner.changes.map((c) => (
              <li key={`${c.zkNumber}-${c.text}`}>
                <span className="font-medium">{c.zkNumber}</span>: {c.text}
              </li>
            ))}
          </ul>
        </Alert>
      ) : null}

      {error ? (
        <Alert tone="error" title="Operacja nie powiodła się">
          {error}
        </Alert>
      ) : null}

      <GadkiSection
        title="Powiązane ZK"
        hint="Stałe dokumenty ZK z Subiekta przypięte do magazynu Gądki (max 10)."
        icon={<IconLink size={16} />}
        iconTileClassName="bg-sky-100 text-sky-800"
        headerAside={
          links.length > 0 ? (
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
              aria-expanded={linksExpanded}
              onClick={() => setLinksOpen((v) => !v)}
            >
              {linksExpanded ? "Zwiń" : "Rozwiń"}
              <IconChevronDown size={14} open={linksExpanded} />
            </button>
          ) : undefined
        }
      >
        <div
          className={cn(
            "grid transition-[grid-template-rows,opacity] duration-200 ease-out",
            linksExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
          )}
        >
          <div className="overflow-hidden">
            <div className="space-y-4">
              {canMutate ? (
                <div className="rounded-md border border-dashed border-slate-200 bg-slate-50/60 p-3 sm:p-3.5">
                  <p className="mb-2 text-xs font-medium text-slate-600">Dodaj ZK</p>
                  <ZkWatchAddBar
                    query={query}
                    loading={searchLoading || pending}
                    canAdd={canAddZk}
                    subiektBlockedHint={
                      subiektReachable
                        ? undefined
                        : subiektMessage || "System magazynowy niedostępny"
                    }
                    chooseHint={chooseHint}
                    candidates={candidates}
                    onQueryChange={setQuery}
                    onSubmit={() => void onSearchSubmit()}
                    onPickCandidate={(c) => void onPickCandidate(c)}
                    onClearChoose={() => {
                      setCandidates([]);
                      setChooseHint(null);
                    }}
                    layout="inline"
                  />
                </div>
              ) : null}

              {links.length === 0 ? (
                <EmptyState
                  title="Brak powiązanych ZK"
                  description={
                    canMutate
                      ? "Dodaj stałe ZK magazynu zewnętrznego, aby zobaczyć pozycje, palety i notatki."
                      : "Administrator musi powiązać ZK w trybie z uprawnieniami zapisu."
                  }
                  icon={<IconPlusCircle size={28} strokeWidth={1.75} />}
                />
              ) : (
                <ul className="divide-y divide-slate-100 overflow-hidden rounded-md border border-slate-100">
                  {links.map((link) => (
                    <li
                      key={link.id}
                      className="flex flex-wrap items-center justify-between gap-3 bg-white px-3 py-3 transition hover:bg-slate-50/80 sm:px-3.5"
                    >
                      <div className="min-w-0">
                        <a
                          href={`#zk-${link.id}`}
                          className="font-semibold text-slate-900 underline-offset-2 hover:underline"
                        >
                          {link.zkNumber}
                        </a>
                        <p className="mt-0.5 truncate text-sm text-slate-600">
                          {link.clientLabel || "—"}
                          {link.label ? ` · ${link.label}` : ""}
                        </p>
                        <p className="mt-1 text-[11px] tabular-nums text-slate-400">
                          {link.lines.length} poz.
                          {link.lastSyncedAt
                            ? ` · ${formatWarsawDateTime(link.lastSyncedAt)}`
                            : ""}
                        </p>
                      </div>
                      {canMutate ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={pending}
                          className="gap-1.5 text-slate-600"
                          onClick={() => setUnlinkTarget(link)}
                        >
                          <IconLinkOff size={14} />
                          Odłącz
                        </Button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </GadkiSection>

      {links.length > 0 ? (
        <GadkiSection
          title="Pozycje"
          hint="Grupowanie po paletach lub płaska lista. Wyszukiwanie działa po wszystkich ZK."
          icon={<IconPackage size={16} />}
          iconTileClassName="bg-emerald-100 text-emerald-800"
          headerAside={
            <SegmentedControl
              value={viewMode}
              onChange={setViewMode}
              ariaLabel="Widok pozycji"
              options={[
                { value: "pallet", label: "Wg palet" },
                { value: "list", label: "Lista" },
              ]}
            />
          }
        >
          <div className="space-y-5">
            <div className="relative">
              <IconSearch
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-emerald-700/50"
              />
              <input
                type="search"
                value={lineSearch}
                onChange={(e) => setLineSearch(e.target.value)}
                placeholder="Szukaj symbolu, nazwy, palety, notatki…"
                className={cn(
                  fieldControlClass("default"),
                  "w-full border-emerald-100/90 bg-emerald-50/20 pl-9 placeholder:text-slate-400 focus:border-emerald-300 focus:ring-emerald-500/15"
                )}
              />
            </div>

            <div className="space-y-4">
              {links.map((link) => {
                const filtered = link.lines.filter((l) =>
                  matchesSearch(l, deferredSearch)
                );
                const uniquePozCount = new Set(filtered.map((l) => l.key)).size;
                const orphanVisible = link.orphanLines.filter((o) =>
                  matchesSearch(o, deferredSearch)
                );
                if (deferredSearch && filtered.length === 0 && orphanVisible.length === 0) {
                  return null;
                }
                const groups =
                  viewMode === "pallet"
                    ? groupByPallet(filtered)
                    : [{ palletLabel: null as string | null, title: "Lista", lines: filtered }];
                const labeledPalletCount = link.palletLabels.length;

                return (
                  <article
                    key={link.id}
                    id={`zk-${link.id}`}
                    className="scroll-mt-24 overflow-hidden rounded-lg border border-emerald-100/80 bg-white shadow-sm shadow-emerald-950/[0.03]"
                  >
                    <header className="flex flex-wrap items-start justify-between gap-3 border-b border-emerald-50 bg-gradient-to-r from-emerald-50/70 via-white to-sky-50/30 px-3.5 py-3 sm:px-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-semibold tracking-tight text-slate-900">
                            {link.zkNumber}
                          </h3>
                          <span className="inline-flex items-center rounded-md bg-white/90 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-emerald-800 ring-1 ring-inset ring-emerald-200/70">
                            {uniquePozCount}
                            {deferredSearch
                              ? ` / ${new Set(link.lines.map((l) => l.key)).size}`
                              : ""}{" "}
                            poz.
                          </span>
                          {labeledPalletCount > 0 ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-white/90 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 ring-1 ring-inset ring-slate-200/80">
                              <IconLayers size={10} className="text-emerald-700/70" />
                              {labeledPalletCount}{" "}
                              {labeledPalletCount === 1 ? "paleta" : "palet"}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 truncate text-xs text-slate-500">
                          {link.clientLabel || "—"}
                        </p>
                      </div>
                      {canMutate && link.palletLabels.length > 0 ? (
                        <RenamePalletForm
                          labels={link.palletLabels}
                          disabled={pending}
                          onRename={(from, to) =>
                            run(async () => {
                              const res = await actionRenameGadkiPallet({
                                linkId: link.id,
                                fromLabel: from,
                                toLabel: to,
                              });
                              if (!res.ok) throw new Error(res.message);
                            })
                          }
                        />
                      ) : null}
                    </header>

                    <div className="space-y-4 p-3 sm:p-4">
                      {filtered.length === 0 && !deferredSearch ? (
                        <p
                          className={cn(
                            panelTypography.caption,
                            "rounded-md border border-dashed border-slate-200 bg-slate-50/60 px-3 py-4 text-center text-slate-500"
                          )}
                        >
                          Brak pozycji towarowych w tym ZK.
                        </p>
                      ) : null}

                      {groups.map((group) => {
                        const isUnassigned =
                          viewMode === "pallet" && group.palletLabel == null;
                        return (
                          <div
                            key={`${link.id}-${group.title}`}
                            className="space-y-2"
                          >
                            {viewMode === "pallet" ? (
                              <div className="flex items-center gap-2">
                                <span
                                  className={cn(
                                    "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold tracking-wide",
                                    isUnassigned
                                      ? "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200/80"
                                      : "bg-emerald-50 text-emerald-900 ring-1 ring-inset ring-emerald-200/80"
                                  )}
                                >
                                  {!isUnassigned ? (
                                    <IconLayers size={11} className="opacity-70" />
                                  ) : null}
                                  {group.title}
                                </span>
                                <span className="text-[11px] tabular-nums text-slate-400">
                                  {group.lines.length}{" "}
                                  {group.lines.length === 1 ? "wiersz" : "wiersze"}
                                </span>
                                <div className="h-px flex-1 bg-gradient-to-r from-slate-200/80 to-transparent" />
                              </div>
                            ) : null}
                            <ul className="overflow-hidden rounded-lg border border-slate-200/80 bg-white divide-y divide-slate-100/90 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.8)]">
                              {group.lines.map((line) => (
                                <LineRow
                                  key={`${link.id}-${line.rowKey}`}
                                  line={line}
                                  siblingShares={link.lines.filter(
                                    (l) =>
                                      l.key === line.key &&
                                      Boolean(l.shareId) &&
                                      !l.isRemainder
                                  )}
                                  palletOptions={link.palletLabels}
                                  canMutate={canMutate}
                                  disabled={pending}
                                  onPallet={(palletLabel) =>
                                    run(async () => {
                                      const res = await actionSetGadkiLinePallet({
                                        linkId: link.id,
                                        lineKey: line.key,
                                        palletLabel,
                                      });
                                      if (!res.ok) throw new Error(res.message);
                                    })
                                  }
                                  onShares={(shares) =>
                                    run(async () => {
                                      const res = await actionSetGadkiLinePalletShares({
                                        linkId: link.id,
                                        lineKey: line.key,
                                        shares,
                                      });
                                      if (!res.ok) throw new Error(res.message);
                                    })
                                  }
                                  onNote={(note, target) =>
                                    run(async () => {
                                      const res = await actionSetGadkiLineNote({
                                        linkId: link.id,
                                        lineKey: line.key,
                                        note,
                                        shareId:
                                          target === "share"
                                            ? line.shareId ?? null
                                            : null,
                                      });
                                      if (!res.ok) throw new Error(res.message);
                                    })
                                  }
                                />
                              ))}
                            </ul>
                          </div>
                        );
                      })}

                      {orphanVisible.length > 0 ? (
                        <div className="space-y-2.5 rounded-lg border border-amber-200/90 bg-gradient-to-b from-amber-50/90 to-amber-50/40 p-3.5">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center rounded-md bg-amber-100/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-900 ring-1 ring-inset ring-amber-200/80">
                              Usunięte z ZK
                            </span>
                            <span className="text-[11px] text-amber-800/80">
                              Meta zachowana — możesz usunąć ręcznie
                            </span>
                          </div>
                          <ul className="space-y-1.5">
                            {orphanVisible.map((line, orphanIdx) => {
                              const isFirstOfKey =
                                orphanVisible.findIndex((o) => o.key === line.key) ===
                                orphanIdx;
                              return (
                                <li
                                  key={`orphan-${line.rowKey}`}
                                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-100/90 bg-white/80 px-3 py-2 text-sm"
                                >
                                  <span className="min-w-0 text-slate-700">
                                    <span className="font-medium text-slate-900">
                                      {line.product}
                                    </span>
                                    {line.quantityLabel ? (
                                      <span className="tabular-nums text-slate-500">
                                        {" "}
                                        · {line.quantityLabel}
                                      </span>
                                    ) : null}
                                    {line.palletLabel ? (
                                      <span className="text-slate-500">
                                        {" "}
                                        · {line.palletLabel}
                                      </span>
                                    ) : null}
                                    {line.note ? (
                                      <span className="mt-0.5 block text-xs leading-snug text-slate-500">
                                        {line.note}
                                      </span>
                                    ) : null}
                                    {line.lineNote && line.lineNote !== line.note ? (
                                      <span className="mt-0.5 block text-xs leading-snug text-slate-400">
                                        Pozycja · {line.lineNote}
                                      </span>
                                    ) : null}
                                  </span>
                                  {canMutate && isFirstOfKey ? (
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="ghost"
                                      disabled={pending}
                                      className="text-amber-900 hover:bg-amber-100/80"
                                      onClick={() =>
                                        run(async () => {
                                          const res = await actionPurgeGadkiOrphanMeta({
                                            linkId: link.id,
                                            lineKey: line.key,
                                          });
                                          if (!res.ok) throw new Error(res.message);
                                        })
                                      }
                                    >
                                      Usuń meta
                                    </Button>
                                  ) : null}
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  </article>
                );
              })}

              {deferredSearch &&
              links.every((link) => {
                const filtered = link.lines.filter((l) =>
                  matchesSearch(l, deferredSearch)
                );
                const orphanVisible = link.orphanLines.filter((o) =>
                  matchesSearch(o, deferredSearch)
                );
                return filtered.length === 0 && orphanVisible.length === 0;
              }) ? (
                <p
                  className={cn(
                    panelTypography.caption,
                    "rounded-lg border border-dashed border-slate-200 bg-slate-50/70 px-3 py-6 text-center text-slate-500"
                  )}
                >
                  Brak pozycji pasujących do „{lineSearch.trim()}”.
                </p>
              ) : null}
            </div>
          </div>
        </GadkiSection>
      ) : null}

      <GadkiSection
        title="Notatki"
        hint="Notatki magazynu lub przypięte do konkretnego ZK."
        icon={<IconNotepad size={16} />}
        iconTileClassName="bg-violet-100 text-violet-800"
        headerAside={
          notes.length > 0 ? (
            <select
              value={noteListFilter}
              onChange={(e) => setNoteListFilter(e.target.value)}
              className={cn(fieldControlClass("default"), "max-w-[11rem] py-1.5 text-xs")}
              aria-label="Filtruj notatki po ZK"
            >
              <option value="">Wszystkie</option>
              {links.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.zkNumber}
                </option>
              ))}
            </select>
          ) : undefined
        }
      >
        <div className="space-y-4">
          {canMutate ? (
            <form
              className="flex flex-col gap-2 rounded-md border border-slate-100 bg-slate-50/50 p-3 sm:flex-row sm:items-start"
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                run(async () => {
                  const res = await actionAddGadkiSiteNote({
                    body: noteDraft,
                    zkLinkId: noteZkFilter || null,
                  });
                  if (!res.ok) throw new Error(res.message);
                  setNoteDraft("");
                });
              }}
            >
              <textarea
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                rows={2}
                placeholder="Nowa notatka…"
                className={cn(fieldControlClass("default"), "min-h-[2.75rem] flex-1 resize-y")}
              />
              <div className="flex shrink-0 flex-col gap-2 sm:w-40">
                <select
                  value={noteZkFilter}
                  onChange={(e) => setNoteZkFilter(e.target.value)}
                  className={fieldControlClass("default")}
                >
                  <option value="">Cały magazyn</option>
                  {links.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.zkNumber}
                    </option>
                  ))}
                </select>
                <Button
                  type="submit"
                  size="sm"
                  disabled={pending || !noteDraft.trim()}
                >
                  Dodaj
                </Button>
              </div>
            </form>
          ) : null}

          {notes.length === 0 ? (
            <EmptyState
              title="Brak notatek"
              description="Tu pojawią się krótkie uwagi do magazynu lub konkretnego ZK."
              icon={<IconNotepad size={26} strokeWidth={1.75} />}
            />
          ) : visibleNotes.length === 0 ? (
            <p className={cn(panelTypography.caption, "px-1 text-slate-600")}>
              Brak notatek dla wybranego ZK.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100 overflow-hidden rounded-md border border-slate-100">
              {visibleNotes.map((note) => (
                <li key={note.id} className="bg-white px-3 py-3 text-sm sm:px-3.5">
                  {editingNoteId === note.id && canMutate ? (
                    <div className="space-y-2">
                      <textarea
                        value={editingNoteBody}
                        onChange={(e) => setEditingNoteBody(e.target.value)}
                        rows={2}
                        className={cn(fieldControlClass("default"), "resize-y")}
                      />
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          disabled={pending}
                          onClick={() =>
                            run(async () => {
                              const res = await actionUpdateGadkiSiteNote({
                                noteId: note.id,
                                body: editingNoteBody,
                              });
                              if (!res.ok) throw new Error(res.message);
                              setEditingNoteId(null);
                            })
                          }
                        >
                          Zapisz
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingNoteId(null)}
                        >
                          Anuluj
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="whitespace-pre-wrap leading-relaxed text-slate-800">
                          {note.body}
                        </p>
                        <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500">
                          <time className="tabular-nums" dateTime={note.createdAt}>
                            {formatWarsawDateTime(note.createdAt)}
                          </time>
                          {note.zkNumber ? (
                            <Badge variant="default" className="normal-case tracking-normal">
                              {note.zkNumber}
                            </Badge>
                          ) : (
                            <span className="text-slate-400">magazyn</span>
                          )}
                        </p>
                      </div>
                      {canMutate ? (
                        <div className="flex gap-0.5">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="gap-1"
                            onClick={() => {
                              setEditingNoteId(note.id);
                              setEditingNoteBody(note.body);
                            }}
                          >
                            <IconPencil size={13} />
                            Edytuj
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="gap-1 text-red-700 hover:bg-red-50 hover:text-red-800"
                            disabled={pending}
                            onClick={() =>
                              run(async () => {
                                const res = await actionDeleteGadkiSiteNote(note.id);
                                if (!res.ok) throw new Error(res.message);
                              })
                            }
                          >
                            <IconTrash2 size={13} />
                            Usuń
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </GadkiSection>

      <GadkiSection
        title="Dziennik ZK"
        hint={
          logFilter === "zk"
            ? "Zmiany treści ZK z Subiekta (ilości, dodane/usunięte pozycje)."
            : "Wszystkie zdarzenia: sync ZK, palety, notatki, powiązania."
        }
        icon={<IconClipboardList size={16} />}
        iconTileClassName="bg-slate-100 text-slate-700"
        headerAside={
          changeLog.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <SegmentedControl
                value={logFilter}
                onChange={setLogFilter}
                ariaLabel="Filtr dziennika"
                options={[
                  { value: "zk", label: "Zmiany ZK" },
                  { value: "all", label: "Wszystko" },
                ]}
              />
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="gap-1 text-slate-600"
                onClick={() => setLogOpen((v) => !v)}
                aria-expanded={logOpen}
              >
                <IconChevronDown size={14} open={logOpen} />
                {logOpen ? "Zwiń" : "Rozwiń"}
              </Button>
            </div>
          ) : undefined
        }
      >
        {changeLog.length === 0 ? (
          <EmptyState
            title="Dziennik jest pusty"
            description="Tu pojawią się zmiany ilości i pozycji z ZK po synchronizacji z Subiektem."
            icon={<IconClipboardList size={26} strokeWidth={1.75} />}
          />
        ) : filteredChangeLog.length === 0 ? (
          <p
            className={cn(
              panelTypography.caption,
              "rounded-md border border-dashed border-slate-200 bg-slate-50/70 px-3 py-4 text-center text-slate-500"
            )}
          >
            Brak wpisów o zmianach ZK. Przełącz na „Wszystko”, żeby zobaczyć
            palety i notatki.
          </p>
        ) : (
          <div className="space-y-2">
            {!logOpen ? (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200/80 bg-slate-50/60 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800">
                    {filteredChangeLog.length}{" "}
                    {filteredChangeLog.length === 1 ? "wpis" : "wpisów"}
                    {logFilter === "zk" ? " · zmiany ZK" : ""}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-slate-500">
                    Ostatni: {filteredChangeLog[0]?.summary}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="shrink-0 gap-1"
                  onClick={() => setLogOpen(true)}
                >
                  Pokaż
                  <IconChevronDown size={14} />
                </Button>
              </div>
            ) : (
              <>
                <ul className="max-h-[22rem] divide-y divide-slate-100 overflow-y-auto overflow-x-hidden rounded-lg border border-slate-200/80 bg-white">
                  {filteredChangeLog.map((row) => {
                    const isZk = isGadkiZkContentLogKind(row.kind);
                    return (
                      <li
                        key={row.id}
                        className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-3 py-2.5 text-sm sm:px-3.5"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="mb-0.5 flex flex-wrap items-center gap-1.5">
                            <span
                              className={cn(
                                "inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                                row.kind === "qty_changed" &&
                                  "bg-amber-50 text-amber-900 ring-1 ring-inset ring-amber-200/80",
                                row.kind === "lines_removed" &&
                                  "bg-red-50 text-red-800 ring-1 ring-inset ring-red-200/70",
                                row.kind === "lines_added" &&
                                  "bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-200/70",
                                (row.kind === "zk_linked" ||
                                  row.kind === "zk_unlinked") &&
                                  "bg-sky-50 text-sky-900 ring-1 ring-inset ring-sky-200/70",
                                !isZk &&
                                  "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200/80"
                              )}
                            >
                              {row.kind === "qty_changed"
                                ? "Ilość"
                                : row.kind === "lines_removed"
                                  ? "Usunięto"
                                  : row.kind === "lines_added"
                                    ? "Dodano"
                                    : row.kind === "zk_linked"
                                      ? "ZK"
                                      : row.kind === "zk_unlinked"
                                        ? "ZK"
                                        : "Meta"}
                            </span>
                          </div>
                          <span className="font-medium leading-snug text-slate-800">
                            {row.summary}
                          </span>
                        </div>
                        <time
                          className="shrink-0 text-[11px] tabular-nums text-slate-500"
                          dateTime={row.createdAt}
                        >
                          {formatWarsawDateTime(row.createdAt)}
                        </time>
                      </li>
                    );
                  })}
                </ul>
                <div className="flex justify-end">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="gap-1 text-slate-600"
                    onClick={() => setLogOpen(false)}
                  >
                    Zwiń dziennik
                    <IconChevronDown size={14} className="rotate-180" />
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </GadkiSection>

      <ConfirmDialog
        open={Boolean(unlinkTarget)}
        title="Odłączyć ZK?"
        message={
          unlinkTarget
            ? `ZK ${unlinkTarget.zkNumber} zostanie odłączone od magazynu.\nMeta pozycji, rozbicia na palety i notatki przypięte do tego linku zostaną usunięte. Dziennik zostanie zachowany.`
            : ""
        }
        confirmLabel="Odłącz"
        danger
        pending={pending}
        onCancel={() => setUnlinkTarget(null)}
        onConfirm={() => {
          const target = unlinkTarget;
          if (!target) return;
          setUnlinkTarget(null);
          run(async () => {
            const res = await actionUnlinkGadkiZk(target.id);
            if (!res.ok) throw new Error(res.message);
          });
        }}
      />
    </div>
  );
}

function RenamePalletForm({
  labels,
  disabled,
  onRename,
}: {
  labels: string[];
  disabled: boolean;
  onRename: (from: string, to: string) => void;
}) {
  const [fromDraft, setFromDraft] = useState<string | null>(null);
  const [to, setTo] = useState("");
  const from =
    fromDraft && labels.includes(fromDraft) ? fromDraft : (labels[0] ?? "");

  return (
    <form
      className="flex flex-wrap items-center gap-1.5 rounded-lg border border-emerald-100/90 bg-white/90 px-2 py-1.5 text-xs shadow-sm shadow-emerald-950/[0.02]"
      onSubmit={(e) => {
        e.preventDefault();
        if (!from || !to.trim()) return;
        onRename(from, to.trim());
        setTo("");
      }}
    >
      <span className="pl-0.5 font-medium text-slate-500">Zmień nazwę</span>
      <select
        value={from}
        onChange={(e) => setFromDraft(e.target.value)}
        className={cn(
          fieldControlClass("default"),
          "min-w-[4.5rem] border-emerald-100/80 py-1 text-xs"
        )}
        disabled={disabled}
      >
        {labels.map((l) => (
          <option key={l} value={l}>
            {l}
          </option>
        ))}
      </select>
      <span className="text-emerald-600/50" aria-hidden>
        →
      </span>
      <input
        value={to}
        onChange={(e) => setTo(e.target.value)}
        placeholder="Nowa nazwa"
        className={cn(
          fieldControlClass("default"),
          "w-28 border-emerald-100/80 py-1 text-xs"
        )}
        disabled={disabled}
      />
      <Button
        type="submit"
        size="sm"
        variant="ghost"
        disabled={disabled || !to.trim()}
        className="text-emerald-800 hover:bg-emerald-50"
      >
        OK
      </Button>
    </form>
  );
}

function LineStatusChip({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "emerald" | "amber" | "slate";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        tone === "emerald" && "bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-200/70",
        tone === "amber" && "bg-amber-50 text-amber-900 ring-1 ring-inset ring-amber-200/80",
        tone === "slate" && "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200/80",
        tone === "neutral" && "bg-sky-50 text-sky-900 ring-1 ring-inset ring-sky-200/70"
      )}
    >
      {children}
    </span>
  );
}

function LineRow({
  line,
  siblingShares,
  palletOptions,
  canMutate,
  disabled,
  onPallet,
  onShares,
  onNote,
}: {
  line: ExternalWarehouseLineDto;
  siblingShares: ExternalWarehouseLineDto[];
  palletOptions: string[];
  canMutate: boolean;
  disabled: boolean;
  onPallet: (palletLabel: string | null) => void;
  onShares: (shares: {
    palletLabel: string;
    qty: number;
    note?: string | null;
  }[]) => void;
  onNote: (note: string | null, target: "share" | "line") => void;
}) {
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteTarget, setNoteTarget] = useState<"share" | "line">("line");
  const [noteDraft, setNoteDraft] = useState("");
  const [newPallet, setNewPallet] = useState(false);
  const [newPalletValue, setNewPalletValue] = useState("");
  const [splitOpen, setSplitOpen] = useState(false);

  const isSplit = Boolean(line.isSplit);
  const canEditLineNote = isSplit && !line.isRemainder && Boolean(line.shareId);
  const editingOpen = splitOpen || noteOpen || newPallet;

  function openNoteEditor(target: "share" | "line") {
    setSplitOpen(false);
    setNoteTarget(target);
    setNoteDraft(
      target === "share"
        ? (line.note ?? "")
        : canEditLineNote
          ? (line.lineNote ?? "")
          : (line.note ?? "")
    );
    setNoteOpen(true);
  }
  const lineQtyLabel =
    line.lineQuantity != null
      ? `${line.lineQuantity === Math.trunc(line.lineQuantity) ? Math.trunc(line.lineQuantity) : line.lineQuantity} szt. w ZK`
      : null;

  return (
    <li
      className={cn(
        "group px-3 py-3 transition-colors sm:px-3.5",
        editingOpen ? "bg-emerald-50/35" : "hover:bg-slate-50/80"
      )}
    >
      <div className="flex items-start gap-3 sm:items-center">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {line.symbol ? (
              <span className="rounded bg-slate-100/90 px-1.5 py-0.5 font-mono text-[10px] font-medium text-slate-600 ring-1 ring-inset ring-slate-200/70">
                {line.symbol}
              </span>
            ) : null}
            {isSplit ? (
              <LineStatusChip tone={line.isRemainder ? "slate" : "emerald"}>
                {line.isRemainder ? "reszta" : "udział"}
              </LineStatusChip>
            ) : null}
            {line.overAllocated ? (
              <LineStatusChip tone="amber">nadmiar vs ZK</LineStatusChip>
            ) : null}
            {canMutate && line.palletLabel && !editingOpen ? (
              <span
                className={cn(
                  "inline-flex max-w-[8rem] truncate rounded-md bg-emerald-50/80 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800 ring-1 ring-inset ring-emerald-200/70",
                  "[@media(hover:hover)_and_(pointer:fine)]:group-hover:hidden"
                )}
              >
                {line.palletLabel}
              </span>
            ) : null}
          </div>
          <p className="mt-1 truncate text-sm font-medium leading-snug text-slate-900">
            {line.product}
          </p>
          {line.note && !(noteOpen && noteTarget === "share") ? (
            <p className="mt-1 line-clamp-2 text-xs leading-snug text-slate-500">
              <span className="font-medium text-slate-400">Notatka · </span>
              {line.note}
            </p>
          ) : null}
          {line.lineNote &&
          line.lineNote !== line.note &&
          !(noteOpen && noteTarget === "line") ? (
            canMutate && canEditLineNote ? (
              <button
                type="button"
                className="mt-1 line-clamp-2 max-w-full text-left text-xs leading-snug text-slate-400 transition-colors hover:text-sky-800"
                disabled={disabled}
                onClick={() => openNoteEditor("line")}
              >
                <span className="font-medium text-slate-400">Pozycja · </span>
                {line.lineNote}
              </button>
            ) : (
              <p className="mt-1 line-clamp-2 text-xs leading-snug text-slate-400">
                <span className="font-medium text-slate-400">Pozycja · </span>
                {line.lineNote}
              </p>
            )
          ) : null}
          {isSplit && lineQtyLabel ? (
            <p className="mt-1 text-[11px] tabular-nums text-slate-400">
              {lineQtyLabel}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2">
          <div className="min-w-[3.25rem] text-right tabular-nums transition-transform duration-200">
            <span className="text-base font-semibold tracking-tight text-slate-900">
              {line.quantity != null
                ? line.quantity === Math.trunc(line.quantity)
                  ? Math.trunc(line.quantity)
                  : line.quantity
                : "—"}
            </span>
            {line.quantity != null ? (
              <span className="ml-1 text-[11px] font-medium text-slate-400">
                szt.
              </span>
            ) : null}
          </div>

          {canMutate ? (
            <div
              className={cn(
                "flex items-center gap-1.5 overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-200 ease-out",
                !editingOpen &&
                  "[@media(hover:hover)_and_(pointer:fine)]:max-w-0 [@media(hover:hover)_and_(pointer:fine)]:opacity-0 [@media(hover:hover)_and_(pointer:fine)]:pointer-events-none",
                "[@media(hover:hover)_and_(pointer:fine)]:group-hover:max-w-[28rem] [@media(hover:hover)_and_(pointer:fine)]:group-hover:opacity-100 [@media(hover:hover)_and_(pointer:fine)]:group-hover:pointer-events-auto",
                "[@media(hover:hover)_and_(pointer:fine)]:focus-within:max-w-[28rem] [@media(hover:hover)_and_(pointer:fine)]:focus-within:opacity-100 [@media(hover:hover)_and_(pointer:fine)]:focus-within:pointer-events-auto",
                editingOpen && "max-w-[28rem] opacity-100 pointer-events-auto"
              )}
            >
              {!isSplit ? (
                newPallet ? (
                  <form
                    className="flex gap-1"
                    onSubmit={(e) => {
                      e.preventDefault();
                      onPallet(newPalletValue.trim() || null);
                      setNewPallet(false);
                      setNewPalletValue("");
                    }}
                  >
                    <input
                      value={newPalletValue}
                      onChange={(e) => setNewPalletValue(e.target.value)}
                      placeholder="Nowa paleta…"
                      className={cn(
                        fieldControlClass("default"),
                        "w-28 border-emerald-100 py-1 text-xs"
                      )}
                      disabled={disabled}
                      autoFocus
                    />
                    <Button type="submit" size="sm" variant="ghost" disabled={disabled}>
                      OK
                    </Button>
                  </form>
                ) : (
                  <select
                    value={line.palletLabel ?? ""}
                    disabled={disabled}
                    className={cn(
                      fieldControlClass("default"),
                      "max-w-[9.5rem] border-emerald-100/90 py-1 text-xs"
                    )}
                    aria-label={`Paleta: ${line.product}`}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === "__new__") {
                        setNewPallet(true);
                        return;
                      }
                      onPallet(v || null);
                    }}
                  >
                    <option value="">Bez palety</option>
                    {palletOptions.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                    <option value="__new__">Nowa paleta…</option>
                  </select>
                )
              ) : (
                <span
                  className={cn(
                    "inline-flex max-w-[9.5rem] truncate rounded-md px-2 py-1 text-xs font-semibold",
                    line.palletLabel
                      ? "bg-emerald-50 text-emerald-900 ring-1 ring-inset ring-emerald-200/70"
                      : "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200/80"
                  )}
                >
                  {line.palletLabel ?? "Bez palety"}
                </span>
              )}
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={disabled}
                className={cn(
                  "gap-1 text-slate-600",
                  splitOpen && "bg-emerald-100/70 text-emerald-900"
                )}
                onClick={() => {
                  setNoteOpen(false);
                  setSplitOpen((v) => !v);
                }}
              >
                <IconLayers size={12} />
                {isSplit ? "Rozbicie" : "Rozbij"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={disabled}
                className={cn(
                  "gap-1 text-slate-600",
                  noteOpen &&
                    noteTarget === (canEditLineNote ? "share" : "line") &&
                    "bg-sky-100/70 text-sky-900",
                  line.note &&
                    !(noteOpen && noteTarget === (canEditLineNote ? "share" : "line")) &&
                    "text-sky-800"
                )}
                onClick={() => {
                  const target = canEditLineNote ? "share" : "line";
                  if (noteOpen && noteTarget === target) {
                    setNoteOpen(false);
                    return;
                  }
                  openNoteEditor(target);
                }}
              >
                <IconPencil size={12} />
                Notatka
              </Button>
              {canEditLineNote ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={disabled}
                  className={cn(
                    "gap-1 text-slate-600",
                    noteOpen && noteTarget === "line" && "bg-sky-100/70 text-sky-900",
                    line.lineNote &&
                      !(noteOpen && noteTarget === "line") &&
                      "text-sky-800"
                  )}
                  onClick={() => {
                    if (noteOpen && noteTarget === "line") {
                      setNoteOpen(false);
                      return;
                    }
                    openNoteEditor("line");
                  }}
                >
                  <IconPencil size={12} />
                  Pozycja
                </Button>
              ) : null}
            </div>
          ) : line.palletLabel ? (
            <span className="max-w-[7rem] truncate text-right text-xs font-medium text-slate-500">
              {line.palletLabel}
            </span>
          ) : null}
        </div>
      </div>

      {splitOpen && canMutate ? (
        <SplitSharesEditor
          line={line}
          siblingShares={siblingShares}
          palletOptions={palletOptions}
          disabled={disabled}
          onCancel={() => setSplitOpen(false)}
          onSave={(shares) => {
            onShares(shares);
            setSplitOpen(false);
          }}
          onClear={() => {
            onShares([]);
            setSplitOpen(false);
          }}
        />
      ) : null}

      {noteOpen && canMutate ? (
        <form
          className="mt-3 flex flex-col gap-2 rounded-lg border border-sky-100 bg-sky-50/40 p-2.5 sm:flex-row sm:items-center"
          onSubmit={(e) => {
            e.preventDefault();
            onNote(noteDraft.trim() || null, noteTarget);
            setNoteOpen(false);
          }}
        >
          <input
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            className={cn(
              fieldControlClass("default"),
              "flex-1 border-sky-100 bg-white text-sm"
            )}
            placeholder={
              noteTarget === "share"
                ? "Notatka do tej palety…"
                : "Notatka do pozycji ZK…"
            }
            disabled={disabled}
            autoFocus
          />
          <div className="flex gap-1.5">
            <Button type="submit" size="sm" disabled={disabled}>
              Zapisz
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setNoteOpen(false)}
            >
              Anuluj
            </Button>
          </div>
        </form>
      ) : null}
    </li>
  );
}

type ShareDraft = { id: string; palletLabel: string; qty: string; note: string };

/** Domyślne rozbicie na 2 równe części (np. 80 → 40+40). */
function splitQtyHalves(qty: number): [number, number] {
  if (qty === Math.trunc(qty)) {
    const half = Math.floor(qty / 2);
    return [half, qty - half];
  }
  const half = Math.round((qty / 2) * 10000) / 10000;
  const rest = Math.round((qty - half) * 10000) / 10000;
  return [half, rest];
}

function SplitSharesEditor({
  line,
  siblingShares,
  palletOptions,
  disabled,
  onCancel,
  onSave,
  onClear,
}: {
  line: ExternalWarehouseLineDto;
  siblingShares: ExternalWarehouseLineDto[];
  palletOptions: string[];
  disabled: boolean;
  onCancel: () => void;
  onSave: (shares: {
    palletLabel: string;
    qty: number;
    note?: string | null;
  }[]) => void;
  onClear: () => void;
}) {
  const lineQty = line.lineQuantity;
  const initial: ShareDraft[] = (() => {
    if (siblingShares.length > 0) {
      return siblingShares.map((s, i) => ({
        id: s.shareId ?? `s-${i}`,
        palletLabel: s.palletLabel ?? "",
        qty: s.quantity != null ? String(s.quantity) : "",
        note: s.note ?? "",
      }));
    }
    if (line.palletLabel && !line.isSplit) {
      return [
        {
          id: "seed",
          palletLabel: line.palletLabel,
          qty: lineQty != null ? String(lineQty) : "",
          note: line.note ?? "",
        },
      ];
    }
    if (lineQty != null && Number.isFinite(lineQty) && lineQty > 0) {
      const [a, b] = splitQtyHalves(lineQty);
      return [
        { id: "a", palletLabel: "", qty: String(a), note: "" },
        { id: "b", palletLabel: "", qty: String(b), note: "" },
      ];
    }
    return [
      { id: "a", palletLabel: "", qty: "", note: "" },
      { id: "b", palletLabel: "", qty: "", note: "" },
    ];
  })();

  const [rows, setRows] = useState<ShareDraft[]>(initial);
  const sum = rows.reduce((acc, r) => {
    const n = Number(r.qty.replace(",", "."));
    return acc + (Number.isFinite(n) && n > 0 ? n : 0);
  }, 0);
  const rem =
    lineQty != null ? Math.round((lineQty - sum) * 10000) / 10000 : null;
  const over = rem != null && rem < -1e-9;
  const validShareCount = rows.filter((r) => {
    const qty = Number(r.qty.replace(",", "."));
    return r.palletLabel.trim() && Number.isFinite(qty) && qty > 0;
  }).length;
  const listId = `gadki-pallets-${line.rowKey}`;

  return (
    <div className="mt-3 space-y-3 rounded-lg border border-emerald-100 bg-gradient-to-b from-emerald-50/50 to-white p-3 shadow-sm shadow-emerald-950/[0.03]">
      <div className="space-y-1">
        <p className="text-xs font-semibold text-emerald-950">
          Rozbicie na palety
          {lineQty != null ? (
            <span className="ml-1.5 font-normal tabular-nums text-emerald-800/80">
              · łącznie {lineQty} szt. w ZK
            </span>
          ) : null}
        </p>
        <p className="text-[11px] leading-snug text-slate-500">
          Każdy udział ma własną nazwę, ilość i opcjonalną notatkę. Wpisy zostają
          przy syncu ZK.
        </p>
      </div>
      {line.overAllocated ? (
        <p className="rounded-md border border-amber-200/80 bg-amber-50 px-2.5 py-1.5 text-[11px] font-medium text-amber-900">
          Ilość w ZK jest mniejsza niż suma udziałów — wpisy zachowane; popraw
          ilości albo wyczyść rozbicie.
        </p>
      ) : null}
      <ul className="space-y-2">
        {rows.map((row, idx) => (
          <li
            key={row.id}
            className="space-y-1.5 rounded-lg border border-emerald-100/80 bg-white p-2.5 shadow-sm shadow-slate-950/[0.02]"
          >
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-[10px] font-bold tabular-nums text-emerald-800 ring-1 ring-inset ring-emerald-200/70">
                {idx + 1}
              </span>
              <input
                list={listId}
                value={row.palletLabel}
                onChange={(e) =>
                  setRows((prev) =>
                    prev.map((r, i) =>
                      i === idx ? { ...r, palletLabel: e.target.value } : r
                    )
                  )
                }
                placeholder="Nazwa palety"
                className={cn(
                  fieldControlClass("default"),
                  "min-w-[7rem] flex-1 border-emerald-100/80 py-1.5 text-xs sm:max-w-[10rem]"
                )}
                disabled={disabled}
              />
              <input
                type="text"
                inputMode="decimal"
                value={row.qty}
                onChange={(e) =>
                  setRows((prev) =>
                    prev.map((r, i) =>
                      i === idx ? { ...r, qty: e.target.value } : r
                    )
                  )
                }
                placeholder="Ilość"
                className={cn(
                  fieldControlClass("default"),
                  "w-[4.5rem] border-emerald-100/80 py-1.5 text-xs tabular-nums"
                )}
                disabled={disabled}
              />
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={disabled || rows.length <= 1}
                className="text-slate-500"
                onClick={() =>
                  setRows((prev) => prev.filter((_, i) => i !== idx))
                }
              >
                Usuń
              </Button>
            </div>
            <input
              value={row.note}
              onChange={(e) =>
                setRows((prev) =>
                  prev.map((r, i) =>
                    i === idx ? { ...r, note: e.target.value } : r
                  )
                )
              }
              placeholder="Notatka do tej palety (opcjonalnie)…"
              className={cn(
                fieldControlClass("default"),
                "w-full border-slate-200/90 py-1.5 text-xs"
              )}
              disabled={disabled}
            />
          </li>
        ))}
      </ul>
      <datalist id={listId}>
        {palletOptions.map((p) => (
          <option key={p} value={p} />
        ))}
      </datalist>
      <div className="flex flex-wrap items-center gap-2 rounded-md bg-white/80 px-2.5 py-1.5 text-[11px] tabular-nums text-slate-600 ring-1 ring-inset ring-emerald-100/80">
        <span>
          Suma:{" "}
          <span className="font-semibold text-slate-900">
            {Math.round(sum * 10000) / 10000}
          </span>
          {lineQty != null ? (
            <span className="text-slate-400"> / {lineQty}</span>
          ) : null}
        </span>
        {rem != null && rem > 1e-9 ? (
          <span className="text-slate-500">· reszta bez palety: {rem}</span>
        ) : null}
        {over ? (
          <span className="font-medium text-amber-700">
            · suma przekracza ZK
          </span>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-1.5 border-t border-emerald-100/80 pt-2.5">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={
            disabled || rows.length >= MAX_EXTERNAL_WAREHOUSE_PALLET_SHARES_PER_LINE
          }
          className="text-emerald-800 hover:bg-emerald-50"
          onClick={() =>
            setRows((prev) => [
              ...prev,
              { id: `n-${Date.now()}`, palletLabel: "", qty: "", note: "" },
            ])
          }
        >
          + Paleta
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={disabled || over || validShareCount === 0}
          onClick={() => {
            const shares = rows
              .map((r) => ({
                palletLabel: r.palletLabel.trim(),
                qty: Number(r.qty.replace(",", ".")),
                note: r.note.trim() || null,
              }))
              .filter((r) => r.palletLabel && Number.isFinite(r.qty) && r.qty > 0);
            onSave(shares);
          }}
        >
          Zapisz rozbicie
        </Button>
        {line.isSplit ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={disabled}
            onClick={onClear}
          >
            Wyczyść
          </Button>
        ) : null}
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={disabled}
          onClick={onCancel}
        >
          Anuluj
        </Button>
      </div>
    </div>
  );
}
