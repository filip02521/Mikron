"use client";

import { findSupplierFormTemplate } from "@/lib/supplier-forms/templates";
import { useEffect, useId, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  actionGetSupplierContact,
  actionGetZdEstimateScheduleMarkContext,
  actionMarkZdEstimateIndividualsGlowne,
  actionMarkZdEstimateSupplierOrdered,
  actionUndoZdEstimateDailyPanelChange,
} from "@/app/actions/zd-estimate";
import { ZdEstimateCreateRequestsPreview } from "@/components/zakupy/ZdEstimateCreateRequestsPreview";
import { SupplierDrawer } from "@/components/summary/SupplierDrawer";
import {
  actionGetSupplierPreview,
  type SupplierPreviewData,
} from "@/app/actions/supplier-preview";
import {
  orderPreviewRowsFromSnap,
  ZdEstimateOrderPreviewTable,
} from "@/components/zakupy/ZdEstimateOrderPreviewTable";
import { SupplierContactActions } from "@/components/procurement/SupplierContactActions";
import { Button } from "@/components/ui/Button";
import { ModalShell } from "@/components/ui/ModalShell";
import { Spinner } from "@/components/ui/Spinner";
import { UndoToast } from "@/components/ui/UndoToast";
import { cn } from "@/lib/cn";
import type { DailyPanelUndoPayload } from "@/lib/orders/daily-panel-undo";
import type { SupplierLocation } from "@/types/database";
import {
  buildMailtoHref,
  buildZdSupplierMailBody,
  buildZdSupplierMailto,
  pendingGlowneOrderIds,
  pendingGlownePreviewLists,
  postCreateLinesSnapshotToTsv,
  postCreateNeedsHistoryLink,
  type ZdPostCreateSession,
} from "@/lib/orders/zd-estimate-post-create";
import {
  formatPostCreateCandidatesHint,
  ZD_ESTIMATE_UI,
} from "@/lib/orders/zd-estimate-ui-copy";
import { buildSupplierContactUi } from "@/lib/orders/supplier-contact";
import { supplierCardsHref, supplierHubContextForRole } from "@/lib/supplier-hub";
import { copyTextToClipboard } from "@/lib/ui/copy-text-to-clipboard";
import { userFacingErrorTextFromMessage } from "@/lib/ui/user-facing-error";
import {
  IconAlertCircle,
  IconBuilding,
  IconCircleCheck,
  IconMail,
  IconDownload,
} from "@/components/icons/StrokeIcons";
import {
  buttonPrimaryClass,
  controlFocusClass,
  panelTypography,
  zdEstimateRadiusSurfaceClass,
  zdEstimateShadowControlClass,
} from "@/lib/ui/ontime-theme";

