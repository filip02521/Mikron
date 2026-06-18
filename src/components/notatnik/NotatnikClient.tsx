"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSalesOnboardingDemo } from "@/components/sales/SalesOnboardingContext";
import { buildOnboardingNotepadDemo } from "@/lib/sales/sales-onboarding-demo-data";
import { Card, CardHeader } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { UndoToast } from "@/components/ui/UndoToast";
import { Toast } from "@/components/ui/Toast";
import { IconPackageCheck, IconArchive, IconClipboardPen } from "@/components/icons/StrokeIcons";
import { SectionHeadingIcon } from "@/components/icons/SectionHeadingIcon";
import { AppBrandContentFooter } from "@/components/layout/AppBrandContentFooter";
import { salesChromeInsetClass } from "@/lib/ui/ontime-theme";
import { mergeRecordsByUpdatedAt, uniqueById } from "@/lib/sales/notepad-list";
import { useClientHydrated } from "@/lib/client/use-client-hydrated";
import { sortZkWatches } from "@/lib/sales/zk-watch-sort";
import { watchNeedsNotepadAttention } from "@/lib/sales/notepad-follow-up";
import {
  buildZkWatchLineViews,
} from "@/lib/sales/zk-watch-lines";
import {
  computeZkWatchOrderHints,
  type ZkWatchOrderHints,
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
  buildValidLineKeysByWatchId,
  reconcileZkNewLinesSnapshot,
  syncZkNewLinesSnapshot,
} from "@/lib/sales/zk-watch-new-lines-state";
import {
  computeZkWatchSupplementSync,
  detectZkWatchSnapshotSyncChanges,
} from "@/lib/sales/zk-watch-snapshot-sync";
import { ZkWatchRefreshPromptModal } from "./ZkWatchRefreshPromptModal";
import { ZkWatchSection } from "./ZkWatchSection";
import { NotesSection } from "./NotesSection";
import { NotatnikArchivePanel } from "./NotatnikArchivePanel";
import { NotatnikArchiveCrossLink } from "./NotatnikArchiveCrossLink";
import { TodayTasksSection } from "./TodayTasksSection";
import { NotatnikPanel } from "./NotatnikPanel";
import { NotatnikTabBar } from "./NotatnikTabBar";
import { NOTATNIK_PAGE_CLASS } from "./notatnik-layout";
import { SalesPageAlerts } from "@/components/sales/SalesPageAlerts";
import { NotatnikZkStatusChrome } from "./NotatnikZkStatusChrome";
import { NotatnikGuide } from "./NotatnikGuide";
import { ZkWatchStatusHint } from "./ZkWatchStatusHint";
import { sectionIconTileBrandClass } from "@/lib/ui/ontime-theme";
import {
  isUndoExpired,
  undoExpiresAtFromAnchor,
  undoExpiresAtNow,
  undoWindowBannerDescription,
} from "@/lib/orders/daily-panel-undo";
import {
  flashNotepadAnchor,
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
import { cn } from "@/lib/cn";
import { useUndoShortcutLabel } from "@/lib/platform/keyboard-shortcut-label";

type NotatnikUndoState = (
  | { type: "archive"; note: SalesNote }
  | { type: "reorder"; notes: SalesNote[] }
  | { type: "close-zk"; watch: SalesZkWatch }
) & { expiresAt: number };

const PAGE_INTRO_ZK =
  "Zamówienia klientów (ZK) z Subiekta — prośby do zakupów, magazyn i przypomnienia. Zamknięte sprawy są w zakładce Archiwum.";
const PAGE_INTRO_NOTES =
  "Prywatne notatki i przypomnienia — nie trafiają do działu zakupów. Zarchiwizowane notatki są w zakładce Archiwum.";

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
  pageTitle,
  pageDescription,
  subiektAvailability,
  linkError = null,
  loadError = null,
  teamPreview = null,
}: {
  initial: SalesNotepadData;
  initialFocusWatchId?: string | null;
  initialTab?: NotatnikPageTab;
  surface: NotatnikSurface;
  readOnly?: boolean;
  pageTitle: string;
  pageDescription?: string;
  subiektAvailability?: SubiektAvailability;
  linkError?: string | null;
  loadError?: string | null;
  teamPreview?: {
    salesPersonId: string;
    salesPersonName: string;
    readOnly?: boolean;
  } | null;
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
  const showSalesSyncStrip = isZkSurface && !effectiveReadOnly && !tourDemo;
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
  const [unseenWatchIds, setUnseenWatchIds] = useState<Set<string>>(() => new Set());
  const [warehouseToast, setWarehouseToast] = useState<string | null>(null);
  const [subiektStatus, setSubiektStatus] = useState<SubiektAvailability | undefined>(undefined);
  const [appliedSubiektPropKey, setAppliedSubiektPropKey] = useState("");
  const [appliedUrlTabKey, setAppliedUrlTabKey] = useState("");
  const [appliedArchiveGuardKey, setAppliedArchiveGuardKey] = useState("");
  const [prosbaScopeWatchId, setProsbaScopeWatchId] = useState<string | null>(null);
  const [prosbaScopeOpenNonce, setProsbaScopeOpenNonce] = useState(0);
  const [appliedDataSyncKey, setAppliedDataSyncKey] = useState("");
  const [warehouseSnapshotReady, setWarehouseSnapshotReady] = useState(false);
  const [appliedWarehouseUnseenKey, setAppliedWarehouseUnseenKey] = useState("");
  const [newLineKeysByWatchId, setNewLineKeysByWatchId] = useState<Record<string, string[]>>({});
  const [refreshPromptQueue, setRefreshPromptQueue] = useState<
    Array<{
      watch: SalesZkWatch;
      diff: ZkWatchRefreshDiff;
      uncoveredAddedKeys: string[];
    }>
  >([]);
  const refreshPrompt = refreshPromptQueue[0] ?? null;
  const focusHandledWatchRef = useRef<string | null>(null);
  const focusHandledNoteRef = useRef<string | null>(null);
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
      setFocusNoteId(null);
      if (tourDemo) return;

      const path = notatnikPagePathForTab(tab, isZkSurface ? "zk" : "notes");
      const params = new URLSearchParams(searchParams.toString());

      if (options?.focusWatch?.trim()) {
        params.set("focusWatch", options.focusWatch.trim());
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

      const hashRaw = options?.hash?.trim() ?? "";
      const hash = hashRaw
        ? hashRaw.startsWith("#")
          ? hashRaw
          : `#${hashRaw}`
        : options?.focusWatch?.trim()
          ? `#watch-${options.focusWatch.trim()}`
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
      return;
    }
    setUndo(null);
    try {
      if (snapshot.type === "archive") {
        const { note } = await actionRestoreSalesNote(snapshot.note.id);
        setArchivedNotes((prev) => prev.filter((n) => n.id !== snapshot.note.id));
        setNotes((prev) => uniqueById([note, ...prev]));
        flashNotepadAnchor(`note-${note.id}`);
        navigateToTab("notes", { hash: `note-${note.id}` });
      } else if (snapshot.type === "close-zk") {
        const { watch } = await actionUndoCloseZkWatch(snapshot.watch.id);
        setArchivedWatches((prev) => prev.filter((w) => w.id !== watch.id));
        setZkWatches((prev) => uniqueById(sortZkWatches([watch, ...prev])));
        flashNotepadAnchor(`watch-${watch.id}`);
        navigateToTab("zk", { hash: `watch-${watch.id}`, focusWatch: watch.id });
      } else {
        const ids = sortSalesNotes(snapshot.notes).map((n) => n.id);
        await actionReorderSalesNotes(ids);
        setNotes(uniqueById(snapshot.notes));
      }
      refresh();
    } catch {
      if (!isUndoExpired(snapshot.expiresAt)) setUndo(snapshot);
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
    const params = new URLSearchParams(window.location.search);
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
      if (focusHandledWatchRef.current === watchId) return;
      applyWatchFocus(watchId);
      return;
    }

    const anchor = parseNotepadHashAnchor(window.location.hash);
    if (anchor?.startsWith("note-")) {
      if (isZkSurface && !tourDemo) {
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
      if (inArchive) {
        if (!tourDemo) {
          navigateToTab("archive", { hash: anchor });
        } else {
          setActiveTab("archive");
        }
        if (focusHandledNoteRef.current !== noteId) {
          setFocusNoteId(noteId);
        }
        return;
      }
      if (inActive) {
        if (!tourDemo) {
          navigateToTab("notes", { hash: anchor });
        } else {
          setActiveTab("notes");
        }
        flashNotepadAnchor(anchor);
        return;
      }
      setActiveTab("notes");
      flashNotepadAnchor(anchor);
    }
  }, [applyWatchFocus, isZkSurface, navigateToTab, router, tourDemo]);

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
    syncWatchFocusFromLocation();
  }, [applyWatchFocus, initialFocus, syncWatchFocusFromLocation]);

  useEffect(() => {
    if (tourDemo) return;
    window.addEventListener("hashchange", syncWatchFocusFromLocation);
    return () => window.removeEventListener("hashchange", syncWatchFocusFromLocation);
  }, [syncWatchFocusFromLocation, tourDemo]);

  const salesPersonId =
    source.zkWatches[0]?.sales_person_id ?? source.notes[0]?.sales_person_id ?? null;

  const zkHintsByWatchId = useMemo(() => {
    const map = new Map<string, ZkWatchOrderHints>();
    for (const watch of zkWatches) {
      map.set(watch.id, computeZkWatchOrderHints(watch, zkLinkableOrders));
    }
    return map;
  }, [zkWatches, zkLinkableOrders]);

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
          computeZkWatchOrderHints(watch, zkLinkableOrders).regalWaitingLineKeys
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
    [salesPersonId, zkLinkableOrders, refresh]
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
  const subiektWarningVisible =
    isZkSurface && Boolean(subiektForNotepad) && effectiveSubiektStatus?.reachable === false;
  const showTodayTopDivider = showSalesSyncStrip && !subiektWarningVisible;

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
    const hintsMap = new Map(
      zkWatches.map((watch) => [
        watch.id,
        computeZkWatchOrderHints(watch, zkLinkableOrders),
      ])
    );
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
        defaultTab,
        archiveAvailable: hasArchive,
      })
    );
  }

  const archiveGuardKey = `${activeTab}\0${hasArchive}\0${defaultTab}`;
  if (
    !tourDemo &&
    activeTab === "archive" &&
    !hasArchive &&
    archiveGuardKey !== appliedArchiveGuardKey
  ) {
    setAppliedArchiveGuardKey(archiveGuardKey);
    navigateToTab(defaultTab);
  }

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

  function handleWatchAdded(watch: SalesZkWatch) {
    setZkWatches((prev) => uniqueById(sortZkWatches([watch, ...prev])));
    setArchivedWatches((prev) => prev.filter((w) => w.id !== watch.id));
    const hasProductLines = buildZkWatchLineViews(watch).some((line) => line.key !== "summary");
    if (hasProductLines) {
      setProsbaScopeWatchId(watch.id);
      setProsbaScopeOpenNonce((nonce) => nonce + 1);
    }
    flashNotepadAnchor(`watch-${watch.id}`);
  }

  function handleProsbaScopeConfigured(watchId: string) {
    setProsbaScopeWatchId((current) => (current === watchId ? null : current));
  }

  function handleWatchClosed(watchId: string, closedAt: string) {
    const watch = zkWatches.find((w) => w.id === watchId);
    const closedMs = Date.parse(closedAt);
    const expiresAt = Number.isFinite(closedMs)
      ? undoExpiresAtFromAnchor(closedMs)
      : undoExpiresAtNow();
    if (watch) {
      setArchivedWatches((archived) =>
        uniqueById([{ ...watch, closed_at: closedAt, updated_at: closedAt }, ...archived])
      );
      setUndo({
        type: "close-zk",
        watch: { ...watch, closed_at: closedAt, updated_at: closedAt },
        expiresAt,
      });
    }
    setZkWatches((prev) => prev.filter((w) => w.id !== watchId));
    if (salesPersonId) {
      clearUnseenNewZkLineKeys(salesPersonId, watchId);
    }
    setNewLineKeysByWatchId((prev) => {
      if (!(watchId in prev)) return prev;
      const next = { ...prev };
      delete next[watchId];
      return next;
    });
  }

  function handleWatchRestored(watch: SalesZkWatch) {
    setArchivedWatches((prev) => prev.filter((w) => w.id !== watch.id));
    setZkWatches((prev) => uniqueById(sortZkWatches([watch, ...prev])));
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
      setUndo({ type: "reorder", notes: previousForUndo, expiresAt: undoExpiresAtNow() });
    }
  }

  function handleNoteArchived(note: SalesNote) {
    const now = new Date().toISOString();
    setNotes((prev) => prev.filter((n) => n.id !== note.id));
    setArchivedNotes((archived) =>
      uniqueById([{ ...note, archived_at: now, updated_at: now }, ...archived])
    );
    setUndo({ type: "archive", note, expiresAt: undoExpiresAtNow() });
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
    }
    setNewLineKeysByWatchId((prev) => {
      if (!(watchId in prev)) return prev;
      const next = { ...prev };
      delete next[watchId];
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
  const followUpZkCount = zkWatches.filter((w) => watchNeedsNotepadAttention(w)).length;
  const warehouseArrivalCount = unseenWatchIds.size;
  const newZkLinesWatchCount = Object.keys(reconciledNewLineKeysByWatchId).length;

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
    <div className={NOTATNIK_PAGE_CLASS}>
      {warehouseToast && !effectiveReadOnly ? (
        <Toast message={warehouseToast} onDismiss={() => setWarehouseToast(null)} />
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
              }
            : null
        }
        linkError={linkError}
        linkErrorClassName="mb-4"
      />

      <Card padding={false} className="overflow-hidden">
        <CardHeader
          inset
          density="compact"
          title={pageTitle}
          description={pageDescription ?? (isZkSurface ? PAGE_INTRO_ZK : PAGE_INTRO_NOTES)}
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

        <TodayTasksSection
          watches={zkWatches}
          notes={notes}
          onTaskClick={handleTodayTaskClick}
          unseenWarehouseWatchIds={unseenWatchIds}
          inStockCountByWatchId={regalWaitingLineKeysByWatchId}
          kinds={[...todayTaskKinds]}
          embedded
          showTopDivider={showTodayTopDivider}
        />

        {isZkSurface && (activeTab === "zk" || tourDemo) ? (
          <ZkWatchStatusHint tourPreview={tourDemo} />
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

        {isZkSurface && activeTab === "zk" ? (
          <>
            {warehouseArrivalCount > 0 ||
            followUpZkCount > 0 ||
            newZkLinesWatchCount > 0 ? (
              <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 px-3 py-2 sm:px-4">
                {newZkLinesWatchCount > 0 ? (
                  <Badge variant="warning" className="text-[10px]">
                    {newZkLinesWatchCount === 1
                      ? "1 ZK z nową pozycją"
                      : `${newZkLinesWatchCount} ZK z nowymi pozycjami`}
                  </Badge>
                ) : null}
                {warehouseArrivalCount > 0 ? (
                  <Badge variant="success" className="text-[10px]">
                    {warehouseArrivalCount} na regale
                  </Badge>
                ) : null}
                {followUpZkCount > 0 ? (
                  <Badge variant="purple" className="text-[10px]">
                    {followUpZkCount}{" "}
                    {followUpZkCount === 1
                      ? "przypomnienie"
                      : followUpZkCount < 5
                        ? "przypomnienia"
                        : "przypomnień"}
                  </Badge>
                ) : null}
              </div>
            ) : null}
            <ZkWatchSection
                watches={zkWatches}
                zkHintsByWatchId={zkHintsByWatchId}
                unseenWatchIds={unseenWatchIds}
                newLineKeysByWatchId={reconciledNewLineKeysByWatchId}
                onWarehouseArrivalSeen={markWarehouseArrivalSeen}
                onNewZkLinesSeen={markNewZkLinesSeen}
                readOnly={effectiveReadOnly}
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
          </>
          ) : null}

          {isZkSurface && activeTab === "archive" && hasZkArchive ? (
            <NotatnikPanel
              flushBody
              bodyClassName="space-y-0"
              title="Archiwum ZK"
              description="Zamknięte sprawy ZK — możesz je przywrócić lub usunąć."
              count={archivedWatches.length || undefined}
              icon={<IconArchive size={17} />}
              tileClassName="bg-slate-100 text-slate-600"
            >
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
            </NotatnikPanel>
          ) : null}

          {!isZkSurface && activeTab === "notes" ? (
            <NotatnikPanel
              flushBody
              title="Notatki"
              description="Własne przypomnienia — nie trafiają do działu zakupów."
              count={notes.length || undefined}
              icon={<IconClipboardPen size={17} />}
              accent="indigo"
            >
              <NotesSection
                notes={notes}
                readOnly={effectiveReadOnly}
                embedded
                onNoteCreated={handleNoteCreated}
                onNoteUpdated={handleNoteUpdated}
                onNoteArchived={handleNoteArchived}
                onNotesReordered={handleNotesReordered}
              />
            </NotatnikPanel>
          ) : null}

          {!isZkSurface && activeTab === "archive" && hasNotesArchive ? (
            <NotatnikPanel
              flushBody
              bodyClassName="space-y-0"
              title="Archiwum"
              description="Zarchiwizowane notatki — możesz je przywrócić lub usunąć."
              count={archivedNotes.length || undefined}
              icon={<IconArchive size={17} />}
              tileClassName="bg-slate-100 text-slate-600"
            >
              <NotatnikArchiveCrossLink surface="notes" />
              <NotatnikArchivePanel
                mode="notes"
                archivedWatches={[]}
                archivedNotes={archivedNotes}
                readOnly={effectiveReadOnly}
                focusNoteId={focusNoteId}
                onFocusNoteHandled={handleFocusNoteHandled}
                onNoteRestored={handleNoteRestored}
                onNoteDeleted={handleNoteDeleted}
              />
            </NotatnikPanel>
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
            computeZkWatchOrderHints(refreshPrompt.watch, zkLinkableOrders)
          }
          open
          onConfirm={handleRefreshPromptConfirm}
          onLater={handleRefreshPromptLater}
        />
      ) : null}
    </div>
  );
}
