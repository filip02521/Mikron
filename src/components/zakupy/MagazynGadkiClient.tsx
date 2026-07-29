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
  actionAddGadkiSiteNote,
  actionDeleteGadkiSiteNote,
  actionLinkGadkiZk,
  actionPurgeGadkiOrphanMeta,
  actionRefreshGadkiZk,
  actionRenameGadkiPallet,
  actionSearchGadkiZk,
  actionSetGadkiLineNote,
  actionSetGadkiLinePallet,
  actionUnlinkGadkiZk,
  actionUpdateGadkiSiteNote,
} from "@/app/actions/external-warehouse-gadki";
import type {
  GadkiChangeLogView,
  GadkiNoteView,
  GadkiZkLinkView,
} from "@/lib/data/external-warehouse-gadki";
import type { ExternalWarehouseLineDto } from "@/lib/external-warehouse/lines";
import { groupByPallet } from "@/lib/external-warehouse/group-by-pallet";
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
  IconLink,
  IconLinkOff,
  IconNotepad,
  IconPackage,
  IconPencil,
  IconPlusCircle,
  IconSearch,
  IconTrash2,
  IconWarehouse,
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
    `${line.symbol ?? ""} ${line.product} ${line.note ?? ""} ${line.palletLabel ?? ""}`.toLowerCase();
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
    () => links.reduce((sum, l) => sum + l.lines.length, 0),
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

  function run(fn: () => Promise<void>) {
    setError(null);
    startTransition(() => {
      void (async () => {
        try {
          await fn();
          router.refresh();
        } catch (e) {
          setError(e instanceof Error ? e.message : "Operacja nie powiodła się");
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
        setError(result.message);
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
        setError(linked.message);
        return;
      }
      setQuery("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Błąd wyszukiwania ZK");
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
        setError(linked.message);
        return;
      }
      setQuery("");
      setCandidates([]);
      setChooseHint(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Błąd powiązania ZK");
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
            <SectionHeadingIcon tileClassName={sectionIconTileBrandClass} className="h-9 w-9">
              <IconWarehouse size={18} />
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
                <span className="font-medium">{e.zkNumber}</span>: {e.message}
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
          <div className="space-y-4">
            <div className="relative">
              <IconSearch
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="search"
                value={lineSearch}
                onChange={(e) => setLineSearch(e.target.value)}
                placeholder="Szukaj symbolu, nazwy, palety, notatki…"
                className={cn(fieldControlClass("default"), "w-full pl-9")}
              />
            </div>

            <div className="space-y-5">
              {links.map((link) => {
                const filtered = link.lines.filter((l) =>
                  matchesSearch(l, deferredSearch)
                );
                const orphanVisible = link.orphanLines.filter((o) =>
                  matchesSearch(o, deferredSearch)
                );
                if (deferredSearch && filtered.length === 0 && orphanVisible.length === 0) {
                  return null;
                }
                const groups =
                  viewMode === "pallet"
                    ? groupByPallet(filtered)
                    : [{ palletLabel: null, title: "Lista", lines: filtered }];

                return (
                  <article
                    key={link.id}
                    id={`zk-${link.id}`}
                    className="scroll-mt-24 space-y-3 rounded-md border border-slate-200/90 bg-gradient-to-b from-slate-50/80 to-white p-3 sm:p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 pb-3">
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold tracking-tight text-slate-900">
                          {link.zkNumber}
                        </h3>
                        <p className="mt-0.5 truncate text-xs text-slate-500">
                          {link.clientLabel || "—"}
                          <span className="tabular-nums">
                            {" "}
                            · {filtered.length}
                            {deferredSearch ? ` / ${link.lines.length}` : ""} poz.
                          </span>
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
                    </div>

                    {filtered.length === 0 && !deferredSearch ? (
                      <p className={cn(panelTypography.caption, "text-slate-500")}>
                        Brak pozycji towarowych w tym ZK.
                      </p>
                    ) : null}

                    {groups.map((group) => (
                      <div key={`${link.id}-${group.title}`} className="space-y-1.5">
                        {viewMode === "pallet" ? (
                          <div className="flex items-center gap-2 pt-1">
                            <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                              {group.title}
                            </span>
                            <span className="text-[11px] tabular-nums text-slate-400">
                              {group.lines.length}
                            </span>
                          </div>
                        ) : null}
                        <ul className="overflow-hidden rounded-md border border-slate-100 bg-white divide-y divide-slate-100">
                          {group.lines.map((line) => (
                            <LineRow
                              key={`${link.id}-${line.key}`}
                              line={line}
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
                              onNote={(note) =>
                                run(async () => {
                                  const res = await actionSetGadkiLineNote({
                                    linkId: link.id,
                                    lineKey: line.key,
                                    note,
                                  });
                                  if (!res.ok) throw new Error(res.message);
                                })
                              }
                            />
                          ))}
                        </ul>
                      </div>
                    ))}

                    {orphanVisible.length > 0 ? (
                      <div className="space-y-2 rounded-md border border-amber-200/80 bg-amber-50/60 p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-800">
                          Usunięte z ZK
                        </p>
                        <ul className="space-y-2">
                          {orphanVisible.map((line) => (
                            <li
                              key={`orphan-${line.key}`}
                              className="flex flex-wrap items-center justify-between gap-2 text-sm"
                            >
                              <span className="min-w-0 text-slate-700">
                                <span className="font-medium">{line.product}</span>
                                {line.palletLabel ? (
                                  <span className="text-slate-500">
                                    {" "}
                                    · paleta {line.palletLabel}
                                  </span>
                                ) : null}
                                {line.note ? (
                                  <span className="block text-xs text-slate-500">
                                    {line.note}
                                  </span>
                                ) : null}
                              </span>
                              {canMutate ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  disabled={pending}
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
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </article>
                );
              })}
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
        title="Dziennik"
        hint="Ostatnie 100 zdarzeń: sync, palety, notatki, powiązania ZK."
        icon={<IconClipboardList size={16} />}
        iconTileClassName="bg-slate-100 text-slate-700"
      >
        {changeLog.length === 0 ? (
          <EmptyState
            title="Dziennik jest pusty"
            description="Wpisy pojawią się po powiązaniu ZK, synchronizacji lub zmianach meta."
            icon={<IconClipboardList size={26} strokeWidth={1.75} />}
          />
        ) : (
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-md border border-slate-100">
            {changeLog.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 bg-white px-3 py-2.5 text-sm first:rounded-t-md last:rounded-b-md sm:px-3.5"
              >
                <span className="min-w-0 font-medium leading-snug text-slate-800">
                  {row.summary}
                </span>
                <time
                  className="shrink-0 text-[11px] tabular-nums text-slate-500"
                  dateTime={row.createdAt}
                >
                  {formatWarsawDateTime(row.createdAt)}
                </time>
              </li>
            ))}
          </ul>
        )}
      </GadkiSection>

      <ConfirmDialog
        open={Boolean(unlinkTarget)}
        title="Odłączyć ZK?"
        message={
          unlinkTarget
            ? `ZK ${unlinkTarget.zkNumber} zostanie odłączone od magazynu.\nMeta pozycji i notatki przypięte do tego linku zostaną usunięte. Dziennik zostanie zachowany.`
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
      className="flex flex-wrap items-center gap-1.5 rounded-md border border-slate-200/80 bg-white/80 px-2 py-1.5 text-xs"
      onSubmit={(e) => {
        e.preventDefault();
        if (!from || !to.trim()) return;
        onRename(from, to.trim());
        setTo("");
      }}
    >
      <span className="text-slate-500">Zmień paletę</span>
      <select
        value={from}
        onChange={(e) => setFromDraft(e.target.value)}
        className={cn(fieldControlClass("default"), "min-w-[4.5rem] py-1 text-xs")}
        disabled={disabled}
      >
        {labels.map((l) => (
          <option key={l} value={l}>
            {l}
          </option>
        ))}
      </select>
      <span className="text-slate-300" aria-hidden>
        →
      </span>
      <input
        value={to}
        onChange={(e) => setTo(e.target.value)}
        placeholder="Nowa nazwa"
        className={cn(fieldControlClass("default"), "w-28 py-1 text-xs")}
        disabled={disabled}
      />
      <Button type="submit" size="sm" variant="ghost" disabled={disabled || !to.trim()}>
        OK
      </Button>
    </form>
  );
}

function LineRow({
  line,
  palletOptions,
  canMutate,
  disabled,
  onPallet,
  onNote,
}: {
  line: ExternalWarehouseLineDto;
  palletOptions: string[];
  canMutate: boolean;
  disabled: boolean;
  onPallet: (palletLabel: string | null) => void;
  onNote: (note: string | null) => void;
}) {
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [newPallet, setNewPallet] = useState(false);
  const [newPalletValue, setNewPalletValue] = useState("");

  return (
    <li className="group px-3 py-2.5 sm:px-3.5">
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_5.5rem_minmax(9rem,11rem)] sm:items-center">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium leading-snug text-slate-900">
            {line.symbol ? (
              <span className="mr-2 font-mono text-[11px] font-normal text-slate-500">
                {line.symbol}
              </span>
            ) : null}
            {line.product}
          </p>
          {line.note && !noteOpen ? (
            <p className="mt-0.5 truncate text-xs text-slate-500">{line.note}</p>
          ) : null}
        </div>

        <span className="text-sm font-semibold tabular-nums text-slate-800 sm:text-right">
          {line.quantityLabel ?? "—"}
        </span>

        {canMutate ? (
          <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
            {newPallet ? (
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
                  className={cn(fieldControlClass("default"), "w-28 py-1 text-xs")}
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
                className={cn(fieldControlClass("default"), "max-w-[9.5rem] py-1 text-xs")}
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
            )}
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={disabled}
              className="gap-1"
              onClick={() => {
                if (!noteOpen) setNoteDraft(line.note ?? "");
                setNoteOpen((v) => !v);
              }}
            >
              <IconPencil size={12} />
              Notatka
            </Button>
          </div>
        ) : (
          <span className="text-right text-xs text-slate-500">
            {line.palletLabel ?? "—"}
          </span>
        )}
      </div>

      {noteOpen && canMutate ? (
        <form
          className="mt-2 flex gap-2 border-t border-slate-50 pt-2"
          onSubmit={(e) => {
            e.preventDefault();
            onNote(noteDraft.trim() || null);
            setNoteOpen(false);
          }}
        >
          <input
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            className={cn(fieldControlClass("default"), "flex-1")}
            placeholder="Notatka do pozycji…"
            disabled={disabled}
            autoFocus
          />
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
        </form>
      ) : null}
    </li>
  );
}
