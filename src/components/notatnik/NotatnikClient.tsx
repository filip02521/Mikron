"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSalesOnboardingDemo } from "@/components/sales/SalesOnboardingContext";
import { buildOnboardingNotepadDemo } from "@/lib/sales/sales-onboarding-demo-data";
import { Card, CardHeader } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Alert";
import { UndoToast } from "@/components/ui/UndoToast";
import { NoticeToast } from "@/components/ui/NoticeToast";
import { IconPackageCheck, IconClipboardPen } from "@/components/icons/StrokeIcons";
import { SectionHeadingIcon } from "@/components/icons/SectionHeadingIcon";
import { MyOrderPickupShelfDialogProvider } from "@/components/moje/MyOrderPickupShelfDialogProvider";
import { AppBrandContentFooter } from "@/components/layout/AppBrandContentFooter";
import { salesChromeInsetClass } from "@/lib/ui/ontime-theme";
import { cn } from "@/lib/cn";
import { mergeRecordsByUpdatedAt, uniqueById } from "@/lib/sales/notepad-list";
import { useClientHydrated } from "@/lib/client/use-client-hydrated";
import { sortZkWatches } from "@/lib/sales/zk-watch-sort";
import {
  buildZkWatchLineViews,
} from "@/lib/sales/zk-watch-lines";
import {
  computeAllZkWatchOrderHints,
  indexZkLinkableOrdersBySalesPerson,
  zkWatchOrderHintsForWatch,
} from "@/lib/sales/zk-watch-order-link";
import {
  buildZkArrivedSnapshot,
  countRegalWaitingZkLines,
  detectUnseenZkWarehouseArrivals,
} from "@/lib/sales/zk-watch-warehouse-notify";
import {
  loadZkArrivedSnapshot,
  saveZkArrivedSnapshot,
} from "@/lib/client/zk-watch-arrived-snapshot";
import { sortSalesNotes } from "@/lib/sales/notepad-note-sort";
import type { NotepadTodayTaskKind } from "@/lib/sales/notepad-today-tasks";
import type { SalesNotepadData } from "@/lib/data/sales-notepad";
import type { SubiektAvailability } from "@/lib/subiekt/availability";
import type { SalesNote, SalesZkWatch } from "@/types/database";
import {
  actionReorderSalesNotes,
  actionRestoreSalesNote,
  actionUndoCloseZkWatch,
} from "@/app/actions/sales-notepad";
import {
  computeZkWatchRefreshDiff,
  type ZkWatchRefreshDiff,
} from "@/lib/sales/zk-watch-refresh-diff";
import {
  clearUnseenNewZkLineKeys,
  loadZkNewLinesSnapshot,
} from "@/lib/client/zk-watch-new-lines-snapshot";
import {
  clearNewlyAddedZkWatch,
  loadZkNewlyAddedSnapshot,
  markZkWatchNewlyAdded,
  reconcileZkNewlyAddedSnapshot,
  saveZkNewlyAddedSnapshot,
} from "@/lib/client/zk-watch-newly-added-snapshot";
import {
  buildValidLineKeysByWatchId,
  reconcileZkNewLinesSnapshot,
  syncZkNewLinesSnapshot,
} from "@/lib/sales/zk-watch-new-lines-state";
import {
  computeZkWatchSupplementSync,
  detectZkWatchSnapshotSyncChanges,
} from "@/lib/sales/zk-watch-snapshot-sync";
import { NotesSection } from "./NotesSection";
import { NotatnikArchivePanel } from "./NotatnikArchivePanel";
import { NotatnikArchiveCrossLink } from "./NotatnikArchiveCrossLink";
import { TodayTasksSection } from "./TodayTasksSection";
import { NotatnikTabBar } from "./NotatnikTabBar";
import { NOTATNIK_PAGE_CLASS } from "./notatnik-layout";
import { ZkWatchSection } from "./ZkWatchSection";
import { mergeSalesPreviewSearchParams } from "@/lib/nav/sales-preview-href";
import { useUndoShortcutLabel } from "@/lib/platform/keyboard-shortcut-label";
import { NOTEPAD_UNDO_TOAST, toastFromError, type ToastNotice } from "@/lib/ui/notice-copy";
import { SalesPageAlerts } from "@/components/sales/SalesPageAlerts";
import { DelegateSwitcher } from "@/components/moje/DelegateSwitcher";
import type { VacationDelegationRow } from "@/lib/data/vacation-delegations";
import { NotatnikZkStatusChrome } from "./NotatnikZkStatusChrome";
import { NotatnikGuide } from "./NotatnikGuide";
import { SALES_PAGE_HEADER_HINTS } from "@/lib/sales/sales-page-ui-copy";
import { NOTATNIK_NOTES_PAGE_HINT } from "@/lib/sales/notatnik-notes-copy";
import { sectionIconTileBrandClass } from "@/lib/ui/ontime-theme";
import {
  isUndoExpired,
  undoExpiresAtNow,
  undoWindowBannerDescription,
} from "@/lib/orders/daily-panel-undo";
import {
  flashNotepadAnchor,
  noteIdFromNotepadAnchor,
  parseNotepadHashAnchor,
  resolveNotepadWatchFocusId,
} from "@/lib/sales/notepad-anchor";
import {
  resolveWatchFocusRequest,
  watchFocusOpensSections,
} from "@/lib/sales/notepad-watch-focus";
import {
  buildNotatnikPageHref,
  notatnikPagePathForTab,
  parseNotatnikPageTab,
  resolveNotatnikPageTab,
  type NotatnikPageTab,
  type NotatnikSurface,
} from "@/lib/sales/notepad-page-tabs";

const ZkWatchRefreshPromptModal = dynamic(
  () =>
    import("./ZkWatchRefreshPromptModal").then((mod) => ({
      default: mod.ZkWatchRefreshPromptModal,
    })),
  { ssr: false }
);

type NotatnikUndoState = (
  | { type: "archive"; note: SalesNote }
  | { type: "reorder"; notes: SalesNote[] }
  | { type: "close-zk"; watch: SalesZkWatch }
) & { expiresAt: number; performedAt: number };

function createUndoTiming() {
  const performedAt = Date.now();
  return { performedAt, expiresAt: undoExpiresAtNow(performedAt) };
}

export type { NotatnikSurface };

