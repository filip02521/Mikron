"use client";

import { findSupplierFormTemplate } from "@/lib/supplier-forms/templates";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  actionGetSupplierContact,
  actionGetZdEstimateScheduleMarkContext,
  actionUndoZdEstimateDailyPanelChange,
  actionZdEstimateSupplierEta,
} from "@/app/actions/zd-estimate";
import { zdCreateEtaTile } from "@/lib/orders/zd-estimate-create-zd";
import {
  actionGmailStatus,
  actionZdSupplierEmailSent,
  type GmailStatus,
} from "@/app/actions/gmail";
import type { SupplierOrderEmail } from "@/lib/google/gmail-connections";
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
import { ZdSendWorkspace, type ZdSendSimulation } from "@/components/zakupy/ZdSendWorkspace";
import { ModalShell } from "@/components/ui/ModalShell";
import { Spinner } from "@/components/ui/Spinner";
import { UndoToast } from "@/components/ui/UndoToast";
import { cn } from "@/lib/cn";
import type { DailyPanelUndoPayload } from "@/lib/orders/daily-panel-undo";
import type { SupplierLocation } from "@/types/database";
import {
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
  previewOnly = false,
  sendSimulation = null,
}: {
  session: ZdPostCreateSession;
  /** Harness UI (e2e-lab): bez zapisów — Główne / plan / cofnij nic nie wysyłają. */
  previewOnly?: boolean;
  /** Nieużywane od czasu stałej treści maila — zostawione dla zgodności wywołań. */
  dateKey?: string;
  /** Laboratorium: przebieg wysyłki na niby (tylko z previewOnly). */
  sendSimulation?: ZdSendSimulation | null;
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
  const [gmail, setGmail] = useState<GmailStatus | null>(null);
  /** Wysyłka tego ZD z OnTime sprzed otwarcia panelu (np. przed odświeżeniem strony). */
  const [previousSend, setPreviousSend] = useState<SupplierOrderEmail | null>(null);
  const [scheduleHint, setScheduleHint] = useState<string | null>(null);
  const [scheduleCanMark, setScheduleCanMark] = useState(false);
  const [undo, setUndo] = useState<{
    kind: "glowne" | "schedule";
    payload: DailyPanelUndoPayload;
    title: string;
  } | null>(null);
  const [undoBusy, setUndoBusy] = useState(false);
  const [supplierPreviewOpen, setSupplierPreviewOpen] = useState(false);
  /** Stopka okna: tu trafiają przyciski wysyłki z ZdSendWorkspace (portal). */
  const [sendActionsSlot, setSendActionsSlot] = useState<HTMLDivElement | null>(null);
  const [eta, setEta] = useState<{
    supplierId: string;
    dateKey: string | null;
    businessDays: number | null;
  } | null>(null);
  useEffect(() => {
    if (session.kind === "timeout_recovery") return;
    let cancelled = false;
    void actionZdEstimateSupplierEta(session.supplierId)
      .then((res) => {
        if (!cancelled) {
          setEta({
            supplierId: session.supplierId,
            dateKey: res.ok ? (res.eta?.dateKey ?? null) : null,
            businessDays: res.ok ? (res.eta?.businessDays ?? null) : null,
          });
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [session.kind, session.supplierId]);
  const etaTile = zdCreateEtaTile(
    eta && eta.supplierId === session.supplierId
      ? { status: "done", dateKey: eta.dateKey, businessDays: eta.businessDays }
      : { status: "loading", dateKey: null, businessDays: null }
  );
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

  // Status Gmaila: przy otwarciu i po powrocie do karty (łączenie idzie w nowej karcie —
  // panel po utworzeniu ZD żyje tylko w pamięci strony i zniknąłby przy przejściu do Google).
  useEffect(() => {
    let cancelled = false;
    const refresh = () =>
      void actionGmailStatus()
        .then((res) => {
          if (!cancelled) setGmail(res);
        })
        // Bez statusu Gmaila okno nie może czekać w nieskończoność — tryb ręczny.
        .catch(() => {
          if (!cancelled) setGmail((g) => g ?? { configured: false, email: null, signature: "" });
        });
    refresh();
    window.addEventListener("focus", refresh);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", refresh);
    };
  }, []);

  useEffect(() => {
    const dokId = session.dokId;
    if (dokId == null || dokId <= 0 || previewOnly) return;
    let cancelled = false;
    void actionZdSupplierEmailSent(dokId)
      .then((res) => {
        if (!cancelled) setPreviousSend(res);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [session.dokId, previewOnly]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setContactLoading(true);
      setContactError(null);
    });
    void (async () => {
      const res = await actionGetSupplierContact(session.supplierId).catch((e: unknown) => ({
        ok: false as const,
        message: e instanceof Error ? e.message : "Nie udało się wczytać kontaktu dostawcy.",
      }));
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
    ? ZD_ESTIMATE_UI.postCreateStatusGlowneDone
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


  const gmailEmail = gmail?.email ?? null;
  // Okno wysyłki z podglądem pokazujemy też w trybie podglądu (laboratorium) — tylko „Wyślij” jest wtedy wyłączone.
  const canGmailCompose = Boolean(gmailEmail) && canAct;
  const gmailConnectHref = "/api/google/connect?returnTo=/ustawienia";




  const undoMark = () => {
    if (previewOnly || !undo || undoBusy) return;
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

  // Gdy OnTime nie wyśle maila samo: kontakt dostawcy i gotowa treść do własnej poczty / portalu.
  const manualContact = (
    <div className="space-y-2">
      {contactError ? <p className="text-sm text-amber-900">{contactError}</p> : null}
      <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700 ring-1 ring-slate-200/80">
        {!email
          ? `${session.supplierName} nie ma na karcie adresu do zamówień - zamów jak zwykle (portal, telefon).`
          : gmail?.configured && !gmailEmail
            ? "Twój Gmail nie jest połączony z OnTime - wyślij ze swojej poczty albo połącz Gmaila (nowa karta) i wróć tutaj."
            : "Wyślij zamówienie ze swojej poczty."}
      </p>
      {orderForm ? (
        <a
          href={orderForm.href}
          download
          className={cn(
            buttonPrimaryClass,
            "inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium sm:w-auto"
          )}
        >
          <IconDownload size={16} aria-hidden />
          {orderForm.kind === "pdf" ? "Pobierz formularz (PDF)" : "Pobierz formularz (Excel)"}
        </a>
      ) : null}
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {mailtoSeed ? (
          <a
            href={mailtoSeed.href}
            className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 sm:w-auto"
          >
            <IconMail size={16} aria-hidden />
            {ZD_ESTIMATE_UI.postCreateMailComposeOpen}
          </a>
        ) : null}
        <Button type="button" variant="secondary" className="min-h-10 w-full sm:w-auto" onClick={() => void copyMailBody()}>
          {mailBodyCopied
            ? ZD_ESTIMATE_UI.postCreateMailBodyCopied
            : location === "POLSKA"
              ? ZD_ESTIMATE_UI.postCreateMailBodyCopyPl
              : ZD_ESTIMATE_UI.postCreateMailBodyCopyEn}
        </Button>
        {gmail?.configured && !gmailEmail && email && !previewOnly ? (
          <a
            href={gmailConnectHref}
            target="_blank"
            rel="noopener"
            className="inline-flex min-h-10 items-center px-2 text-sm font-medium text-indigo-700 underline-offset-2 hover:underline"
          >
            {ZD_ESTIMATE_UI.postCreateGmailConnect}
          </a>
        ) : null}
      </div>
      <SupplierContactActions notes={notes} mails={mails} extraInfo={extraInfo} />
      {!contactUi.contactLink && !contactUi.copyText ? (
        <p className="text-sm text-slate-600">
          {ZD_ESTIMATE_UI.postCreateNoContact}{" "}
          <Link href={cardsHref} className="font-medium text-indigo-700 underline-offset-2 hover:underline">
            {ZD_ESTIMATE_UI.postCreateCardsLink}
          </Link>
        </p>
      ) : null}
    </div>
  );

  return (
    <>
      {/* Region aria-live dla czytników ekranu — komunikaty statusu akcji. */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
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
        size="full"
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
                variant="secondary"
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
              <div ref={setSendActionsSlot} className="contents" />
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
                <p className="text-xs font-semibold text-emerald-800">
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
                {/* Fakty o dokumencie; decyzje (Główne, plan) są w „Co dalej”. */}
                <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs" aria-label="Status dokumentu">
                  {statusItems
                    .filter((item) => item.key === "subiekt" || item.key === "history")
                    .map((item) => (
                      <li
                        key={item.key}
                        className={cn(
                          "inline-flex items-center gap-1.5",
                          item.ok ? "text-emerald-900" : "font-medium text-amber-900"
                        )}
                      >
                        <StatusDot ok={item.ok} unsure={item.unsure} soft={item.soft} className="mt-0" />
                        {item.label}
                      </li>
                    ))}
                </ul>
              </div>
            </div>
            <div
              className="shrink-0 rounded-lg bg-white/80 px-3.5 py-2 ring-1 ring-emerald-200/80 sm:text-right"
              title="Dziś + typowy czas realizacji dostawcy w OnTime (z historii ZD → FZ)"
            >
              <p className="text-xs font-semibold text-emerald-800">Przewidywana dostawa</p>
              <p className="text-lg font-semibold tabular-nums tracking-tight text-slate-900">{etaTile.value}</p>
              <p className="text-xs text-slate-600">{etaTile.sub}</p>
            </div>
            <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto">
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
            Tworzenie ZD zablokowane dla tej listy - odblokuj świadomie, powiąż ZD
            albo przelicz listę.
          </p>
        ) : null}
        {candidatesHint && session.kind !== "timeout_recovery" ? (
          <p className="rounded-md bg-amber-50/90 px-3 py-2 text-sm text-amber-950 ring-1 ring-amber-200/90">
            {candidatesHint}
          </p>
        ) : null}

        {canAct && session.dokId != null ? (
          gmail == null || contactLoading ? (
            <p className="inline-flex items-center gap-2 text-sm text-slate-600" role="status">
              <Spinner className="size-4" /> Przygotowuję wysyłkę…
            </p>
          ) : (
            <ZdSendWorkspace
              key={`${session.dokId}|${gmailEmail ?? "-"}|${email ?? "-"}`}
              dokId={session.dokId}
              supplierId={session.supplierId}
              supplierName={session.supplierName}
              previewOnly={previewOnly}
              // Wysyłka z OnTime tylko z połączonym Gmailem i adresem dostawcy; inaczej tryb ręczny (portal, telefon).
              gmail={canGmailCompose && gmailEmail && email ? { email: gmailEmail, signature: gmail.signature } : null}
              toSeed={email ?? ""}
              subjectSeed={mailtoSeed?.subject ?? `ZD ${session.dokNrPelny ?? ""}`.trim()}
              bodySeed={mailtoSeed?.body ?? ""}
              orderFormKind={orderFormTemplate?.kind ?? null}
              etaDateKey={eta?.supplierId === session.supplierId ? eta.dateKey : null}
              etaSub={etaTile.sub}
              catalogOrderIds={session.markFreeze.pendingGlowneCatalogIds}
              serviceOrderIds={session.markFreeze.pendingGlowneServiceIds}
              glowneDone={session.glowneDone}
              scheduleDone={session.scheduleDone}
              scheduleCanMark={scheduleCanMark}
              scheduleHint={scheduleHint}
              previousSend={previousSend}
              manualContact={manualContact}
              actionsSlot={sendActionsSlot}
              simulation={previewOnly ? sendSimulation : null}
              onSent={() => undefined}
              onGlowneMarked={(r) => onGlowneMarked?.(r)}
              onScheduleMarked={() => {
                onScheduleMarked?.();
                setScheduleCanMark(false);
              }}
              onUndo={(kind, payload, title) => setUndo({ kind, payload, title })}
            />
          )
        ) : null}

        {hasRequestsPreview ? (
          <details className="rounded-[var(--radius-panel)] border border-slate-200 bg-white px-4 py-3">
            <summary className="cursor-pointer text-sm font-medium text-slate-700">
              Prośby i uwagi na tym ZD
            </summary>
            <div className="mt-3 space-y-4">
              {session.composedUwagi ? (
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">{session.composedUwagi}</p>
              ) : null}
              <ZdEstimateCreateRequestsPreview
                catalogRequests={glownePreview.catalogRequests}
                serviceLines={glownePreview.serviceLines}
                glowneCatalogCount={session.markFreeze.pendingGlowneCatalogIds.length}
                glowneServiceCount={session.markFreeze.pendingGlowneServiceIds.length}
              />
            </div>
          </details>
        ) : null}

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
                uwagach - nie wejdą na listę Główne.
              </li>
            ) : null}
            {session.markFreeze.teethServiceCount > 0 ? (
              <li className="text-slate-600">{ZD_ESTIMATE_UI.createTeethNote}</li>
            ) : null}
          </ul>
        ) : null}

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
