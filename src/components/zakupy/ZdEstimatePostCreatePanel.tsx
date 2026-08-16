"use client";

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
import {
  buildMailtoHref,
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
import {
  buttonPrimaryClass,
  controlFocusClass,
  panelTypography,
} from "@/lib/ui/ontime-theme";

export function ZdEstimatePostCreatePanel({
  session,
  dateKey,
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
  dateKey: string;
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
  const [tsvCopied, setTsvCopied] = useState(false);
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
        setContactError(res.message);
        setNotes("");
        setMails("");
        setExtraInfo("");
        setContactLoading(false);
        return;
      }
      setNotes(res.notes);
      setMails(res.mails);
      setExtraInfo(res.extra_info);
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
        setScheduleHint(res.message);
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
        lineCount: session.lineCount,
        dateKey,
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

  const headerDescription = [
    dokLabel,
    session.supplierName,
    `${session.lineCount} poz.`,
  ]
    .filter(Boolean)
    .join(" · ");

  const copyTsv = async () => {
    if (!session.linesSnapshot.length) return;
    const ok = await copyTextToClipboard(
      postCreateLinesSnapshotToTsv(session.linesSnapshot)
    );
    if (!ok) {
      onCopyError?.("Nie udało się skopiować TSV.");
      return;
    }
    setTsvCopied(true);
    window.setTimeout(() => setTsvCopied(false), 2000);
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
        setGlowneError(res.message);
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
        setScheduleError(res.message);
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
      <ModalShell
        open
        onClose={onDismiss}
        title={title}
        description={headerDescription}
        titleHint={ZD_ESTIMATE_UI.postCreateModalHint}
        titleHintAriaLabel="O panelu po utworzeniu ZD"
        titleId="zd-post-create-title"
        size="xl"
        tier="raised"
        bodyClassName="space-y-4 px-5 py-4 sm:px-6 sm:py-5"
        footer={
          <div className="flex w-full flex-col gap-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
              {session.fromDaily ? (
                <Button
                  type="button"
                  variant="primary"
                  className="min-h-11 w-full sm:w-auto"
                  onClick={openDzis}
                >
                  {ZD_ESTIMATE_UI.postCreateDzisCta}
                </Button>
              ) : null}

              {mailtoSeed ? (
                <>
                  <a
                    href={mailtoSeed.href}
                    className={cn(
                      session.fromDaily
                        ? "inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-[var(--card-border)] bg-[var(--card)] px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 sm:w-auto"
                        : cn(
                            buttonPrimaryClass,
                            "inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium sm:w-auto"
                          )
                    )}
                  >
                    {ZD_ESTIMATE_UI.postCreateMailCta}
                  </a>
                  <Button
                    type="button"
                    variant="secondary"
                    className="min-h-11 w-full sm:w-auto"
                    onClick={openMailComposer}
                  >
                    {ZD_ESTIMATE_UI.postCreateMailComposeCta}
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  variant={session.fromDaily ? "secondary" : "primary"}
                  className="min-h-11 w-full sm:w-auto"
                  disabled
                  title={ZD_ESTIMATE_UI.postCreateMailDisabled}
                >
                  {ZD_ESTIMATE_UI.postCreateMailCta}
                </Button>
              )}

              {!session.fromDaily ? (
                <Button
                  type="button"
                  variant="secondary"
                  className="min-h-11 w-full sm:w-auto"
                  onClick={openDzis}
                >
                  {ZD_ESTIMATE_UI.postCreateDzisCta}
                </Button>
              ) : null}

              {needLink ? (
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 w-full border-amber-300 bg-amber-50 text-amber-950 hover:bg-amber-100 sm:w-auto"
                  onClick={onOpenLink}
                >
                  {session.kind === "timeout_recovery"
                    ? ZD_ESTIMATE_UI.postCreateLinkTimeoutCta
                    : ZD_ESTIMATE_UI.postCreateLinkHistoryCta}
                </Button>
              ) : null}
            </div>

            <div className="flex flex-col gap-2 border-t border-slate-100 pt-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                {createLocked && onUnlockCreate ? (
                  <Button
                    type="button"
                    variant="secondary"
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
                >
                  {tsvCopied
                    ? "Skopiowano"
                    : ZD_ESTIMATE_UI.postCreateCopyTsvCta}
                </Button>
              </div>
              <Button
                type="button"
                variant="ghost"
                className="min-h-11 w-full sm:w-auto"
                title={ZD_ESTIMATE_UI.postCreateDismissHint}
                onClick={onDismiss}
              >
                {ZD_ESTIMATE_UI.postCreateDismissCta}
              </Button>
            </div>
          </div>
        }
      >
        {(candidatesHint || createLocked) && (
          <div className="space-y-2">
            {candidatesHint ? (
              <p className="rounded-lg border border-amber-200/90 bg-amber-50/90 px-3 py-2 text-sm text-amber-950">
                {candidatesHint}
              </p>
            ) : null}
            {createLocked ? (
              <p className="rounded-lg border border-amber-200/90 bg-amber-50/90 px-3 py-2 text-sm text-amber-950">
                {session.kind === "timeout_recovery"
                  ? ZD_ESTIMATE_UI.postCreateTimeoutLockBody
                  : "Tworzenie ZD zablokowane dla tej listy — odblokuj świadomie, powiąż ZD albo przelicz listę."}
              </p>
            ) : null}
          </div>
        )}

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {statusItems.map((item) => (
            <div
              key={item.key}
              className="flex items-start gap-2.5 rounded-lg border border-slate-200/80 bg-slate-50/70 px-3 py-2.5"
            >
              <StatusDot
                ok={item.ok}
                unsure={item.unsure}
                soft={item.soft}
              />
              <span className="min-w-0 text-sm leading-snug text-slate-800">
                {item.label}
              </span>
            </div>
          ))}
        </div>

        {session.bumped.length > 0 ? (
          <p className="rounded-lg border border-amber-200/80 bg-amber-50/80 px-3 py-2 text-xs leading-relaxed text-amber-950">
            Serwer podbił ilość na {session.bumped.length}{" "}
            {session.bumped.length === 1 ? "pozycji" : "pozycjach"} do pokrycia
            próśb
            {session.bumped.slice(0, 6).map((b) => (
              <span key={b.twId} className="ml-1 tabular-nums">
                ({b.from}→{b.to})
              </span>
            ))}
            .
          </p>
        ) : null}

        {session.markFreeze.teethServiceCount > 0 ? (
          <p className="text-xs leading-relaxed text-slate-600">
            {ZD_ESTIMATE_UI.createTeethNote}
          </p>
        ) : null}

        {session.markFreeze.omittedServiceCount > 0 ? (
          <p className="rounded-lg border border-amber-200/80 bg-amber-50/80 px-3 py-2 text-xs text-amber-950">
            {session.markFreeze.omittedServiceCount} usług nie zmieściło się w
            uwagach — nie wejdą na listę Główne.
          </p>
        ) : null}

        <div
          className={cn(
            "grid gap-4 lg:items-start",
            hasRequestsPreview ? "lg:grid-cols-5" : null
          )}
        >
          <div
            className={cn(
              "space-y-4",
              hasRequestsPreview ? "lg:col-span-3" : null
            )}
          >
            <section className="rounded-xl border border-slate-200/80 bg-white p-3.5 sm:p-4">
              <p className={cn(panelTypography.sectionLabel, "text-slate-500")}>
                {ZD_ESTIMATE_UI.postCreateMarksTitle}
              </p>
              {!canAct ? (
                <p className="mt-2 text-sm leading-relaxed text-amber-900">
                  {ZD_ESTIMATE_UI.postCreateMarksTimeoutHint}
                </p>
              ) : (
                <div className="mt-3 space-y-3">
                  <div className="space-y-1.5 text-xs leading-relaxed text-slate-600">
                    <p>{ZD_ESTIMATE_UI.postCreateMarkGlowneHint}</p>
                    <p>{ZD_ESTIMATE_UI.postCreateMarkScheduleHint}</p>
                    <p className="text-amber-900">
                      {ZD_ESTIMATE_UI.postCreateMarkDzisWarning}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                    <Button
                      type="button"
                      variant="secondary"
                      className="min-h-11 w-full sm:w-auto"
                      disabled={
                        session.glowneDone ||
                        !glowneIds.length ||
                        glownePending
                      }
                      onClick={markGlowne}
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
                    <Button
                      type="button"
                      variant="secondary"
                      className="min-h-11 w-full sm:w-auto"
                      disabled={
                        session.scheduleDone ||
                        !scheduleCanMark ||
                        schedulePending
                      }
                      onClick={markSchedule}
                      title={scheduleHint ?? undefined}
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
                  </div>
                  {glowneInfo ? (
                    <p className="rounded-md border border-slate-200/80 bg-slate-50/80 px-2.5 py-2 text-sm text-slate-800">
                      {glowneInfo}
                    </p>
                  ) : null}
                  {glowneError ? (
                    <p className="text-sm text-rose-800">{glowneError}</p>
                  ) : null}
                  {scheduleError ? (
                    <p className="text-sm text-rose-800">{scheduleError}</p>
                  ) : null}
                  {!scheduleCanMark &&
                  scheduleHint &&
                  !session.scheduleDone ? (
                    <p className="text-xs text-slate-600">{scheduleHint}</p>
                  ) : null}
                </div>
              )}
            </section>

            <section className="rounded-xl border border-slate-200/80 bg-white p-3.5 sm:p-4">
              <p className={cn(panelTypography.sectionLabel, "text-slate-500")}>
                Kontakt dostawcy
              </p>
              {contactLoading ? (
                <p className="mt-2 inline-flex items-center gap-2 text-sm text-slate-600">
                  <Spinner className="size-4" /> Wczytuję…
                </p>
              ) : contactError ? (
                <p className="mt-2 text-sm text-amber-900">{contactError}</p>
              ) : (
                <div className="mt-2 space-y-2">
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
            </section>
          </div>

          {hasRequestsPreview && (
            <div className="space-y-4 lg:col-span-2">
              {session.composedUwagi ? (
                <section className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-3.5 sm:p-4">
                  <p
                    className={cn(
                      panelTypography.sectionLabel,
                      "text-slate-500"
                    )}
                  >
                    Uwagi na dokumencie
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
                "mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
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
                "mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              )}
            />
          </div>
        </ModalShell>
      ) : null}
    </>
  );
}

function StatusDot({
  ok,
  unsure,
  soft,
}: {
  ok: boolean;
  unsure?: boolean;
  soft?: boolean;
}) {
  return (
    <span
      className={cn(
        "mt-1.5 size-2 shrink-0 rounded-full ring-2 ring-white",
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