function contextualizeSubiektMessage(message: string): string {
  return message
    .replace(/Subiekt: offline/g, "System magazynowy niedostępny")
    .replace(/Subiekt: wyłączony/g, "Połączenie z systemem magazynowym wyłączone")
    .replace(/Subiekt niedostępny/g, "System magazynowy niedostępny")
    .replace(/danych z Subiekta/g, "danych z systemu")
    .replace(/z Subiekta/g, "z systemu")
    .replace(
      /terminy bez danych z systemu, zostają szacunki z historii dostaw\./g,
      "automatyczne wczytywanie danych ZK może być niedostępne — wpisz numer ręcznie."
    )
    .replace(
      /terminy z dokumentów ZD nie są pobierane, zostają szacunki z historii dostaw\./g,
      "automatyczne wczytywanie danych może być niedostępne."
    )
    .replace(
      /terminy ZD \(tylko u powiązanego dostawcy\) odświeżamy co ok\. 2 godziny\./g,
      "dane produktów odświeżamy co ok. 2 godziny."
    );
}

export function NotatnikClient({
  initial,
  initialFocusWatchId = null,
  initialTab,
  surface,
  readOnly,
  delegatePreview = false,
  pageTitle,
  pageDescription,
  subiektAvailability,
  linkError = null,
  loadError = null,
  teamPreview = null,
  activeDelegations = [],
}: {
  initial: SalesNotepadData;
  initialFocusWatchId?: string | null;
  initialTab?: NotatnikPageTab;
  surface: NotatnikSurface;
  readOnly?: boolean;
  delegatePreview?: boolean;
  pageTitle: string;
  pageDescription?: string;
  subiektAvailability?: SubiektAvailability;
  linkError?: string | null;
  loadError?: string | null;
  teamPreview?: {
    salesPersonId: string;
    salesPersonName: string;
    readOnly?: boolean;
    isDelegate?: boolean;
    startDate?: string | null;
    endDate?: string | null;
  } | null;
  activeDelegations?: VacationDelegationRow[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const hydrated = useClientHydrated();
  const undoShortcut = useUndoShortcutLabel();
  const tourDemo = useSalesOnboardingDemo("notatnik");
  const demoInitial = useMemo(
    () =>
      buildOnboardingNotepadDemo(
        initial.zkWatches[0]?.sales_person_id ??
          initial.notes[0]?.sales_person_id ??
          "onboarding-demo"
      ),
    [initial.notes, initial.zkWatches]
  );
  const source = tourDemo ? demoInitial : initial;
  const zkLinkableOrders = source.zkLinkableOrders;
  const isZkSurface = surface === "zk";
  const defaultTab: NotatnikPageTab = isZkSurface ? "zk" : "notes";
  const todayTaskKinds = isZkSurface
    ? (["zk-follow-up", "zk-warehouse-arrival"] as const)
    : (["note-follow-up"] as const);
  /** W tourze pokazujemy pełny UI kart ZK (kliknięcia i tak blokuje warstwa touru). */
  const effectiveReadOnly = tourDemo ? false : Boolean(readOnly);
  const effectiveDelegatePreview = Boolean(delegatePreview);
  const notesReadOnly = effectiveReadOnly || effectiveDelegatePreview;
  const showSalesSyncStrip = isZkSurface && !effectiveReadOnly && !tourDemo && !effectiveDelegatePreview;
  const initialFocus = initialFocusWatchId?.trim() || null;
  const initialFocusSections = initialFocus
    ? watchFocusOpensSections(initialFocus, source.zkWatches, source.archivedZkWatches)
    : { showZk: false, showArchive: false };
  const [zkWatches, setZkWatches] = useState(source.zkWatches);
  const [archivedWatches, setArchivedWatches] = useState(source.archivedZkWatches);
  const [notes, setNotes] = useState(source.notes);
  const [archivedNotes, setArchivedNotes] = useState(source.archivedNotes);
  const [activeTab, setActiveTab] = useState<NotatnikPageTab>(() =>
    resolveNotatnikPageTab({
      tabParam: initialTab ?? searchParams.get("tab"),
      focusWatchId: initialFocus,
      watchInOpen: initialFocusSections.showZk,
      watchInArchive: initialFocusSections.showArchive,
      defaultTab,
      archiveAvailable: isZkSurface
        ? source.archivedZkWatches.length > 0
        : source.archivedNotes.length > 0,
    })
  );
  const [focusWatchId, setFocusWatchId] = useState<string | null>(initialFocus);
  const [focusNoteId, setFocusNoteId] = useState<string | null>(null);
  const [focusWatchError, setFocusWatchError] = useState<string | null>(null);
  const [liveAnnouncement, setLiveAnnouncement] = useState("");
  const [undo, setUndo] = useState<NotatnikUndoState | null>(null);
  const [undoFeedback, setUndoFeedback] = useState<ToastNotice | null>(null);
  const [unseenWatchIds, setUnseenWatchIds] = useState<Set<string>>(() => new Set());
  const [warehouseToast, setWarehouseToast] = useState<string | null>(null);
  const [subiektStatus, setSubiektStatus] = useState<SubiektAvailability | undefined>(undefined);
  const [appliedSubiektPropKey, setAppliedSubiektPropKey] = useState("");
  const [appliedUrlTabKey, setAppliedUrlTabKey] = useState("");
  const appliedArchiveGuardKeyRef = useRef("");
  const [prosbaScopeWatchId, setProsbaScopeWatchId] = useState<string | null>(null);
  const [prosbaScopeOpenNonce, setProsbaScopeOpenNonce] = useState(0);
  const [appliedDataSyncKey, setAppliedDataSyncKey] = useState("");
  const [warehouseSnapshotReady, setWarehouseSnapshotReady] = useState(false);
  const [appliedWarehouseUnseenKey, setAppliedWarehouseUnseenKey] = useState("");
  const [newLineKeysByWatchId, setNewLineKeysByWatchId] = useState<Record<string, string[]>>({});
  const [newlyAddedWatchIds, setNewlyAddedWatchIds] = useState<Set<string>>(() => new Set());
  const [refreshPromptQueue, setRefreshPromptQueue] = useState<
    Array<{
      watch: SalesZkWatch;
      diff: ZkWatchRefreshDiff;
      uncoveredAddedKeys: string[];
    }>
  >([]);
  const refreshPrompt = refreshPromptQueue[0] ?? null;
  const focusHandledWatchRef = useRef<string | null>(null);
  const [recentlyClosedWatchId, setRecentlyClosedWatchId] = useState<string | null>(null);
  const focusHandledNoteRef = useRef<string | null>(null);
  const noteAnchorHandledRef = useRef<string | null>(null);
  const watchAnchorHandledRef = useRef<string | null>(null);
  const syncWatchFocusRef = useRef<() => void>(() => {});
  const zkWatchesRef = useRef(zkWatches);
  const archivedWatchesRef = useRef(archivedWatches);
  const notesRef = useRef(notes);
  const archivedNotesRef = useRef(archivedNotes);
  const dismissUndo = useCallback(() => {
    setUndo(null);
    router.refresh();
  }, [router]);

  const navigateToTab = useCallback(
    (tab: NotatnikPageTab, options?: { hash?: string; focusWatch?: string | null }) => {
      setActiveTab(tab);
      setFocusWatchError(null);

      const hashRaw = options?.hash?.trim() ?? "";
      const noteIdFromHash = noteIdFromNotepadAnchor(hashRaw);
      if (noteIdFromHash) {
        setFocusNoteId(noteIdFromHash);
      } else {
        setFocusNoteId(null);
      }

      if (tourDemo) return;

      const path = notatnikPagePathForTab(tab, isZkSurface ? "zk" : "notes");
      const params = mergeSalesPreviewSearchParams(
        new URLSearchParams(searchParams.toString()),
        searchParams.get("dla")
      );

      if (options?.focusWatch !== undefined) {
        const fw = options.focusWatch?.trim();
        if (fw) {
          params.set("focusWatch", fw);
          setRecentlyClosedWatchId(null);
        } else {
          params.delete("focusWatch");
        }
      } else if (tab !== "zk") {
        params.delete("focusWatch");
      }

      if (tab === "zk" && path === "/zk") {
        params.delete("tab");
      } else if (tab === "notes" && path === "/notatnik") {
        params.delete("tab");
      } else if (tab === "archive") {
        params.set("tab", "archive");
      } else {
        params.set("tab", tab);
      }

      const hash =
        options?.hash !== undefined
          ? hashRaw
            ? hashRaw.startsWith("#")
              ? hashRaw
              : `#${hashRaw}`
            : ""
          : options?.focusWatch?.trim()
            ? `#watch-${options.focusWatch.trim()}`
            : hashRaw
              ? hashRaw.startsWith("#")
                ? hashRaw
                : `#${hashRaw}`
              : "";

      const qs = params.toString();
      router.replace(qs ? `${path}?${qs}${hash}` : `${path}${hash}`, { scroll: false });
    },
    [router, searchParams, tourDemo, isZkSurface]
  );

  const refresh = useCallback(() => {
    router.refresh();
  }, [router]);

  const handleUndo = useCallback(async () => {
    if (!undo) return;
    const snapshot = undo;
    if (isUndoExpired(snapshot.expiresAt)) {
      setUndo(null);
      setUndoFeedback(NOTEPAD_UNDO_TOAST.expired);
      return;
    }
    setUndo(null);
    setUndoFeedback(null);
    try {
      if (snapshot.type === "archive") {
        const { note } = await actionRestoreSalesNote(snapshot.note.id, {
          enforceUndoWindow: true,
        });
        setArchivedNotes((prev) => prev.filter((n) => n.id !== snapshot.note.id));
        setNotes((prev) => uniqueById([note, ...prev]));
        flashNotepadAnchor(`note-${note.id}`);
        navigateToTab("notes", { hash: `note-${note.id}` });
      } else if (snapshot.type === "close-zk") {
        const { watch } = await actionUndoCloseZkWatch(snapshot.watch.id);
        setArchivedWatches((prev) => prev.filter((w) => w.id !== watch.id));
        setZkWatches((prev) => uniqueById(sortZkWatches([watch, ...prev])));
        setRecentlyClosedWatchId((id) => (id === watch.id ? null : id));
        focusHandledWatchRef.current = null;
        watchAnchorHandledRef.current = null;
        setFocusWatchId(watch.id);
        flashNotepadAnchor(`watch-${watch.id}`);
        navigateToTab("zk", { hash: `watch-${watch.id}`, focusWatch: watch.id });
      } else {
        const ids = sortSalesNotes(snapshot.notes).map((n) => n.id);
        await actionReorderSalesNotes(ids, { undoPerformedAt: snapshot.performedAt });
        setNotes(uniqueById(snapshot.notes));
      }
      setUndoFeedback(NOTEPAD_UNDO_TOAST.success);
      refresh();
    } catch (e) {
      if (!isUndoExpired(snapshot.expiresAt)) setUndo(snapshot);
      setUndoFeedback(
        toastFromError(e instanceof Error ? e.message : undefined, NOTEPAD_UNDO_TOAST.failed.text)
      );
    }
  }, [undo, navigateToTab, refresh]);

  useEffect(() => {
    if (!undo || effectiveReadOnly) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if ((e.metaKey || e.ctrlKey) && e.key === "z") {
        e.preventDefault();
        void handleUndo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, effectiveReadOnly, handleUndo]);

  useEffect(() => {
    zkWatchesRef.current = zkWatches;
  }, [zkWatches]);

  useEffect(() => {
    archivedWatchesRef.current = archivedWatches;
  }, [archivedWatches]);

  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);

  useEffect(() => {
    archivedNotesRef.current = archivedNotes;
  }, [archivedNotes]);

  const applyWatchFocus = useCallback((watchId: string) => {
    const result = resolveWatchFocusRequest(
      watchId,
      zkWatchesRef.current,
      archivedWatchesRef.current
    );
    if (result.kind === "missing") {
      setFocusWatchError(
        "Nie znaleziono tej ZK — sprawdź, czy sprawa nie została zamknięta lub usunięta."
      );
      return false;
    }

    setFocusWatchError(null);
    const tab: NotatnikPageTab = result.showArchive && !result.showZk ? "archive" : "zk";
    if (!tourDemo) {
      navigateToTab(tab, { focusWatch: watchId.trim() });
    } else {
      setActiveTab(tab);
    }
    if (focusHandledWatchRef.current !== watchId.trim()) {
      setFocusWatchId(watchId.trim());
    }
    return true;
  }, [navigateToTab, tourDemo]);

  const syncWatchFocusFromLocation = useCallback(() => {
    const params = mergeSalesPreviewSearchParams(new URLSearchParams(window.location.search));
    const previewDla = params.get("dla")?.trim() || null;
    const extraParams = previewDla ? { dla: previewDla } : undefined;
    const watchId = resolveNotepadWatchFocusId(
      window.location.hash,
      params.get("focusWatch")
    );
    if (watchId) {
      if (!isZkSurface && !tourDemo) {
        const tabParam = parseNotatnikPageTab(params.get("tab"));
        router.replace(
          buildNotatnikPageHref({
            tab: tabParam === "archive" ? "archive" : "zk",
            surface: "zk",
            focusWatch: watchId,
            extraParams,
          }),
          { scroll: false }
        );
        return;
      }
      if (watchAnchorHandledRef.current === watchId) return;
      if (focusHandledWatchRef.current === watchId) return;
      watchAnchorHandledRef.current = watchId;
      applyWatchFocus(watchId);
      return;
    }

    const anchor = parseNotepadHashAnchor(window.location.hash);
    if (anchor?.startsWith("note-")) {
      if (noteAnchorHandledRef.current === anchor) return;

      if (isZkSurface && !tourDemo) {
        noteAnchorHandledRef.current = anchor;
        router.replace(
          buildNotatnikPageHref({
            tab: "notes",
            surface: "notes",
            hash: anchor,
            extraParams,
          }),
          { scroll: false }
        );
        return;
      }
      const noteId = anchor.slice("note-".length);
      const inArchive = archivedNotesRef.current.some((note) => note.id === noteId);
      const inActive = notesRef.current.some((note) => note.id === noteId);
      noteAnchorHandledRef.current = anchor;

      if (inArchive) {
        if (!tourDemo) {
          navigateToTab("archive", { hash: anchor });
        } else {
          setActiveTab("archive");
        }
        if (focusHandledNoteRef.current !== noteId) {
          focusHandledNoteRef.current = null;
          setFocusNoteId(noteId);
        }
        return;
      }
      if (inActive) {
        if (!tourDemo && activeTab !== "notes") {
          navigateToTab("notes", { hash: anchor });
        } else {
          if (tourDemo) setActiveTab("notes");
          if (focusHandledNoteRef.current !== noteId) {
            focusHandledNoteRef.current = null;
            setFocusNoteId(noteId);
          }
        }
        return;
      }
      setActiveTab("notes");
      if (focusHandledNoteRef.current !== noteId) {
        focusHandledNoteRef.current = null;
        setFocusNoteId(noteId);
      }
    }
  }, [activeTab, applyWatchFocus, isZkSurface, navigateToTab, router, tourDemo]);

  useEffect(() => {
    syncWatchFocusRef.current = syncWatchFocusFromLocation;
  }, [syncWatchFocusFromLocation]);

  const handleFocusWatchHandled = useCallback((watchId: string) => {
    focusHandledWatchRef.current = watchId;
    setFocusWatchId(null);
  }, []);

  const handleFocusNoteHandled = useCallback((noteId: string) => {
    focusHandledNoteRef.current = noteId;
    setFocusNoteId(null);
  }, []);

  const announceLive = useCallback((message: string) => {
    setLiveAnnouncement(message);
  }, []);

  useLayoutEffect(() => {
    if (initialFocus && focusHandledWatchRef.current !== initialFocus) {
      applyWatchFocus(initialFocus);
      return;
    }
    syncWatchFocusRef.current();
  }, [applyWatchFocus, initialFocus]);

  useEffect(() => {
    if (tourDemo) return;
    const onHashChange = () => {
      noteAnchorHandledRef.current = null;
      watchAnchorHandledRef.current = null;
      syncWatchFocusRef.current();
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [tourDemo]);

  const salesPersonId =
    source.zkWatches[0]?.sales_person_id ?? source.notes[0]?.sales_person_id ?? null;

  const zkOrdersBySalesPerson = useMemo(
    () => indexZkLinkableOrdersBySalesPerson(zkLinkableOrders),
    [zkLinkableOrders]
  );

  const zkHintsByWatchId = useMemo(
    () => computeAllZkWatchOrderHints(zkWatches, zkLinkableOrders),
    [zkWatches, zkLinkableOrders]
  );

  const regalWaitingLineKeysByWatchId = useMemo(() => {
    const out: Record<string, string[]> = {};
    for (const [watchId, hints] of zkHintsByWatchId) {
      out[watchId] = hints.regalWaitingLineKeys;
    }
    return out;
  }, [zkHintsByWatchId]);

  const processZkWatchSnapshotChange = useCallback(
    (
      watch: SalesZkWatch,
      diff: ZkWatchRefreshDiff,
      options?: { updateWatchState?: boolean; triggerRouterRefresh?: boolean }
    ) => {
      const previous = zkWatchesRef.current.find((row) => row.id === watch.id);
      const lineChecksChanged =
        previous != null &&
        JSON.stringify(previous.line_checks) !== JSON.stringify(watch.line_checks);

      if (options?.updateWatchState !== false) {
        setZkWatches((prev) =>
          uniqueById(sortZkWatches(prev.map((row) => (row.id === watch.id ? watch : row))))
        );
      }

      if (salesPersonId) {
        setNewLineKeysByWatchId((prev) => {
          const sync = computeZkWatchSupplementSync({
            watch,
            diff,
            orders: zkLinkableOrders,
            salesPersonId,
            existingNewLineKeys: prev[watch.id] ?? [],
          });

          if (sync.shouldPrompt) {
            setRefreshPromptQueue((queue) => {
              const nextItem = {
                watch,
                diff,
                uncoveredAddedKeys: sync.uncoveredAdded,
              };
              const existingIndex = queue.findIndex((item) => item.watch.id === watch.id);
              if (existingIndex >= 0) {
                const next = [...queue];
                next[existingIndex] = nextItem;
                return next;
              }
              return [...queue, nextItem];
            });
          }

          if (sync.mergedNewLineKeys.length > 0) {
            return { ...prev, [watch.id]: sync.mergedNewLineKeys };
          }
          if (!(watch.id in prev)) return prev;
          const next = { ...prev };
          delete next[watch.id];
          return next;
        });

        const snapshot = loadZkArrivedSnapshot(salesPersonId);
        snapshot[watch.id] = countRegalWaitingZkLines(
          zkWatchOrderHintsForWatch(watch, zkOrdersBySalesPerson).regalWaitingLineKeys
        );
        saveZkArrivedSnapshot(salesPersonId, snapshot);
      }

      if (lineChecksChanged) {
        setUnseenWatchIds((prev) => {
          if (!prev.has(watch.id)) return prev;
          const next = new Set(prev);
          next.delete(watch.id);
          return next;
        });
      }

      if (options?.triggerRouterRefresh) {
        refresh();
      }
    },
    [salesPersonId, zkOrdersBySalesPerson, zkLinkableOrders, refresh]
  );

  const markWarehouseArrivalSeen = useCallback(
    (watchId: string) => {
      if (!salesPersonId) return;
      const watch = zkWatches.find((w) => w.id === watchId);
      if (!watch) return;
      const snapshot = loadZkArrivedSnapshot(salesPersonId);
      snapshot[watchId] = countRegalWaitingZkLines(regalWaitingLineKeysByWatchId[watchId]);
      saveZkArrivedSnapshot(salesPersonId, snapshot);
      setUnseenWatchIds((prev) => {
        if (!prev.has(watchId)) return prev;
        const next = new Set(prev);
        next.delete(watchId);
        return next;
      });
    },
    [salesPersonId, zkWatches, regalWaitingLineKeysByWatchId]
  );

  const markNewZkLinesSeen = useCallback(
    (watchId: string) => {
      if (!salesPersonId) return;
      clearUnseenNewZkLineKeys(salesPersonId, watchId);
      setNewLineKeysByWatchId((prev) => {
        if (!(watchId in prev)) return prev;
        const next = { ...prev };
        delete next[watchId];
        return next;
      });
    },
    [salesPersonId]
  );

  const markNewlyAddedZkWatchSeen = useCallback(
    (watchId: string) => {
      if (!salesPersonId) return;
      clearNewlyAddedZkWatch(salesPersonId, watchId);
      setNewlyAddedWatchIds((prev) => {
        if (!prev.has(watchId)) return prev;
        const next = new Set(prev);
        next.delete(watchId);
        return next;
      });
    },
    [salesPersonId]
  );

  const validLineKeysByWatchId = useMemo(
    () => buildValidLineKeysByWatchId(zkWatches),
    [zkWatches]
  );

  const reconciledNewLineKeysByWatchId = useMemo(() => {
    if (!salesPersonId || tourDemo || !warehouseSnapshotReady) return newLineKeysByWatchId;
    return reconcileZkNewLinesSnapshot({
      snapshot: newLineKeysByWatchId,
      watches: zkWatches,
      hintsByWatchId: zkHintsByWatchId,
      validLineKeysByWatchId,
    });
  }, [
    salesPersonId,
    tourDemo,
    warehouseSnapshotReady,
    newLineKeysByWatchId,
    zkWatches,
    zkHintsByWatchId,
    validLineKeysByWatchId,
  ]);

  useEffect(() => {
    if (!salesPersonId || tourDemo) return;
    const storageKey = `notatnik-zk-new-lines-${salesPersonId}`;
    function onStorage(event: StorageEvent) {
      if (event.key !== storageKey) return;
      const snapshot = loadZkNewLinesSnapshot(salesPersonId);
      setNewLineKeysByWatchId(snapshot);
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [salesPersonId, tourDemo]);

  const subiektForNotepad = useMemo(() => {
    if (!subiektAvailability) return undefined;
    return {
      ...subiektAvailability,
      message: contextualizeSubiektMessage(subiektAvailability.message),
    };
  }, [subiektAvailability]);
  const subiektPropKey = subiektForNotepad
    ? `${subiektForNotepad.configured}\0${subiektForNotepad.reachable}\0${subiektForNotepad.checkedAt}\0${subiektForNotepad.shortLabel}\0${subiektForNotepad.message}`
    : "";
  const effectiveSubiektStatus = subiektStatus ?? subiektForNotepad;

  const handleSubiektStatusChange = useCallback((status: SubiektAvailability) => {
    setSubiektStatus({
      ...status,
      message: contextualizeSubiektMessage(status.message),
    });
  }, []);

  const dataSource = tourDemo ? demoInitial : initial;
  const dataSyncKey = tourDemo
    ? `demo:${demoInitial.zkWatches.map((w) => w.updated_at).join("\0")}`
    : `init:${initial.zkWatches.map((w) => w.updated_at).join("\0")}:${initial.notes.map((n) => n.updated_at).join("\0")}`;

  const warehouseUnseenKey = useMemo(() => {
    if (!salesPersonId || tourDemo || !warehouseSnapshotReady) return "";
    const snapshot = loadZkArrivedSnapshot(salesPersonId);
    return detectUnseenZkWarehouseArrivals(zkWatches, snapshot, regalWaitingLineKeysByWatchId).join(
      "\0"
    );
  }, [salesPersonId, tourDemo, warehouseSnapshotReady, zkWatches, regalWaitingLineKeysByWatchId]);

  if (subiektPropKey !== appliedSubiektPropKey) {
    setAppliedSubiektPropKey(subiektPropKey);
    setSubiektStatus(subiektForNotepad);
  }

  if (dataSyncKey !== appliedDataSyncKey) {
    setAppliedDataSyncKey(dataSyncKey);
    const next = dataSource;
    setZkWatches((prev) =>
      uniqueById(sortZkWatches(mergeRecordsByUpdatedAt(prev, next.zkWatches)))
    );
    setArchivedWatches((prev) =>
      uniqueById(
        sortZkWatches(mergeRecordsByUpdatedAt(prev, next.archivedZkWatches ?? []))
      )
    );
    setNotes((prev) => uniqueById(mergeRecordsByUpdatedAt(prev, next.notes)));
    setArchivedNotes((prev) => uniqueById(mergeRecordsByUpdatedAt(prev, next.archivedNotes)));
    if (tourDemo) setActiveTab("zk");
  }

  useEffect(() => {
    if (tourDemo || !salesPersonId || !warehouseSnapshotReady) return;
    const changes = detectZkWatchSnapshotSyncChanges(zkWatches, dataSource.zkWatches);
    for (const change of changes) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- side-effect sync badge ZK
      processZkWatchSnapshotChange(change.next, change.diff, {
        updateWatchState: false,
        triggerRouterRefresh: false,
      });
    }
    // Tylko po sync z serwera (appliedDataSyncKey), nie przy każdej lokalnej edycji ZK.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedDataSyncKey]);

  if (hydrated && !warehouseSnapshotReady && salesPersonId && !tourDemo) {
    const snapshot = loadZkArrivedSnapshot(salesPersonId);
    const newLinesSnapshot = loadZkNewLinesSnapshot(salesPersonId);
    const newlyAddedSnapshot = loadZkNewlyAddedSnapshot(salesPersonId);
    const validWatchIds = new Set(zkWatches.map((watch) => watch.id));
    const reconciledNewlyAdded = reconcileZkNewlyAddedSnapshot(newlyAddedSnapshot, validWatchIds);
    if (JSON.stringify(reconciledNewlyAdded) !== JSON.stringify(newlyAddedSnapshot)) {
      saveZkNewlyAddedSnapshot(salesPersonId, reconciledNewlyAdded);
    }
    setNewlyAddedWatchIds(new Set(reconciledNewlyAdded));

    const hintsMap = computeAllZkWatchOrderHints(zkWatches, zkLinkableOrders);
    const reconciledNewLines = reconcileZkNewLinesSnapshot({
      snapshot: newLinesSnapshot,
      watches: zkWatches,
      hintsByWatchId: hintsMap,
      validLineKeysByWatchId: buildValidLineKeysByWatchId(zkWatches),
    });
    if (JSON.stringify(reconciledNewLines) !== JSON.stringify(newLinesSnapshot)) {
      syncZkNewLinesSnapshot(salesPersonId, reconciledNewLines);
    }
    setNewLineKeysByWatchId(reconciledNewLines);

    if (Object.keys(snapshot).length === 0) {
      saveZkArrivedSnapshot(salesPersonId, buildZkArrivedSnapshot(zkWatches, regalWaitingLineKeysByWatchId));
      setWarehouseSnapshotReady(true);
    } else {
      const unseen = detectUnseenZkWarehouseArrivals(zkWatches, snapshot, regalWaitingLineKeysByWatchId);
      setWarehouseSnapshotReady(true);
      if (unseen.length) {
        setUnseenWatchIds(new Set(unseen));
        setWarehouseToast(
          unseen.length === 1
            ? "Towar z prośby czeka na regale — sprawdź Moje zamówienia."
            : `${unseen.length} spraw ZK ma towar na regale.`
        );
      }
    }
  }

  if (
    salesPersonId &&
    !tourDemo &&
    warehouseSnapshotReady &&
    JSON.stringify(reconciledNewLineKeysByWatchId) !== JSON.stringify(newLineKeysByWatchId)
  ) {
    syncZkNewLinesSnapshot(salesPersonId, reconciledNewLineKeysByWatchId);
    setNewLineKeysByWatchId(reconciledNewLineKeysByWatchId);
  }

  if (
    warehouseUnseenKey &&
    warehouseUnseenKey !== appliedWarehouseUnseenKey &&
    warehouseSnapshotReady
  ) {
    setAppliedWarehouseUnseenKey(warehouseUnseenKey);
    const unseen = warehouseUnseenKey.split("\0").filter(Boolean);
    setUnseenWatchIds((prev) => new Set([...prev, ...unseen]));
    const n = unseen.length;
    setWarehouseToast(
      n === 1
        ? "Towar z prośby czeka na regale — sprawdź Moje zamówienia."
        : `${n} spraw ZK ma towar na regale.`
    );
  }

  const focusParam = searchParams.get("focusWatch")?.trim() || null;
  const hasArchive = isZkSurface ? archivedWatches.length > 0 : archivedNotes.length > 0;
  const urlTabKey = `${searchParams.toString()}\0${focusWatchId ?? ""}\0${zkWatches.length}\0${archivedWatches.length}\0${archivedNotes.length}\0${hasArchive}`;
  if (!tourDemo && urlTabKey !== appliedUrlTabKey) {
    setAppliedUrlTabKey(urlTabKey);
    const hash = hydrated ? window.location.hash : "";
    setActiveTab(
      resolveNotatnikPageTab({
        tabParam: searchParams.get("tab"),
        hash,
        focusWatchId: focusParam ?? focusWatchId,
        watchInOpen: focusParam ? zkWatches.some((w) => w.id === focusParam) : undefined,
        watchInArchive: focusParam ? archivedWatches.some((w) => w.id === focusParam) : undefined,
        ignoreArchivedWatchFocus: Boolean(
          focusParam && recentlyClosedWatchId && focusParam === recentlyClosedWatchId
        ),
        defaultTab,
        archiveAvailable: hasArchive,
      })
    );
  }

  const archiveGuardKey = `${activeTab}\0${hasArchive}\0${defaultTab}`;
  useEffect(() => {
    if (tourDemo || activeTab !== "archive" || hasArchive) return;
    if (archiveGuardKey === appliedArchiveGuardKeyRef.current) return;
    appliedArchiveGuardKeyRef.current = archiveGuardKey;
    navigateToTab(defaultTab);
  }, [tourDemo, activeTab, hasArchive, archiveGuardKey, defaultTab, navigateToTab]);

  function handleTodayTaskClick(anchor: string, kind: NotepadTodayTaskKind) {
    if (kind === "note-follow-up") {
      navigateToTab("notes", { hash: anchor });
      return;
    }
    if (kind === "zk-follow-up" || kind === "zk-warehouse-arrival") {
      const watchId = anchor.startsWith("watch-") ? anchor.slice(6) : null;
      navigateToTab("zk", { hash: anchor, focusWatch: watchId });
      if (watchId) {
        setFocusWatchId(watchId);
      }
      if (watchId && kind === "zk-warehouse-arrival") {
        markWarehouseArrivalSeen(watchId);
      }
      return;
    }
  }

  function handleProsbaScopeRequested(watchId: string) {
    setProsbaScopeWatchId(watchId);
    setProsbaScopeOpenNonce((nonce) => nonce + 1);
  }

  function handleWatchAlreadyOnList(watch: SalesZkWatch) {
    setFocusWatchId(watch.id);
    if (!tourDemo) {
      navigateToTab("zk", { focusWatch: watch.id, hash: `watch-${watch.id}` });
    }
    flashNotepadAnchor(`watch-${watch.id}`);
  }

  function handleWatchAdded(watch: SalesZkWatch) {
    setZkWatches((prev) => uniqueById(sortZkWatches([watch, ...prev])));
    setArchivedWatches((prev) => prev.filter((w) => w.id !== watch.id));
    if (salesPersonId && !tourDemo) {
      markZkWatchNewlyAdded(salesPersonId, watch.id);
      setNewlyAddedWatchIds((prev) => new Set([watch.id, ...prev]));
    }
    const hasProductLines = buildZkWatchLineViews(watch).some((line) => line.key !== "summary");
    if (hasProductLines) {
      setProsbaScopeWatchId(watch.id);
      setProsbaScopeOpenNonce((nonce) => nonce + 1);
    }
    setFocusWatchId(watch.id);
    if (!tourDemo) {
      navigateToTab("zk", { focusWatch: watch.id, hash: `watch-${watch.id}` });
    }
    window.setTimeout(() => refresh(), 0);
    flashNotepadAnchor(`watch-${watch.id}`);
  }

  function handleProsbaScopeConfigured(watchId: string) {
    setProsbaScopeWatchId((current) => (current === watchId ? null : current));
    markNewlyAddedZkWatchSeen(watchId);
  }

  function handleWatchClosed(watchId: string, closedAt: string) {
    const watch = zkWatches.find((w) => w.id === watchId);
    const timing = createUndoTiming();
    const closingFocusedWatch =
      focusWatchId === watchId || searchParams.get("focusWatch")?.trim() === watchId;
    if (watch) {
      setArchivedWatches((archived) =>
        uniqueById([{ ...watch, closed_at: closedAt, updated_at: closedAt }, ...archived])
      );
      setUndo({
        type: "close-zk",
        watch: { ...watch, closed_at: closedAt, updated_at: closedAt },
        ...timing,
      });
    }
    setZkWatches((prev) => prev.filter((w) => w.id !== watchId));
    if (salesPersonId) {
      clearUnseenNewZkLineKeys(salesPersonId, watchId);
      clearNewlyAddedZkWatch(salesPersonId, watchId);
    }
    setNewLineKeysByWatchId((prev) => {
      if (!(watchId in prev)) return prev;
      const next = { ...prev };
      delete next[watchId];
      return next;
    });
    setNewlyAddedWatchIds((prev) => {
      if (!prev.has(watchId)) return prev;
      const next = new Set(prev);
      next.delete(watchId);
      return next;
    });
    if (closingFocusedWatch) {
      setRecentlyClosedWatchId(watchId);
      setFocusWatchId(null);
      if (!tourDemo) {
        navigateToTab("zk", { focusWatch: null, hash: "" });
      } else {
        setActiveTab("zk");
      }
    }
  }

  function handleWatchRestored(watch: SalesZkWatch) {
    setArchivedWatches((prev) => prev.filter((w) => w.id !== watch.id));
    setZkWatches((prev) => uniqueById(sortZkWatches([watch, ...prev])));
    setRecentlyClosedWatchId((id) => (id === watch.id ? null : id));
    focusHandledWatchRef.current = null;
    watchAnchorHandledRef.current = null;
    setFocusWatchId(watch.id);
    if (!tourDemo) {
      navigateToTab("zk", { focusWatch: watch.id, hash: `watch-${watch.id}` });
    }
    refresh();
  }

  function handleWatchRefreshed(
    watch: SalesZkWatch,
    refreshDiff?: ZkWatchRefreshDiff,
    options?: { skipRouterRefresh?: boolean }
  ) {
    const previous = zkWatches.find((w) => w.id === watch.id);
    const diff =
      refreshDiff ??
      (previous
        ? computeZkWatchRefreshDiff(previous, watch)
        : { addedLineKeys: [], removedLineKeys: [], quantityChanged: [] });
    processZkWatchSnapshotChange(watch, diff, {
      updateWatchState: true,
      triggerRouterRefresh: options?.skipRouterRefresh !== true,
    });
  }

  function handleRefreshPromptLater() {
    setRefreshPromptQueue((queue) => queue.slice(1));
  }

  function handleRefreshPromptConfirm() {
    setRefreshPromptQueue((queue) => queue.slice(1));
  }

  function handleRefreshScopePatched(watch: SalesZkWatch) {
    setZkWatches((prev) => uniqueById(sortZkWatches(prev.map((w) => (w.id === watch.id ? watch : w)))));
  }

  function handleNoteCreated(note: SalesNote) {
    setNotes((prev) => uniqueById([note, ...prev]));
    refresh();
    flashNotepadAnchor(`note-${note.id}`);
  }

  function handleNoteUpdated(note: SalesNote) {
    setNotes((prev) => prev.map((n) => (n.id === note.id ? note : n)));
    refresh();
  }

  function handleNotesReordered(next: SalesNote[], previousForUndo?: SalesNote[]) {
    setNotes(uniqueById(next));
    if (previousForUndo) {
      setUndo({ type: "reorder", notes: previousForUndo, ...createUndoTiming() });
    }
  }

  function handleNoteArchived(note: SalesNote) {
    const now = new Date().toISOString();
    setNotes((prev) => prev.filter((n) => n.id !== note.id));
    setArchivedNotes((archived) =>
      uniqueById([{ ...note, archived_at: now, updated_at: now }, ...archived])
    );
    setUndo({ type: "archive", note, ...createUndoTiming() });
  }

  function handleNoteRestored(note: SalesNote) {
    setArchivedNotes((prev) => prev.filter((n) => n.id !== note.id));
    setNotes((prev) => uniqueById([note, ...prev]));
    refresh();
  }

  function handleWatchDeleted(watchId: string) {
    setArchivedWatches((prev) => prev.filter((w) => w.id !== watchId));
    if (salesPersonId) {
      clearUnseenNewZkLineKeys(salesPersonId, watchId);
      clearNewlyAddedZkWatch(salesPersonId, watchId);
    }
    setNewLineKeysByWatchId((prev) => {
      if (!(watchId in prev)) return prev;
      const next = { ...prev };
      delete next[watchId];
      return next;
    });
    setNewlyAddedWatchIds((prev) => {
      if (!prev.has(watchId)) return prev;
      const next = new Set(prev);
      next.delete(watchId);
      return next;
    });
    refresh();
  }

  function handleNoteDeleted(noteId: string) {
    setArchivedNotes((prev) => prev.filter((n) => n.id !== noteId));
    refresh();
  }

  const hasZkArchive = archivedWatches.length > 0;
  const hasNotesArchive = archivedNotes.length > 0;

  const undoTitle =
    undo?.type === "archive"
      ? `Zarchiwizowano: „${undo.note.title?.trim() || undo.note.body.trim().slice(0, 48) || "Notatka"}”`
      : undo?.type === "reorder"
        ? "Zmieniono kolejność notatek"
        : undo?.type === "close-zk"
          ? `Zamknięto sprawę ${undo.watch.zk_number}`
          : "";
  const undoDescription = undo ? undoWindowBannerDescription() : "";

  return (
    <MyOrderPickupShelfDialogProvider>
    <div className={NOTATNIK_PAGE_CLASS}>
      {warehouseToast && !effectiveReadOnly ? (
        <NoticeToast notice={warehouseToast} onDismiss={() => setWarehouseToast(null)} />
      ) : null}
      {undoFeedback && !effectiveReadOnly ? (
        <NoticeToast
          notice={undoFeedback}
          stacked={Boolean(undo)}
          tone={undoFeedback.tone}
          onDismiss={() => setUndoFeedback(null)}
        />
      ) : null}
      {undo && !effectiveReadOnly ? (
        <UndoToast
          title={undoTitle}
          description={undoDescription}
          placement="floating"
          expiresAt={undo.expiresAt}
          onDismiss={dismissUndo}
          onUndo={() => void handleUndo()}
          undoShortcut={undoShortcut}
        />
      ) : null}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {liveAnnouncement}
      </div>

      <SalesPageAlerts
        teamPreview={
          teamPreview
            ? {
                salesPersonId: teamPreview.salesPersonId,
                salesPersonName: teamPreview.salesPersonName,
                readOnly: teamPreview.readOnly,
                scope: isZkSurface ? "zk" : "notatnik",
                isDelegate: teamPreview.isDelegate,
                startDate: teamPreview.startDate,
                endDate: teamPreview.endDate,
              }
            : null
        }
        linkError={linkError}
        linkErrorClassName="mb-4"
      />

      {activeDelegations.length > 0 ? (
        <DelegateSwitcher
          delegations={activeDelegations}
          activeDelegateFor={delegatePreview && teamPreview ? teamPreview.salesPersonId : null}
          surface={isZkSurface ? "zk" : "notatnik"}
        />
      ) : null}

      <Card padding={false} className="overflow-hidden">
        <CardHeader
          inset
          density="compact"
          title={pageTitle}
          hint={
            pageDescription
              ? undefined
              : isZkSurface
                ? SALES_PAGE_HEADER_HINTS.zk
                : NOTATNIK_NOTES_PAGE_HINT
          }
          hintAriaLabel={isZkSurface ? "O stronie ZK" : "O notatniku"}
          description={pageDescription}
          action={<NotatnikGuide surface={isZkSurface ? "zk" : "notes"} />}
          leading={
            <SectionHeadingIcon tileClassName={sectionIconTileBrandClass}>
              {isZkSurface ? <IconPackageCheck size={20} /> : <IconClipboardPen size={20} />}
            </SectionHeadingIcon>
          }
        />

        {loadError ? (
          <Alert tone="error" className={cn(salesChromeInsetClass, "mt-3")}>
            {loadError}
          </Alert>
        ) : null}

        {focusWatchError ? (
          <Alert tone="warning" className={cn(salesChromeInsetClass, "mt-3")}>
            {focusWatchError}
          </Alert>
        ) : null}

        {isZkSurface ? (
          <NotatnikTabBar
            value={activeTab}
            onChange={(tab) => navigateToTab(tab)}
            zkCount={zkWatches.length}
            notesCount={0}
            archiveCount={archivedWatches.length}
            showArchive={hasZkArchive}
            visibleTabs={["zk", "archive"]}
            archiveScope="zk"
          />
        ) : (
          <NotatnikTabBar
            value={activeTab}
            onChange={(tab) => navigateToTab(tab)}
            zkCount={0}
            notesCount={notes.length}
            archiveCount={archivedNotes.length}
            showArchive={hasNotesArchive}
            visibleTabs={["notes", "archive"]}
            archiveScope="notes"
          />
        )}

        {showSalesSyncStrip ? (
          <NotatnikZkStatusChrome
            subiektInitial={subiektForNotepad ?? undefined}
            onSubiektStatusChange={handleSubiektStatusChange}
          />
        ) : null}

        {isZkSurface && source.zkOrdersMigrationMissing && !tourDemo ? (
          <Alert tone="warning" className={cn(salesChromeInsetClass, "mt-3")}>
            Powiązanie ZK z prośbami wymaga migracji bazy:{" "}
            <code className="text-[0.85em]">052_individual_orders_sales_client_kh_id</code>,{" "}
            <code className="text-[0.85em]">055_individual_orders_source_zk</code>.
            Uruchom migracje Supabase — bez nich podpowiedzi i badge „Prośba w toku” mogą nie działać.
          </Alert>
        ) : null}

        {((isZkSurface && activeTab === "zk") || (!isZkSurface && activeTab === "notes")) ? (
          <TodayTasksSection
            watches={zkWatches}
            notes={notes}
            onTaskClick={handleTodayTaskClick}
            unseenWarehouseWatchIds={unseenWatchIds}
            inStockCountByWatchId={regalWaitingLineKeysByWatchId}
            kinds={[...todayTaskKinds]}
            embedded
          />
        ) : null}

        {isZkSurface && activeTab === "zk" ? (
          <ZkWatchSection
                watches={zkWatches}
                zkHintsByWatchId={zkHintsByWatchId}
                linkableOrders={zkLinkableOrders}
                unseenWatchIds={unseenWatchIds}
                newLineKeysByWatchId={reconciledNewLineKeysByWatchId}
                newlyAddedWatchIds={newlyAddedWatchIds}
                onWarehouseArrivalSeen={markWarehouseArrivalSeen}
                onNewZkLinesSeen={markNewZkLinesSeen}
                onNewlyAddedZkWatchSeen={markNewlyAddedZkWatchSeen}
                readOnly={effectiveReadOnly}
                delegatePreview={effectiveDelegatePreview}
                tourPreview={tourDemo}
                embedded
                compact={!tourDemo}
                subiektReachable={
                  tourDemo ? true : (effectiveSubiektStatus?.reachable ?? false)
                }
                subiektBlockedHint={
                  subiektStatus && !subiektStatus.reachable
                    ? `${contextualizeSubiektMessage(subiektStatus.message)} Dodawanie ZK będzie możliwe po przywróceniu połączenia.`
                    : undefined
                }
                onWatchAdded={tourDemo ? undefined : handleWatchAdded}
                onWatchAlreadyOnList={tourDemo ? undefined : handleWatchAlreadyOnList}
                onWatchClosed={tourDemo ? undefined : handleWatchClosed}
                onWatchRefreshed={tourDemo ? undefined : handleWatchRefreshed}
                prosbaScopeWatchId={prosbaScopeWatchId}
                prosbaScopeOpenNonce={prosbaScopeOpenNonce}
                onProsbaScopeConfigured={handleProsbaScopeConfigured}
                onProsbaScopeRequested={handleProsbaScopeRequested}
                focusWatchId={focusWatchId}
                onFocusWatchHandled={handleFocusWatchHandled}
                onLiveAnnounce={announceLive}
              />
        ) : null}

          {isZkSurface && activeTab === "archive" && hasZkArchive ? (
            <>
              <NotatnikArchiveCrossLink surface="zk" />
              <NotatnikArchivePanel
                mode="zk"
                archivedWatches={archivedWatches}
                archivedNotes={[]}
                readOnly={effectiveReadOnly}
                focusWatchId={focusWatchId}
                onFocusWatchHandled={handleFocusWatchHandled}
                onLiveAnnounce={announceLive}
                onWatchRestored={handleWatchRestored}
                onWatchDeleted={handleWatchDeleted}
              />
            </>
          ) : null}

          {!isZkSurface && activeTab === "notes" ? (
            <NotesSection
              notes={notes}
              readOnly={notesReadOnly}
              embedded
              focusNoteId={focusNoteId}
              onFocusNoteHandled={handleFocusNoteHandled}
              onNoteCreated={handleNoteCreated}
              onNoteUpdated={handleNoteUpdated}
              onNoteArchived={handleNoteArchived}
              onNotesReordered={handleNotesReordered}
            />
          ) : null}

          {!isZkSurface && activeTab === "archive" && hasNotesArchive ? (
            <>
              <NotatnikArchiveCrossLink surface="notes" />
              <NotatnikArchivePanel
                mode="notes"
                archivedWatches={[]}
                archivedNotes={archivedNotes}
                readOnly={notesReadOnly}
                focusNoteId={focusNoteId}
                onFocusNoteHandled={handleFocusNoteHandled}
                onNoteRestored={handleNoteRestored}
                onNoteDeleted={handleNoteDeleted}
              />
            </>
          ) : null}

        <AppBrandContentFooter mobileOnly />
      </Card>

      {refreshPrompt ? (
        <ZkWatchRefreshPromptModal
          watch={refreshPrompt.watch}
          diff={refreshPrompt.diff}
          uncoveredAddedKeys={refreshPrompt.uncoveredAddedKeys}
          queuePosition={refreshPromptQueue.length > 1 ? 1 : undefined}
          queueTotal={refreshPromptQueue.length > 1 ? refreshPromptQueue.length : undefined}
          orderHints={
            zkHintsByWatchId.get(refreshPrompt.watch.id) ??
            zkWatchOrderHintsForWatch(refreshPrompt.watch, zkOrdersBySalesPerson)
          }
          open
          onConfirm={handleRefreshPromptConfirm}
          onLater={handleRefreshPromptLater}
          onScopePatched={handleRefreshScopePatched}
        />
      ) : null}
    </div>
    </MyOrderPickupShelfDialogProvider>
  );
}