export function ZdEstimatePostCreatePanel({
  session,
  createLocked = false,
  onDismiss,
  onOpenLink,
  onUnlockCreate,
  onCopyError,
  onGlowneMarked,
  onScheduleMarked,
  onUndoMark,
}: {
  session: ZdPostCreateSession;
  /** Nieużywane od czasu stałej treści maila — zostawione dla zgodności wywołań. */
  dateKey?: string;
  /** Create nadal zablokowany — pokaż CTA w panelu (bez osobnego banera). */
  createLocked?: boolean;
  onDismiss: () => void;
  onOpenLink: () => void;
  onUnlockCreate?: () => void;
  onCopyError?: (message: string) => void;
  onGlowneMarked?: (result: {
    processedIds: string[];
    dropPendingIds: string[];
  }) => void;
  onScheduleMarked?: () => void;
  onUndoMark?: (kind: "glowne" | "schedule") => void;
}) {
  const router = useRouter();
  const subjectId = useId();
  const bodyId = useId();
  const [contactLoading, setContactLoading] = useState(true);
  const [contactError, setContactError] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [mails, setMails] = useState("");
  const [extraInfo, setExtraInfo] = useState("");
  const [location, setLocation] = useState<SupplierLocation>("POLSKA");
  const [mailBodyCopied, setMailBodyCopied] = useState(false);
  const [tsvCopied, setTsvCopied] = useState(false);
  const [tsvError, setTsvError] = useState(false);
  const [dokCopied, setDokCopied] = useState(false);
  const [mailOpen, setMailOpen] = useState(false);
  const [mailSubject, setMailSubject] = useState("");
  const [mailBody, setMailBody] = useState("");
  const [glownePending, startGlowne] = useTransition();
  const [schedulePending, startSchedule] = useTransition();
  const [glowneError, setGlowneError] = useState<string | null>(null);
  const [glowneInfo, setGlowneInfo] = useState<string | null>(null);
  /** glowneDone po samym dropie skipów — bez faktycznego oznaczenia Główne. */
  const [glowneDoneViaSkip, setGlowneDoneViaSkip] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [scheduleHint, setScheduleHint] = useState<string | null>(null);
  const [scheduleCanMark, setScheduleCanMark] = useState(false);
  const [undo, setUndo] = useState<{
    kind: "glowne" | "schedule";
    payload: DailyPanelUndoPayload;
    title: string;
  } | null>(null);
  const [undoBusy, setUndoBusy] = useState(false);
  const [supplierPreviewOpen, setSupplierPreviewOpen] = useState(false);
  const [supplierPreview, setSupplierPreview] = useState<{
    supplierId: string;
    data: SupplierPreviewData | null;
    error: string | null;
  } | null>(null);

  // Podgląd dostawcy wczytany w tle od razu — otwiera się bez czekania. Po zapisaniu planu
  // tygodnia (nowy termin) odświeżamy, żeby podgląd pokazywał aktualne daty.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await actionGetSupplierPreview(session.supplierId).catch(() => null);
      if (cancelled) return;
      setSupplierPreview({
        supplierId: session.supplierId,
        data: res?.ok ? res.data : null,
        error: res?.ok
          ? null
          : userFacingErrorTextFromMessage(
              res?.message ?? null,
              "Nie udało się wczytać podglądu dostawcy."
            ),
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [session.supplierId, session.scheduleDone]);

  const previewForSession =
    supplierPreview?.supplierId === session.supplierId ? supplierPreview : null;
  const previewLoading = !previewForSession;
  const previewError = previewForSession?.error ?? null;

  const glowneIds = pendingGlowneOrderIds(session.markFreeze);
  const glownePreview = pendingGlownePreviewLists(session.markFreeze);
  const hasRequestsPreview =
    Boolean(session.composedUwagi?.trim()) ||
    glownePreview.catalogRequests.length > 0 ||
    glownePreview.serviceLines.length > 0;
  const canAct =
    session.kind !== "timeout_recovery" &&
    session.dokId != null &&
    session.dokId > 0;
  // Dostawcy z własnym formularzem (Wiedent, Sirona…) — plik do maila w kroku „Wyślij”.
  const orderFormTemplate = canAct ? findSupplierFormTemplate(session.supplierName) : null;
  const orderForm = orderFormTemplate
    ? {
        kind: orderFormTemplate.kind,
        href: `/api/operations/supplier-forms/zd/${session.dokId}?supplierId=${encodeURIComponent(session.supplierId)}`,
      }
    : null;

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setContactLoading(true);
      setContactError(null);
    });
    void (async () => {
      const res = await actionGetSupplierContact(session.supplierId);
      if (cancelled) return;
      if (!res.ok) {
        setContactError(
          userFacingErrorTextFromMessage(
            res.message,
            "Nie udało się wczytać kontaktu dostawcy."
          )
        );
        setNotes("");
        setMails("");
        setExtraInfo("");
        setContactLoading(false);
        return;
      }
      setNotes(res.notes);
      setMails(res.mails);
      setExtraInfo(res.extra_info);
      setLocation(res.location);
      setContactLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [session.supplierId]);

  useEffect(() => {
    queueMicrotask(() => {
      setGlowneInfo(null);
      setGlowneDoneViaSkip(false);
      setGlowneError(null);
    });
  }, [session.dokId, session.createdAtMs, session.kind]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await actionGetZdEstimateScheduleMarkContext(
        session.supplierId
      );
      if (cancelled) return;
      if (!res.ok) {
        setScheduleCanMark(false);
        setScheduleHint(
          userFacingErrorTextFromMessage(
            res.message,
            "Nie udało się sprawdzić planu tygodnia dostawcy."
          )
        );
        return;
      }
      setScheduleCanMark(res.canMark);
      setScheduleHint(res.message);
    })();
    return () => {
      cancelled = true;
    };
  }, [session.supplierId, session.scheduleDone, session.createdAtMs]);

  const title =
    session.kind === "linked"
      ? ZD_ESTIMATE_UI.postCreateTitleLinked
      : session.kind === "timeout_recovery"
        ? ZD_ESTIMATE_UI.postCreateTitleTimeout
        : ZD_ESTIMATE_UI.postCreateTitleCreated;

  const dokLabel =
    session.dokNrPelny?.trim() || ZD_ESTIMATE_UI.postCreateDokUnconfirmed;
  const needLink = postCreateNeedsHistoryLink(session);
  const contactUi = buildSupplierContactUi(notes, mails, extraInfo);
  const email =
    contactUi.email ??
    (contactUi.contactLink?.kind === "mailto"
      ? contactUi.contactLink.label
      : null);
  const mailtoSeed = email
    ? buildZdSupplierMailto({
        email,
        dokNr: session.dokNrPelny,
        supplierName: session.supplierName,
        location,
      })
    : null;
  const candidatesHint = formatPostCreateCandidatesHint(
    session.recentCandidateCount ?? 0
  );

  const cardsHref = supplierCardsHref(supplierHubContextForRole("admin"), {
    q: session.supplierName,
  });

  const glowneStatus = session.glowneDone
    ? glowneDoneViaSkip
      ? ZD_ESTIMATE_UI.postCreateStatusGlowneClearedSkipped
      : ZD_ESTIMATE_UI.postCreateStatusGlowneDone
    : glowneIds.length
      ? ZD_ESTIMATE_UI.postCreateStatusGlownePending
      : ZD_ESTIMATE_UI.postCreateStatusGlowneNone;
  const scheduleStatus = session.scheduleDone
    ? ZD_ESTIMATE_UI.postCreateStatusScheduleDone
    : scheduleCanMark
      ? ZD_ESTIMATE_UI.postCreateStatusSchedulePending
      : scheduleHint || ZD_ESTIMATE_UI.postCreateStatusScheduleNone;

  const copyTsv = async () => {
    if (!session.linesSnapshot.length) return;
    const ok = await copyTextToClipboard(
      postCreateLinesSnapshotToTsv(session.linesSnapshot)
    );
    if (!ok) {
      setTsvError(true);
      onCopyError?.("Nie udało się skopiować TSV.");
      window.setTimeout(() => setTsvError(false), 3000);
      return;
    }
    setTsvError(false);
    setTsvCopied(true);
    window.setTimeout(() => setTsvCopied(false), 2000);
  };

  const copyDokNr = async () => {
    const nr = session.dokNrPelny?.trim();
    if (!nr) return;
    const ok = await copyTextToClipboard(nr);
    if (!ok) {
      onCopyError?.("Nie udało się skopiować numeru ZD.");
      return;
    }
    setDokCopied(true);
    window.setTimeout(() => setDokCopied(false), 2000);
  };

  const copyMailBody = async () => {
    const ok = await copyTextToClipboard(buildZdSupplierMailBody(location));
    if (!ok) {
      onCopyError?.("Nie udało się skopiować treści maila.");
      return;
    }
    setMailBodyCopied(true);
    window.setTimeout(() => setMailBodyCopied(false), 2000);
  };

  const openDzis = () => {
    const id = encodeURIComponent(session.supplierId);
    router.push(`/podsumowanie?view=dzis&supplierId=${id}`);
  };

  const openMailComposer = () => {
    if (!mailtoSeed) return;
    setMailSubject(mailtoSeed.subject);
    setMailBody(mailtoSeed.body);
    setMailOpen(true);
  };

  const composedHref =
    email && mailOpen
      ? buildMailtoHref({
          email,
          subject: mailSubject,
          body: mailBody,
        })
      : null;

  const markGlowne = () => {
    if (!canAct || session.glowneDone || !glowneIds.length || glownePending) {
      return;
    }
    setGlowneError(null);
    startGlowne(async () => {
      const res = await actionMarkZdEstimateIndividualsGlowne({
        supplierId: session.supplierId,
        orderIds: glowneIds,
      });
      if (!res.ok) {
        setGlowneError(
          userFacingErrorTextFromMessage(res.message, "Nie udało się oznaczyć Główne.")
        );
        return;
      }
      onGlowneMarked?.({
        processedIds: res.processedIds,
        dropPendingIds: [
          ...new Set([...res.processedIds, ...res.skippedIds]),
        ],
      });
      if (res.undo) {
        setGlowneDoneViaSkip(false);
        setGlowneInfo(null);
        setUndo({
          kind: "glowne",
          payload: res.undo,
          title: res.message,
        });
      } else if (res.processedIds.length === 0 && res.skippedIds.length) {
        setGlowneDoneViaSkip(true);
        setGlowneInfo(res.message);
        setGlowneError(null);
      } else {
        setGlowneDoneViaSkip(false);
        setGlowneInfo(null);
      }
    });
  };

  const markSchedule = () => {
    if (!canAct || session.scheduleDone || !scheduleCanMark || schedulePending) {
      return;
    }
    setScheduleError(null);
    startSchedule(async () => {
      const res = await actionMarkZdEstimateSupplierOrdered({
        supplierId: session.supplierId,
      });
      if (!res.ok) {
        setScheduleError(
          userFacingErrorTextFromMessage(res.message, "Nie udało się zapisać planu.")
        );
        return;
      }
      onScheduleMarked?.();
      setScheduleCanMark(false);
      if (res.undo) {
        setUndo({
          kind: "schedule",
          payload: res.undo,
          title: res.message,
        });
      }
    });
  };

  const undoMark = () => {
    if (!undo || undoBusy) return;
    const current = undo;
    setUndoBusy(true);
    void (async () => {
      const res = await actionUndoZdEstimateDailyPanelChange(current.payload);
      setUndoBusy(false);
      if (!res.ok) {
        onCopyError?.(res.message);
        return;
      }
      setUndo(null);
      if (current.kind === "glowne") {
        setGlowneDoneViaSkip(false);
        setGlowneInfo(null);
      }
      onUndoMark?.(current.kind);
    })();
  };

  const statusItems: Array<{
    key: string;
    label: string;
    ok: boolean;
    unsure?: boolean;
    soft?: boolean;
  }> = [
    {
      key: "subiekt",
      label:
        session.kind === "timeout_recovery"
          ? ZD_ESTIMATE_UI.postCreateStatusSubiektUnsure
          : ZD_ESTIMATE_UI.postCreateStatusSubiektOk,
      ok: session.kind !== "timeout_recovery",
      unsure: session.kind === "timeout_recovery",
    },
    {
      key: "history",
      label: session.snapshotOk
        ? ZD_ESTIMATE_UI.postCreateStatusHistoryOk
        : session.snapshotMessage?.trim() ||
          ZD_ESTIMATE_UI.postCreateStatusHistoryNeed,
      ok: session.snapshotOk,
    },
    {
      key: "glowne",
      label: glowneStatus,
      ok: session.glowneDone,
      soft: !session.glowneDone,
    },
    {
      key: "schedule",
      label: scheduleStatus,
      ok: session.scheduleDone,
      soft: !session.scheduleDone,
    },
  ];

  return (
    <>
      {/* Region aria-live dla czytników ekranu — komunikaty statusu akcji. */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {glowneError ? `Błąd oznaczania Główne: ${glowneError}. ` : null}
        {glowneInfo ? `${glowneInfo}. ` : null}
        {scheduleError ? `Błąd planu: ${scheduleError}. ` : null}
        {scheduleHint ? `${scheduleHint}. ` : null}
        {tsvError ? "Kopiowanie TSV nie powiodło się. " : null}
        {tsvCopied ? "TSV skopiowano. " : null}
      </div>
      <ModalShell
        open
        onClose={onDismiss}
        title={title}
        titleHint={ZD_ESTIMATE_UI.postCreateModalHint}
        titleHintAriaLabel="O panelu po utworzeniu ZD"
        titleId="zd-post-create-title"
        size="xl"
        tier="raised"
        bodyClassName="space-y-4 px-5 py-4 sm:px-6 sm:py-5"
        footer={
          <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              {createLocked && onUnlockCreate ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="min-h-11 w-full sm:w-auto"
                  onClick={onUnlockCreate}
                >
                  {ZD_ESTIMATE_UI.postCreateUnlockCta}
                </Button>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                className="min-h-11 w-full sm:w-auto"
                disabled={!session.linesSnapshot.length}
                onClick={() => void copyTsv()}
                aria-live="polite"
              >
                {tsvError
                  ? "Nie skopiowano"
                  : tsvCopied
                    ? "Skopiowano"
                    : ZD_ESTIMATE_UI.postCreateCopyTsvCta}
              </Button>
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
              <Button
                type="button"
                variant="ghost"
                className="min-h-11 w-full sm:w-auto"
                title={ZD_ESTIMATE_UI.postCreateDismissHint}
                onClick={onDismiss}
              >
                {ZD_ESTIMATE_UI.postCreateDismissCta}
              </Button>
              {needLink && session.kind !== "timeout_recovery" ? (
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 w-full border-amber-300 bg-amber-50 text-amber-950 hover:bg-amber-100 sm:w-auto"
                  onClick={onOpenLink}
                >
                  {ZD_ESTIMATE_UI.postCreateLinkHistoryCta}
                </Button>
              ) : null}
              <Button
                type="button"
                variant={session.kind === "timeout_recovery" ? "secondary" : "primary"}
                className="min-h-11 w-full sm:w-auto"
                onClick={openDzis}
              >
                {ZD_ESTIMATE_UI.postCreateDzisCta}
              </Button>
              {session.kind === "timeout_recovery" ? (
                <Button
                  type="button"
                  variant="primary"
                  className="min-h-11 w-full sm:w-auto"
                  onClick={onOpenLink}
                >
                  {ZD_ESTIMATE_UI.postCreateLinkTimeoutCta}
                </Button>
              ) : null}
            </div>
          </div>
        }
      >
        {session.kind === "timeout_recovery" ? (
          <section
            className="flex items-start gap-3 rounded-xl bg-amber-50 px-4 py-3.5 ring-1 ring-amber-200"
            aria-labelledby="zd-post-create-hero"
          >
            <IconAlertCircle
              size={28}
              className="mt-0.5 shrink-0 text-amber-600"
              aria-hidden
            />
            <div className="min-w-0 space-y-1">
              <p
                id="zd-post-create-hero"
                className="text-base font-semibold text-amber-950"
              >
                Nie wiadomo, czy ZD powstało w Subiekcie
              </p>
              <p className="text-sm leading-relaxed text-amber-950/90">
                {ZD_ESTIMATE_UI.postCreateTimeoutLockBody}
              </p>
              {candidatesHint ? (
                <p className="text-sm font-medium text-amber-950">
                  {candidatesHint}
                </p>
              ) : null}
              <div className="pt-1.5">
                <SupplierPreviewButton
                  loading={previewLoading}
                  error={previewError}
                  label={`Podgląd: ${session.supplierName}`}
                  onOpen={() => setSupplierPreviewOpen(true)}
                />
              </div>
            </div>
          </section>
        ) : (
          <section
            className="flex flex-col gap-3 rounded-xl bg-emerald-50/80 px-4 py-3.5 ring-1 ring-emerald-200 sm:flex-row sm:items-center sm:justify-between"
            aria-labelledby="zd-post-create-hero"
          >
            <div className="flex min-w-0 items-center gap-3">
              <IconCircleCheck
                size={32}
                className="shrink-0 text-emerald-600"
                aria-hidden
              />
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
                  {session.kind === "linked"
                    ? "Powiązano z dokumentem"
                    : "Utworzono w Subiekcie"}
                </p>
                <p
                  id="zd-post-create-hero"
                  className="truncate text-2xl font-semibold tabular-nums tracking-tight text-slate-900"
                >
                  {dokLabel}
                </p>
                <p className="flex min-w-0 items-center gap-1 text-sm text-slate-600">
                  <SupplierNameButton
                    name={session.supplierName}
                    disabled={!previewForSession?.data}
                    onOpen={() => setSupplierPreviewOpen(true)}
                  />
                  <span className="shrink-0">· {session.lineCount} poz.</span>
                </p>
              </div>
            </div>
            <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row">
              <SupplierPreviewButton
                loading={previewLoading}
                error={previewError}
                onOpen={() => setSupplierPreviewOpen(true)}
              />
              {session.dokNrPelny?.trim() ? (
                <Button
                  type="button"
                  variant="secondary"
                  className="min-h-10 w-full sm:w-auto"
                  onClick={() => void copyDokNr()}
                  aria-live="polite"
                >
                  {dokCopied ? "Skopiowano numer" : "Kopiuj numer ZD"}
                </Button>
              ) : null}
            </div>
          </section>
        )}

        {createLocked && session.kind !== "timeout_recovery" ? (
          <p className="rounded-md bg-amber-50/90 px-3 py-2 text-sm text-amber-950 ring-1 ring-amber-200/90">
            Tworzenie ZD zablokowane dla tej listy — odblokuj świadomie, powiąż ZD
            albo przelicz listę.
          </p>
        ) : null}
        {candidatesHint && session.kind !== "timeout_recovery" ? (
          <p className="rounded-md bg-amber-50/90 px-3 py-2 text-sm text-amber-950 ring-1 ring-amber-200/90">
            {candidatesHint}
          </p>
        ) : null}

        <ul className="flex flex-wrap gap-2" aria-label="Status">
          {statusItems.map((item) => (
            <li
              key={item.key}
              className={cn(
                "inline-flex max-w-full items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ring-1",
                item.unsure
                  ? "bg-amber-50 text-amber-950 ring-amber-200"
                  : item.ok
                    ? "bg-emerald-50 text-emerald-900 ring-emerald-200"
                    : item.soft
                      ? "bg-slate-50 text-slate-700 ring-slate-200"
                      : "bg-amber-50 text-amber-950 ring-amber-200"
              )}
            >
              <StatusDot
                ok={item.ok}
                unsure={item.unsure}
                soft={item.soft}
                className="mt-0"
              />
              <span className="min-w-0 truncate" title={item.label}>
                {item.label}
              </span>
            </li>
          ))}
        </ul>

        {session.bumped.length > 0 ||
        session.markFreeze.omittedServiceCount > 0 ||
        session.markFreeze.teethServiceCount > 0 ? (
          <ul className="space-y-1 text-xs leading-relaxed">
            {session.bumped.length > 0 ? (
              <li className="text-amber-950">
                Serwer podbił ilość na {session.bumped.length}{" "}
                {session.bumped.length === 1 ? "pozycji" : "pozycjach"} do
                pokrycia próśb
                {session.bumped.slice(0, 6).map((b) => (
                  <span key={b.twId} className="ml-1 tabular-nums">
                    ({b.from}→{b.to})
                  </span>
                ))}
                .
              </li>
            ) : null}
            {session.markFreeze.omittedServiceCount > 0 ? (
              <li className="text-amber-950">
                {session.markFreeze.omittedServiceCount} usług nie zmieściło się w
                uwagach — nie wejdą na listę Główne.
              </li>
            ) : null}
            {session.markFreeze.teethServiceCount > 0 ? (
              <li className="text-slate-600">{ZD_ESTIMATE_UI.createTeethNote}</li>
            ) : null}
          </ul>
        ) : null}

        <div
          className={cn(
            "grid gap-4 lg:items-start",
            hasRequestsPreview ? "lg:grid-cols-5" : null
          )}
        >
          <section
            className={cn(
              "border border-slate-200/80 bg-white p-3.5 sm:p-4",
              zdEstimateRadiusSurfaceClass,
              zdEstimateShadowControlClass,
              hasRequestsPreview ? "lg:col-span-3" : null
            )}
            aria-labelledby="zd-post-create-next"
          >
            <p
              id="zd-post-create-next"
              className={cn(panelTypography.sectionLabel, "text-slate-600")}
            >
              Co dalej
            </p>
            {!canAct ? (
              <p className="mt-2 text-sm leading-relaxed text-amber-900">
                {ZD_ESTIMATE_UI.postCreateMarksTimeoutHint}
              </p>
            ) : null}
            <ol className="mt-3 space-y-3">
              {canAct && (glowneIds.length > 0 || session.glowneDone) ? (
                <NextStep
                  n={1}
                  done={session.glowneDone}
                  doneLabel={
                    glowneDoneViaSkip
                      ? glowneInfo || ZD_ESTIMATE_UI.postCreateStatusGlowneClearedSkipped
                      : ZD_ESTIMATE_UI.postCreateStatusGlowneDone
                  }
                  title="Prośby jako Główne"
                  hint={ZD_ESTIMATE_UI.postCreateMarkGlowneHint}
                >
                  <Button
                    type="button"
                    variant={session.glowneDone ? "ghost" : "secondary"}
                    className="min-h-10 w-full sm:w-auto"
                    disabled={session.glowneDone || !glowneIds.length || glownePending}
                    onClick={markGlowne}
                    aria-busy={glownePending}
                  >
                    {glownePending ? (
                      <span className="inline-flex items-center gap-2">
                        <Spinner className="size-4" /> Odznaczam…
                      </span>
                    ) : session.glowneDone ? (
                      glowneDoneViaSkip
                        ? ZD_ESTIMATE_UI.postCreateStatusGlowneClearedSkipped
                        : ZD_ESTIMATE_UI.postCreateStatusGlowneDone
                    ) : (
                      `${ZD_ESTIMATE_UI.postCreateMarkGlowneCta}${
                        glowneIds.length ? ` (${glowneIds.length})` : ""
                      }`
                    )}
                  </Button>
                  {glowneInfo ? (
                    <p className="text-sm text-slate-700">{glowneInfo}</p>
                  ) : null}
                  {glowneError ? (
                    <p className="text-sm text-rose-800" role="alert">
                      {glowneError}
                    </p>
                  ) : null}
                </NextStep>
              ) : null}

              {canAct ? (
                <NextStep
                  n={glowneIds.length > 0 || session.glowneDone ? 2 : 1}
                  done={session.scheduleDone}
                  doneLabel={ZD_ESTIMATE_UI.postCreateStatusScheduleDone}
                  title="Plan tygodnia"
                  hint={ZD_ESTIMATE_UI.postCreateMarkScheduleHint}
                  warning={
                    session.scheduleDone || scheduleCanMark
                      ? ZD_ESTIMATE_UI.postCreateMarkDzisWarning
                      : null
                  }
                >
                  <Button
                    type="button"
                    variant={session.scheduleDone ? "ghost" : "secondary"}
                    className="min-h-10 w-full sm:w-auto"
                    disabled={
                      session.scheduleDone || !scheduleCanMark || schedulePending
                    }
                    onClick={markSchedule}
                    title={scheduleHint ?? undefined}
                    aria-busy={schedulePending}
                  >
                    {schedulePending ? (
                      <span className="inline-flex items-center gap-2">
                        <Spinner className="size-4" /> Zapisuję plan…
                      </span>
                    ) : session.scheduleDone ? (
                      ZD_ESTIMATE_UI.postCreateStatusScheduleDone
                    ) : (
                      ZD_ESTIMATE_UI.postCreateMarkScheduleCta
                    )}
                  </Button>
                  {scheduleError ? (
                    <p className="text-sm text-rose-800" role="alert">
                      {scheduleError}
                    </p>
                  ) : null}
                  {!scheduleCanMark && scheduleHint && !session.scheduleDone ? (
                    <p className="text-xs text-slate-600">{scheduleHint}</p>
                  ) : null}
                </NextStep>
              ) : null}

              <NextStep
                n={
                  !canAct
                    ? 1
                    : glowneIds.length > 0 || session.glowneDone
                      ? 3
                      : 2
                }
                done={false}
                title="Wyślij zamówienie do dostawcy"
              >
                {contactLoading ? (
                  <p className="inline-flex items-center gap-2 text-sm text-slate-600">
                    <Spinner className="size-4" /> Wczytuję kontakt…
                  </p>
                ) : contactError ? (
                  <p className="text-sm text-amber-900">{contactError}</p>
                ) : (
                  <div className="space-y-2">
                    {orderForm ? (
                      <div className="flex flex-col gap-2 rounded-md bg-slate-50 px-3 py-2.5 ring-1 ring-slate-200/80 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm text-slate-700">
                          {session.supplierName} przyjmuje zamówienia na swoim{" "}
                          {orderForm.kind === "pdf" ? "formularzu PDF" : "arkuszu Excel"} — pobierz go
                          wypełnionego tym ZD i dołącz do maila.
                        </p>
                        <a
                          href={orderForm.href}
                          download
                          className={cn(
                            buttonPrimaryClass,
                            "inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium"
                          )}
                        >
                          <IconDownload size={16} aria-hidden />
                          {orderForm.kind === "pdf" ? "Pobierz formularz (PDF)" : "Pobierz formularz (Excel)"}
                        </a>
                      </div>
                    ) : null}
                    <Button
                      type="button"
                      variant="secondary"
                      className="min-h-10 w-full sm:w-auto"
                      onClick={() => void copyMailBody()}
                    >
                      {mailBodyCopied
                        ? ZD_ESTIMATE_UI.postCreateMailBodyCopied
                        : location === "POLSKA"
                          ? ZD_ESTIMATE_UI.postCreateMailBodyCopyPl
                          : ZD_ESTIMATE_UI.postCreateMailBodyCopyEn}
                    </Button>
                    {mailtoSeed ? (
                      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                        <a
                          href={mailtoSeed.href}
                          className={cn(
                            buttonPrimaryClass,
                            "inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium sm:w-auto"
                          )}
                        >
                          <IconMail size={16} aria-hidden />
                          {ZD_ESTIMATE_UI.postCreateMailCta}
                        </a>
                        <Button
                          type="button"
                          variant="secondary"
                          className="min-h-10 w-full sm:w-auto"
                          onClick={openMailComposer}
                        >
                          {ZD_ESTIMATE_UI.postCreateMailComposeCta}
                        </Button>
                      </div>
                    ) : null}
                    <SupplierContactActions
                      notes={notes}
                      mails={mails}
                      extraInfo={extraInfo}
                    />
                    {!contactUi.contactLink && !contactUi.copyText ? (
                      <p className="text-sm text-slate-600">
                        {ZD_ESTIMATE_UI.postCreateNoContact}{" "}
                        <Link
                          href={cardsHref}
                          className="font-medium text-indigo-700 underline-offset-2 hover:underline"
                        >
                          {ZD_ESTIMATE_UI.postCreateCardsLink}
                        </Link>
                      </p>
                    ) : null}
                  </div>
                )}
              </NextStep>
            </ol>
          </section>

          {hasRequestsPreview && (
            <div className="space-y-4 lg:col-span-2">
              {session.composedUwagi ? (
                <section
                  className={cn(
                    "border border-slate-200/80 bg-slate-50/60 p-3.5 sm:p-4",
                    zdEstimateRadiusSurfaceClass
                  )}
                >
                  <p
                    className={cn(
                      panelTypography.sectionLabel,
                      "text-slate-600"
                    )}
                  >
                    {ZD_ESTIMATE_UI.postCreateUwagiTitle}
                  </p>
                  <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
                    {session.composedUwagi}
                  </p>
                </section>
              ) : null}

              <ZdEstimateCreateRequestsPreview
                catalogRequests={glownePreview.catalogRequests}
                serviceLines={glownePreview.serviceLines}
                glowneCatalogCount={
                  session.markFreeze.pendingGlowneCatalogIds.length
                }
                glowneServiceCount={
                  session.markFreeze.pendingGlowneServiceIds.length
                }
              />
            </div>
          )}
        </div>

        <ZdEstimateOrderPreviewTable
          lines={orderPreviewRowsFromSnap(session.linesSnapshot)}
          compact
        />
      </ModalShell>

      <SupplierDrawer
        mode="preview"
        supplier={supplierPreviewOpen ? (previewForSession?.data?.supplier ?? null) : null}
        vacationWindow={previewForSession?.data?.vacationWindow ?? null}
        teethLane={previewForSession?.data?.teethLane ?? null}
        subiektScope={previewForSession?.data?.subiektScope ?? null}
        deliveryStats={previewForSession?.data?.deliveryStats ?? null}
        statsMode={previewForSession?.data?.statsMode ?? "LACZNIE"}
        leadTimeDisplay={previewForSession?.data?.leadTimeDisplay}
        onClose={() => setSupplierPreviewOpen(false)}
      />

      {undo ? (
        <UndoToast
          placement="floating"
          title={undo.title}
          description="Masz chwilę na cofnięcie oznaczenia."
          onUndo={undoMark}
          onDismiss={() => {
            if (!undoBusy) setUndo(null);
          }}
        />
      ) : null}

      {mailOpen && mailtoSeed && email ? (
        <ModalShell
          open
          onClose={() => setMailOpen(false)}
          title={ZD_ESTIMATE_UI.postCreateMailComposeTitle}
          titleHint={ZD_ESTIMATE_UI.postCreateMailComposeHint}
          titleId="zd-post-create-mail-title"
          size="md"
          tier="top"
          bodyClassName="space-y-4 px-5 py-5 sm:px-6"
          footer={
            <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="ghost"
                className="min-h-11 w-full sm:w-auto"
                onClick={() => setMailOpen(false)}
              >
                Anuluj
              </Button>
              {composedHref ? (
                <a
                  href={composedHref}
                  className={cn(
                    buttonPrimaryClass,
                    "inline-flex min-h-11 w-full items-center justify-center rounded-md px-4 py-2 text-sm font-medium sm:w-auto"
                  )}
                  onClick={() => setMailOpen(false)}
                >
                  {ZD_ESTIMATE_UI.postCreateMailComposeOpen}
                </a>
              ) : (
                <Button
                  type="button"
                  className="min-h-11 w-full sm:w-auto"
                  disabled
                >
                  {ZD_ESTIMATE_UI.postCreateMailComposeOpen}
                </Button>
              )}
            </div>
          }
        >
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {ZD_ESTIMATE_UI.postCreateMailComposeTo}
            </p>
            <p className="mt-1 text-sm font-medium text-slate-900">{email}</p>
          </div>
          <div>
            <label
              htmlFor={subjectId}
              className="text-xs font-medium uppercase tracking-wide text-slate-500"
            >
              {ZD_ESTIMATE_UI.postCreateMailComposeSubject}
            </label>
            <input
              id={subjectId}
              value={mailSubject}
              onChange={(e) => setMailSubject(e.target.value)}
              className={cn(
                controlFocusClass,
                "mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
              )}
            />
          </div>
          <div>
            <label
              htmlFor={bodyId}
              className="text-xs font-medium uppercase tracking-wide text-slate-500"
            >
              {ZD_ESTIMATE_UI.postCreateMailComposeBody}
            </label>
            <textarea
              id={bodyId}
              value={mailBody}
              onChange={(e) => setMailBody(e.target.value)}
              rows={8}
              className={cn(
                controlFocusClass,
                "mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
              )}
            />
          </div>
        </ModalShell>
      ) : null}
    </>
  );
}

/** Nazwa dostawcy w nagłówku — klik otwiera podgląd (jak w panelu dziennym). */
function SupplierNameButton({
  name,
  disabled,
  onOpen,
}: {
  name: string;
  disabled: boolean;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={disabled}
      title={disabled ? undefined : "Podgląd dostawcy"}
      className={cn(
        controlFocusClass,
        "inline-flex min-w-0 items-center rounded font-medium text-slate-700 underline-offset-2 transition",
        "enabled:hover:text-indigo-700 enabled:hover:underline disabled:cursor-default"
      )}
    >
      <span className="truncate">{name}</span>
    </button>
  );
}

/** „Podgląd dostawcy” — kontakt, terminy, minimum, odbiór, Subiekt i historia bez wychodzenia z okna. */
function SupplierPreviewButton({
  loading,
  error,
  label = "Podgląd dostawcy",
  onOpen,
}: {
  loading: boolean;
  error: string | null;
  label?: string;
  onOpen: () => void;
}) {
  return (
    <Button
      type="button"
      variant="secondary"
      className="min-h-10 w-full sm:w-auto"
      disabled={loading || Boolean(error)}
      title={error ?? "Kontakt, terminy, minimum zamówienia, odbiór i historia dostawcy"}
      onClick={onOpen}
      aria-busy={loading}
    >
      {loading ? (
        <Spinner className="size-4" />
      ) : (
        <IconBuilding size={15} className="shrink-0" aria-hidden />
      )}
      <span className="truncate">{error ? "Podgląd niedostępny" : label}</span>
    </Button>
  );
}

function StatusDot({
  ok,
  unsure,
  soft,
  className,
}: {
  ok: boolean;
  unsure?: boolean;
  soft?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "mt-1.5 size-2.5 shrink-0 rounded-full ring-2 ring-white",
        className,
        unsure
          ? "bg-amber-500"
          : ok
            ? "bg-emerald-500"
            : soft
              ? "bg-slate-300"
              : "bg-amber-500"
      )}
      aria-hidden
    />
  );
}

