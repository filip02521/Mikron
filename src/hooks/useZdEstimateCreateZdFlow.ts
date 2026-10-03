"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { ZdEstimatePendingIndividualOrder } from "@/lib/orders/zd-estimate-individual";
import {
  canCreateZdFromEstimateState,
  type buildZdCreatePreviewFromOrderable,
  type CanCreateZdState,
} from "@/lib/orders/zd-estimate-create-zd";
import type {
  ZdPostCreateMarkFreeze,
  ZdPostCreateSession,
} from "@/lib/orders/zd-estimate-post-create";

/**
 * Przepływ tworzenia ZD: okno Create / Powiąż ZD, zamrożony preview przy submit,
 * blokada po utworzeniu (także timeout), panel post-create i wiek listy.
 */
export function useZdEstimateCreateZdFlow() {
  /** Kiedy policzono bieżącą listę (Policz albo createdAt wznowionej sesji) — ostrzeżenie o starej liście. */
  const [listComputedAtMs, setListComputedAtMs] = useState<number | null>(null);
  /** Wiek listy w chwili otwarcia okna tworzenia ZD (minuty). */
  const [createListAgeMinutes, setCreateListAgeMinutes] = useState<number | null>(null);
  const [postCreate, setPostCreate] = useState<ZdPostCreateSession | null>(
    null
  );
  const [createZdOpen, setCreateZdOpen] = useState(false);
  const [createDoneDokId, setCreateDoneDokId] = useState<number | null>(null);
  const [createDoneDokNr, setCreateDoneDokNr] = useState<string | null>(null);
  /** Timeout create — lock bez dokId (dokument mógł powstać). */
  const [createUnconfirmedAttempt, setCreateUnconfirmedAttempt] =
    useState(false);
  const [creatingZd, setCreatingZd] = useState(false);
  /** Preview zamrożony przy starcie create — timeout / sesja / UI dialogu. */
  const createPreviewCaptureRef = useRef<ReturnType<
    typeof buildZdCreatePreviewFromOrderable
  > | null>(null);
  const [createPreviewFrozen, setCreatePreviewFrozen] = useState<ReturnType<
    typeof buildZdCreatePreviewFromOrderable
  > | null>(null);
  const createLineMetaCaptureRef = useRef<
    { twId: number; celAtLink: number; deltaAtLink: number }[] | null
  >(null);
  const createMarkFreezeCaptureRef = useRef<ZdPostCreateMarkFreeze | null>(
    null
  );
  /**
   * Freeze z timeout create — przeżywa dismiss panelu, aż do link / unlock / Policz.
   * Bez tego „Powiąż ZD” po zamknięciu panelu traci submit freeze + durable consume.
   */
  const timeoutRecoveryFreezeRef = useRef<ZdPostCreateMarkFreeze | null>(null);
  /** Mirror ref → state, żeby dialog nie czytał ref podczas renderu. */
  const [createMarkFreezeFrozen, setCreateMarkFreezeFrozen] =
    useState<ZdPostCreateMarkFreeze | null>(null);
  const [consumedOnThisZdIds, setConsumedOnThisZdIds] = useState<string[]>(
    []
  );
  const glowneRemovedForUndoRef = useRef<ZdEstimatePendingIndividualOrder[]>(
    []
  );
  /** ID ostatniej paczki Główne — undo nigdy nie cofa całego glowneMarkedIds. */
  const glowneUndoOrderIdsRef = useRef<string[]>([]);
  const rememberConsumedOrderIds = (ids: readonly string[]) => {
    if (!ids.length) return;
    setConsumedOnThisZdIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        const trimmed = String(id ?? "").trim();
        if (trimmed) next.add(trimmed);
      }
      return next.size === prev.length ? prev : [...next];
    });
  };
  const [linkNrPrefill, setLinkNrPrefill] = useState<string | null>(null);
  const [linkZdOpen, setLinkZdOpen] = useState(false);
  const [createUnlockedAfterDone, setCreateUnlockedAfterDone] = useState(false);
  const [createTimeoutUnlockConfirmOpen, setCreateTimeoutUnlockConfirmOpen] =
    useState(false);
  const [createUndoVisible, setCreateUndoVisible] = useState(false);

  const openCreateZdModal = useCallback(() => {
    setLinkZdOpen(false);
    setLinkNrPrefill(null);
    setCreateListAgeMinutes(
      listComputedAtMs != null ? (Date.now() - listComputedAtMs) / 60_000 : null
    );
    setCreateZdOpen(true);
  }, [listComputedAtMs]);
  const clearCreateZdCapture = useCallback(() => {
    setCreatingZd(false);
    createPreviewCaptureRef.current = null;
    setCreatePreviewFrozen(null);
    createLineMetaCaptureRef.current = null;
    createMarkFreezeCaptureRef.current = null;
    setCreateMarkFreezeFrozen(null);
  }, []);
  const closeCreateZdModal = useCallback(() => {
    setCreateZdOpen(false);
    clearCreateZdCapture();
  }, [clearCreateZdCapture]);
  const openLinkZdModal = useCallback(() => {
    closeCreateZdModal();
    setLinkZdOpen(true);
  }, [closeCreateZdModal]);

  /**
   * Reset create/link/post-create — nowe Policz, wznowienie sesji, zmiana zakresu
   * albo nieudane Policz (lista nieważna: zdejmij handoff i lock poprzedniego ZD).
   */
  const resetCreateZdFlow = useCallback(() => {
    setPostCreate(null);
    setConsumedOnThisZdIds([]);
    glowneRemovedForUndoRef.current = [];
    glowneUndoOrderIdsRef.current = [];
    setCreateDoneDokId(null);
    setCreateDoneDokNr(null);
    setCreateUnconfirmedAttempt(false);
    setCreateTimeoutUnlockConfirmOpen(false);
    setCreateUnlockedAfterDone(false);
    setCreateUndoVisible(false);
    setCreateZdOpen(false);
    setCreatingZd(false);
    setLinkZdOpen(false);
    setLinkNrPrefill(null);
    createPreviewCaptureRef.current = null;
    setCreatePreviewFrozen(null);
    createLineMetaCaptureRef.current = null;
    createMarkFreezeCaptureRef.current = null;
    setCreateMarkFreezeFrozen(null);
    timeoutRecoveryFreezeRef.current = null;
  }, []);

  return {
    listComputedAtMs,
    setListComputedAtMs,
    createListAgeMinutes,
    postCreate,
    setPostCreate,
    createZdOpen,
    setCreateZdOpen,
    createDoneDokId,
    setCreateDoneDokId,
    createDoneDokNr,
    setCreateDoneDokNr,
    createUnconfirmedAttempt,
    setCreateUnconfirmedAttempt,
    creatingZd,
    setCreatingZd,
    createPreviewCaptureRef,
    createPreviewFrozen,
    setCreatePreviewFrozen,
    createLineMetaCaptureRef,
    createMarkFreezeCaptureRef,
    timeoutRecoveryFreezeRef,
    createMarkFreezeFrozen,
    setCreateMarkFreezeFrozen,
    consumedOnThisZdIds,
    setConsumedOnThisZdIds,
    glowneRemovedForUndoRef,
    glowneUndoOrderIdsRef,
    rememberConsumedOrderIds,
    linkNrPrefill,
    setLinkNrPrefill,
    linkZdOpen,
    setLinkZdOpen,
    createUnlockedAfterDone,
    setCreateUnlockedAfterDone,
    createTimeoutUnlockConfirmOpen,
    setCreateTimeoutUnlockConfirmOpen,
    createUndoVisible,
    setCreateUndoVisible,
    openCreateZdModal,
    closeCreateZdModal,
    openLinkZdModal,
    resetCreateZdFlow,
  };
}