function NextStep({
  n,
  done,
  doneLabel,
  title,
  hint,
  warning,
  children,
}: {
  n: number;
  done: boolean;
  /** Po wykonaniu: krótka linia zamiast opisu i przycisku. */
  doneLabel?: string | null;
  title: string;
  hint?: string | null;
  warning?: string | null;
  children: React.ReactNode;
}) {
  if (done && doneLabel) {
    return (
      <li className="flex gap-3">
        <span
          className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-semibold text-emerald-800"
          aria-hidden
        >
          ✓
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">{title}</p>
          <p className="mt-0.5 text-sm text-emerald-800">{doneLabel}</p>
        </div>
      </li>
    );
  }
  return (
    <li className="flex gap-3">
      <span
        className={cn(
          "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums",
          done
            ? "bg-emerald-100 text-emerald-800"
            : "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200"
        )}
        aria-hidden
      >
        {done ? "✓" : n}
      </span>
      <div className="min-w-0 flex-1 space-y-2">
        <div>
          <p className="text-sm font-semibold text-slate-900">{title}</p>
          {hint ? (
            <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{hint}</p>
          ) : null}
          {warning ? (
            <p className="mt-0.5 text-xs leading-relaxed text-amber-900">
              {warning}
            </p>
          ) : null}
        </div>
        {children}
      </div>
    </li>
  );
}