/** Czy można otworzyć okno tworzenia ZD — powód blokady do sticky / Alert. */
export function useZdEstimateCreateZdGate({
  configured,
  settingsTrusted,
  orderableCount,
  supplierId,
  khResolution,
  estimating,
  mutating,
  creating,
  createDoneDokId,
  createUnconfirmedAttempt,
  createUnlockedAfterDone,
  packagingPairConflictCount,
  explodeBomIncomplete,
  boostNeedsRecount,
  historyNeedsRecount,
  historyFetchFailed,
  pendingIndividualsError,
  pendingIndividualsTruncated,
  pendingIndividualsLoading,
  prosbaOverlapPending,
}: CanCreateZdState) {
  return useMemo(
    () =>
      canCreateZdFromEstimateState({
        configured,
        settingsTrusted,
        orderableCount,
        supplierId,
        khResolution,
        estimating,
        mutating,
        creating,
        createDoneDokId,
        createUnconfirmedAttempt,
        createUnlockedAfterDone,
        packagingPairConflictCount,
        explodeBomIncomplete,
        boostNeedsRecount,
        historyNeedsRecount,
        historyFetchFailed,
        pendingIndividualsError,
        pendingIndividualsTruncated,
        pendingIndividualsLoading,
        prosbaOverlapPending,
      }),
    [
      configured,
      settingsTrusted,
      orderableCount,
      supplierId,
      khResolution,
      estimating,
      mutating,
      creating,
      createDoneDokId,
      createUnconfirmedAttempt,
      createUnlockedAfterDone,
      packagingPairConflictCount,
      explodeBomIncomplete,
      boostNeedsRecount,
      historyNeedsRecount,
      historyFetchFailed,
      pendingIndividualsError,
      pendingIndividualsTruncated,
      pendingIndividualsLoading,
      prosbaOverlapPending,
    ]
  );
}
