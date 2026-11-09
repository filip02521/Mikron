"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { actionSendZdToSupplier, type SendZdToSupplierResult } from "@/app/actions/gmail";
import { actionMarkZdAutoProposalSentManually } from "@/app/actions/zd-estimate";
import { actionSetZdTerminAfterSend, actionZdSendPlan, type ZdSendPlan } from "@/app/actions/zd-send";
import {
  actionMarkZdEstimateIndividualsGlowne,
  actionMarkZdEstimateSupplierOrdered,
} from "@/app/actions/zd-estimate";
import { IconAlertCircle, IconCircleCheck, IconEye, IconMail, IconPaperclip, IconX } from "@/components/icons/StrokeIcons";
import { ModalShell } from "@/components/ui/ModalShell";
import { warsawDateKeyDaysAgo } from "@/lib/time/warsaw";
import { MailPreview, type MailPreviewAttachment } from "@/components/mail/MailPreview";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { zdDefaultOrderKind, zdPlanStepDecision, type ZdOrderKind } from "@/lib/orders/zd-schedule-mark";
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/cn";
import { polishPluralWord } from "@/lib/email/polish-plural";
import { prepareMailAttachment } from "@/lib/client/compress-image";
import {
  EXTRA_ATTACHMENTS_ACCEPT,
  EXTRA_ATTACHMENTS_MAX_FILES,
  PRIMARY_ZD_OVERRIDE_ACCEPT,
  PRIMARY_ZD_OVERRIDE_EXTENSIONS,
  extraAttachmentExtension,
  extraAttachmentsError,
  mailAttachmentsCombinedError,
  primaryZdOverrideError,
} from "@/lib/email/extra-attachments";
import { parseMailRecipients } from "@/lib/email/recipients";
import { zdTerminError } from "@/lib/orders/zd-send-plan";
import type { SupplierOrderEmail } from "@/lib/google/gmail-connections";
import type { DailyPanelUndoPayload } from "@/lib/orders/daily-panel-undo";
import { ZD_ESTIMATE_UI } from "@/lib/orders/zd-estimate-ui-copy";
import { userFacingErrorTextFromMessage } from "@/lib/ui/user-facing-error";
import { controlFocusClass, panelTypography } from "@/lib/ui/ontime-theme";
import { BrandLoader } from "@/components/ui/BrandLoader";
import { BrandStepMark } from "@/components/ui/BrandStepMark";

function canBePrimaryZd(file: File): boolean {
  return (PRIMARY_ZD_OVERRIDE_EXTENSIONS as readonly string[]).includes(
    extraAttachmentExtension(file.name)
  );
}

const fieldClass = cn(controlFocusClass, "mt-1 w-full rounded-md border border-slate-200 bg-card px-3 py-2 text-sm");

type StepKey = "mail" | "termin" | "glowne" | "plan";
type StepState = { status: "idle" | "running" | "ok" | "error" | "skipped"; message?: string };

/** ponytail: proxy przed ontime.mikran.pl ucina żądania ~1 MB; po podniesieniu client_max_body_size — usuń ostrzeżenie. */
const PROXY_BODY_LIMIT_BYTES = 1024 * 1024;

const plDate = (key: string) => key.split("-").reverse().join(".");

/** Laboratorium: przebieg wysyłki bez wysyłania i bez zapisu w Subiekcie. */
export type ZdSendSimulation = "ok" | "termin_error" | "attach_slow" | "attach_error";

/** Zwykły czas przygotowania wydruku ZD w Subiekcie — po nim podpowiadamy plan B (własny PDF). */
const ATTACH_SLOW_AFTER_S = 30;

/** Sekundy od `since`, odświeżane co sekundę tylko wtedy, gdy `active`. */
function useElapsedSeconds(active: boolean, since: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [active, since]);
  return active ? Math.max(0, Math.floor((now - since) / 1000)) : 0;
}
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Wysyłka utworzonego ZD do dostawcy — jedna decyzja zamiast kilku kroków:
 * mail z dokumentem (termin realizacji = dziś) → nasz termin dostawy na ZD → Główne tylko dla próśb
 * z produktem w ZD → plan dostawcy. Każdy krok ma swój status; po błędzie ponawia się tylko ten krok.
 */
export function ZdSendWorkspace({
  dokId,
  supplierId,
  supplierName,
  previewOnly,
  gmail,
  toSeed,
  subjectSeed,
  bodySeed,
  orderFormKind,
  etaDateKey,
  etaSub,
  catalogOrderIds,
  serviceOrderIds,
  glowneDone,
  scheduleDone,
  scheduleCanMark,
  scheduleChecked = true,
  scheduleDue = true,
  scheduleHint,
  previousSend,
  manualContact,
  actionsSlot,
  simulation,
  simulatedDocument = false,
  onGlowneMarked,
  onScheduleMarked,
  onUndo,
}: {
  dokId: number;
  supplierId: string;
  supplierName: string;
  previewOnly: boolean;
  /** Połączony Gmail osoby; null = wysyłka ręczna (program pocztowy, portal). */
  gmail: { email: string; signature: string } | null;
  toSeed: string;
  subjectSeed: string;
  bodySeed: string;
  orderFormKind: "pdf" | "xlsx" | "xlsx-list" | null;
  etaDateKey: string | null;
  etaSub: string;
  catalogOrderIds: string[];
  serviceOrderIds: string[];
  glowneDone: boolean;
  scheduleDone: boolean;
  scheduleCanMark: boolean;
  /** false = odpowiedź o planie jeszcze nie przyszła: wysyłka czeka, żeby domyślne „uzupełniające” nie pominęło planu po cichu. */
  scheduleChecked?: boolean;
  /** Plan wypada dziś albo jest zaległy — domyślnie główne; przyszły termin — domyślnie uzupełniające. */
  scheduleDue?: boolean;
  scheduleHint: string | null;
  previousSend: SupplierOrderEmail | null;
  /** Kontakt i kopiowanie treści, gdy nie ma wysyłki z Gmaila. */
  manualContact: React.ReactNode;
  /** Miejsce w stopce okna na przyciski wysyłki; null = przyciski pod treścią. */
  actionsSlot?: HTMLElement | null;
  /** Tylko laboratorium: kroki udają odpowiedzi serwera (nic nie wychodzi, nic się nie zapisuje). */
  simulation?: ZdSendSimulation | null;
  /** Laboratorium z fikcyjnym ZD: wydruk i pozycje ZD na niby (bez pytania Subiekta). */
  simulatedDocument?: boolean;
  onGlowneMarked: (result: { processedIds: string[]; dropPendingIds: string[] }) => void;
  onScheduleMarked: () => void;
  onUndo: (kind: "glowne" | "schedule", payload: DailyPanelUndoPayload, title: string) => void;
}) {
  const ids = { to: useId(), cc: useId(), subject: useId(), body: useId(), termin: useId() };
  const [to, setTo] = useState(toSeed);
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState(subjectSeed);
  const [body, setBody] = useState(() => {
    const signature = gmail?.signature.trim();
    return signature ? `${bodySeed}\n${signature}` : bodySeed;
  });
  const [termin, setTermin] = useState(etaDateKey ?? "");
  const [terminTouched, setTerminTouched] = useState(false);
  // Przewidywana dostawa liczy się w tle — podstaw ją, dopóki ktoś nie wpisał własnej daty.
  const [seenEta, setSeenEta] = useState(etaDateKey);
  if (seenEta !== etaDateKey) {
    setSeenEta(etaDateKey);
    if (!terminTouched && etaDateKey) setTermin(etaDateKey);
  }

  const [plan, setPlan] = useState<ZdSendPlan | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [attachment, setAttachment] = useState<
    { state: "loading" } | { state: "ready"; file: MailPreviewAttachment } | { state: "error"; message: string }
  >({ state: "loading" });
  const [extras, setExtras] = useState<{ file: File; href: string }[]>([]);
  const [extrasBusy, setExtrasBusy] = useState(false);
  const [extrasError, setExtrasError] = useState<string | null>(null);
  /** Ręczny dokument ZD — gdy Subiekt/Sfera nie odda wydruku. */
  const [manualPrimary, setManualPrimary] = useState<{
    file: File;
    href: string;
  } | null>(null);
  const extrasInputRef = useRef<HTMLInputElement>(null);
  const zdPrimaryInputRef = useRef<HTMLInputElement>(null);
  // Adresy podglądu plików — zwalniane przy usunięciu pliku i przy zamknięciu okna.
  const extraUrlsRef = useRef(new Set<string>());
  useEffect(() => {
    const urls = extraUrlsRef.current;
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, []);
  const extrasBytes = extras.reduce((n, x) => n + x.file.size, 0);
  const outboundAttachmentBytes =
    extrasBytes + (manualPrimary?.file.size ?? 0);

  function setAsManualPrimary(
    file: File,
    href: string,
    extrasForTotal: ReadonlyArray<File> = extras.map((x) => x.file)
  ) {
    const err =
      primaryZdOverrideError(file) ??
      mailAttachmentsCombinedError(file, extrasForTotal);
    if (err) {
      setExtrasError(err);
      return false;
    }
    setExtrasError(null);
    const previous = manualPrimary;
    if (previous && previous.href !== href) {
      URL.revokeObjectURL(previous.href);
      extraUrlsRef.current.delete(previous.href);
    }
    setManualPrimary({ file, href });
    extraUrlsRef.current.add(href);
    setAttachment({
      state: "ready",
      file: {
        name: file.name,
        size: file.size,
        href,
        opensInline: file.type === "application/pdf" || /\.pdf$/i.test(file.name),
        roleLabel: ZD_ESTIMATE_UI.zdSendAttachMarkedBadge,
      },
    });
    return true;
  }

  async function addExtras(list: FileList) {
    setExtrasError(null);
    setExtrasBusy(true);
    try {
      const prepared = await Promise.all(Array.from(list).map(prepareMailAttachment));
      const nextExtras = [...extras.map((x) => x.file), ...prepared];
      const error =
        extraAttachmentsError(nextExtras) ??
        mailAttachmentsCombinedError(manualPrimary?.file ?? null, nextExtras);
      if (error) {
        setExtrasError(error);
        return;
      }
      const added = prepared.map((file) => ({ file, href: URL.createObjectURL(file) }));
      added.forEach((x) => extraUrlsRef.current.add(x.href));
      setExtras((prev) => [...prev, ...added]);
    } finally {
      setExtrasBusy(false);
    }
  }

  async function uploadPrimaryZd(list: FileList) {
    const raw = list[0];
    if (!raw) return;
    setExtrasError(null);
    setExtrasBusy(true);
    try {
      const file = await prepareMailAttachment(raw);
      const href = URL.createObjectURL(file);
      if (!setAsManualPrimary(file, href)) {
        URL.revokeObjectURL(href);
      }
    } finally {
      setExtrasBusy(false);
    }
  }

  function markExtraAsZd(index: number) {
    const item = extras[index];
    if (!item) return;
    const demoted = manualPrimary;
    const remaining = [
      ...extras.filter((_, i) => i !== index).map((x) => x.file),
      ...(demoted ? [demoted.file] : []),
    ];
    // setAsManualPrimary zwalnia URL poprzedniego — przy demote zachowaj href.
    if (demoted) {
      const err =
        primaryZdOverrideError(item.file) ??
        mailAttachmentsCombinedError(item.file, remaining);
      if (err) {
        setExtrasError(err);
        return;
      }
      setExtrasError(null);
      setManualPrimary({ file: item.file, href: item.href });
      setAttachment({
        state: "ready",
        file: {
          name: item.file.name,
          size: item.file.size,
          href: item.href,
          opensInline:
            item.file.type === "application/pdf" || /\.pdf$/i.test(item.file.name),
          roleLabel: ZD_ESTIMATE_UI.zdSendAttachMarkedBadge,
        },
      });
      setExtras((prev) => [...prev.filter((_, i) => i !== index), demoted]);
      return;
    }
    if (!setAsManualPrimary(item.file, item.href, remaining)) return;
    setExtras((prev) => prev.filter((_, i) => i !== index));
  }

  function clearManualPrimary() {
    setExtrasError(null);
    setManualPrimary((prev) => {
      if (prev) {
        URL.revokeObjectURL(prev.href);
        extraUrlsRef.current.delete(prev.href);
      }
      return null;
    });
  }

  function removeExtra(index: number) {
    setExtrasError(null);
    const href = extras[index]?.href;
    if (href) {
      URL.revokeObjectURL(href);
      extraUrlsRef.current.delete(href);
    }
    setExtras((prev) => prev.filter((_, i) => i !== index));
  }

  const [steps, setSteps] = useState<Record<StepKey, StepState>>({
    mail: { status: previousSend ? "ok" : "idle", message: previousSend ? sentLabel(previousSend) : undefined },
    termin: { status: "idle" },
    glowne: { status: glowneDone ? "ok" : "idle" },
    plan: { status: scheduleDone ? "ok" : "idle" },
  });
  const [confirm, setConfirm] = useState<{ resend?: boolean; allowUnknownRecipients?: boolean }>({});
  const [ccOpen, setCcOpen] = useState(false);
  const [bodyOpen, setBodyOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [sendStartedAt, setSendStartedAt] = useState(() => Date.now());
  // Główne zapisuje zamówienie w planie i przelicza kolejny termin od dziś; uzupełniające zostawia plan bez zmian.
  const [orderKindChoice, setOrderKindChoice] = useState<ZdOrderKind | null>(null);
  const orderKind = orderKindChoice ?? zdDefaultOrderKind({ scheduleCanMark, scheduleDue });
  const planHint = scheduleHint?.replace(/\.\s*$/, "") || null;
  const [mailIssue, setMailIssue] = useState<
    | { kind: "unknown"; emails: string[] }
    | { kind: "already"; sent: SupplierOrderEmail }
    /** Połączenie zerwane po wysłaniu treści — ponowna wysyłka dopiero po sprawdzeniu „Wysłanych”. */
    | { kind: "uncertain" }
    | null
  >(null);
  const running = Object.values(steps).some((s) => s.status === "running");
  // Symulacja: drugi zapis terminu się udaje (sprawdza „Ponów ten krok”).
  const [simTerminTries, setSimTerminTries] = useState(0);
  const live = !simulation;
  const progressRef = useRef<HTMLDivElement>(null);
  // Po kliknięciu postęp ma być na oczach — lista kroków jest pod formularzem.
  const showProgress = () => progressRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });

  // Plan wysyłki (termin na ZD, prośby w ZD) i załącznik — przy otwarciu i po „Odśwież dokument z Subiektu”.
  useEffect(() => {
    let alive = true;
    if (simulation && simulatedDocument) {
      const t = window.setTimeout(() => {
        const today = warsawDateKeyDaysAgo(0);
        if (alive) setPlan({ ok: true, dokNr: "ZD 29/M/10/2026", termin: null, today, usesSupplierForm: false, inZd: [], notInZd: [] });
      }, 1200);
      return () => {
        alive = false;
        window.clearTimeout(t);
      };
    }
    actionZdSendPlan({ dokId, supplierId, catalogOrderIds })
      .then((res) => alive && setPlan(res))
      .catch(() => alive && setPlan({ ok: false, message: "Nie udało się wczytać ZD z Subiekta." }));
    return () => {
      alive = false;
    };
    // catalogOrderIds zmienia się tylko z sesją — odświeżenie robi refreshKey.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dokId, supplierId, refreshKey]);

  useEffect(() => {
    if (!gmail) return;
    // Ręczny dokument ZD — nie nadpisuj pobieraniem z Subiekta.
    if (manualPrimary) return;
    let objectUrl: string | null = null;
    if (simulation && simulatedDocument) {
      // Laboratorium: wydruk „przychodzi” po chwili, długo albo wcale — bez pytania Subiekta.
      const ms = simulation === "attach_slow" ? 40_000 : simulation === "attach_error" ? 2500 : 3500;
      const t = window.setTimeout(() => {
        if (simulation === "attach_error") {
          setAttachment({ state: "error", message: "Nie udało się przygotować załącznika: Subiekt nie oddał wydruku (symulacja)." });
          return;
        }
        objectUrl = URL.createObjectURL(new Blob(["%PDF-1.4 symulacja"], { type: "application/pdf" }));
        setAttachment({ state: "ready", file: { name: "ZD_29_M_10_2026.pdf", size: 48_213, href: objectUrl, opensInline: true } });
      }, ms);
      return () => {
        window.clearTimeout(t);
        if (objectUrl) URL.revokeObjectURL(objectUrl);
      };
    }
    const controller = new AbortController();
    const url = `/api/operations/supplier-forms/zd/${dokId}/mail-attachment?supplierId=${encodeURIComponent(supplierId)}${refreshKey ? "&fresh=1" : ""}`;
    fetch(url, { signal: controller.signal })
      .then(async (res) => {
        if (controller.signal.aborted) return;
        if (!res.ok) {
          const json = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(json?.error ?? `HTTP ${res.status}`);
        }
        const blob = await res.blob();
        if (controller.signal.aborted) return;
        const encoded = (res.headers.get("Content-Disposition") ?? "").match(/filename\*=UTF-8''([^;]+)/)?.[1];
        objectUrl = URL.createObjectURL(blob);
        setAttachment({
          state: "ready",
          file: {
            name: encoded ? decodeURIComponent(encoded) : "zamowienie.pdf",
            size: blob.size,
            href: objectUrl,
            opensInline: blob.type === "application/pdf",
          },
        });
      })
      .catch((e: unknown) => {
        if (controller.signal.aborted) return;
        setAttachment({
          state: "error",
          message: `Nie udało się przygotować załącznika: ${e instanceof Error ? e.message : String(e)}.`,
        });
      });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [gmail, dokId, supplierId, refreshKey, manualPrimary, simulation, simulatedDocument]);

  const [attachStartedAt, setAttachStartedAt] = useState(() => Date.now());
  const attachElapsed = useElapsedSeconds(Boolean(gmail) && attachment.state === "loading", attachStartedAt);
  const refreshDocument = () => {
    clearManualPrimary();
    setPlan(null);
    setAttachment({ state: "loading" });
    setAttachStartedAt(Date.now());
    setRefreshKey((k) => k + 1);
  };

  const planOk = plan?.ok ? plan : null;
  const inZdIds = planOk ? planOk.inZd.map((r) => r.orderId) : [];
  const glowneTargetIds = [...new Set([...inZdIds, ...serviceOrderIds])];
  // Te same reguły co na serwerze — błędny termin nie może zablokować samej wysyłki dopiero po kliknięciu.
  const terminInvalid = planOk ? zdTerminError(termin, planOk.today) != null : !/^\d{4}-\d{2}-\d{2}$/.test(termin);
  const recipients = parseMailRecipients(to, cc);
  const mailDone = steps.mail.status === "ok";
  const allDone = (["mail", "termin", "glowne", "plan"] as const).every((k) => ["ok", "skipped"].includes(steps[k].status));
  // Przy ręcznym ZD serwer nie zmienia terminu pod wydruk — nie strasz użytkownika.
  const willResetTermin = Boolean(
    planOk &&
      !planOk.usesSupplierForm &&
      planOk.termin !== planOk.today &&
      !manualPrimary
  );

  const setStep = (key: StepKey, state: StepState) => setSteps((prev) => ({ ...prev, [key]: state }));

  async function runTermin(): Promise<boolean> {
    setStep("termin", { status: "running", message: "Zapisuję termin w Subiekcie…" });
    let res: Awaited<ReturnType<typeof actionSetZdTerminAfterSend>> | null;
    if (live) {
      res = await actionSetZdTerminAfterSend({ dokId, supplierId, date: termin }).catch(() => null);
    } else {
      await wait(900);
      setSimTerminTries((n) => n + 1);
      res =
        simulation === "termin_error" && simTerminTries === 0
          ? { ok: false, message: "Subiekt nie odpowiedział w czasie (symulacja)." }
          : { ok: true, termin };
    }
    if (!res?.ok) {
      setStep("termin", { status: "error", message: res?.message ?? "Brak połączenia z serwerem." });
      return false;
    }
    setStep("termin", { status: "ok", message: `Termin realizacji: ${plDate(res.termin)}` });
    return true;
  }

  async function runGlowne(): Promise<void> {
    if (glowneDone || !glowneTargetIds.length) {
      setStep("glowne", { status: "skipped", message: glowneDone ? "Już oznaczone" : "Brak próśb w tym ZD" });
      return;
    }
    setStep("glowne", { status: "running", message: "Oznaczam prośby jako zamówione…" });
    if (!live) {
      await wait(700);
      setStep("glowne", { status: "ok", message: `Odznaczono ${glowneTargetIds.length} jako Główne (symulacja).` });
      return;
    }
    const res = await actionMarkZdEstimateIndividualsGlowne({ supplierId, orderIds: glowneTargetIds }).catch(() => null);
    if (!res || !res.ok) {
      setStep("glowne", {
        status: "error",
        message: userFacingErrorTextFromMessage(res?.message ?? null, "Nie udało się oznaczyć próśb jako Główne."),
      });
      return;
    }
    onGlowneMarked({ processedIds: res.processedIds, dropPendingIds: [...new Set([...res.processedIds, ...res.skippedIds])] });
    if (res.undo) onUndo("glowne", res.undo, res.message);
    setStep("glowne", { status: "ok", message: res.message });
  }

  async function runPlan(): Promise<void> {
    const decision = zdPlanStepDecision({ orderKind, scheduleDone, scheduleCanMark });
    if (decision === "side_keeps_plan") {
      setStep("plan", { status: "skipped", message: "Zamówienie uzupełniające - plan dostawcy bez zmian." });
      return;
    }
    if (decision === "already_done" || (decision === "cannot_mark" && live)) {
      setStep("plan", { status: "skipped", message: scheduleDone ? "Już zapisany" : (scheduleHint ?? "Bez planu do zapisania") });
      return;
    }
    setStep("plan", { status: "running", message: "Zapisuję zamówienie w planie dostawcy…" });
    if (!live) {
      await wait(700);
      setStep("plan", { status: "ok", message: "Zamówienie zapisane w planie, kolejny termin przeliczony (symulacja)." });
      return;
    }
    const res = await actionMarkZdEstimateSupplierOrdered({ supplierId }).catch(() => null);
    if (!res || !res.ok) {
      setStep("plan", {
        status: "error",
        message: userFacingErrorTextFromMessage(res?.message ?? null, "Nie udało się zapisać planu."),
      });
      return;
    }
    onScheduleMarked();
    if (res.undo) onUndo("schedule", res.undo, res.message);
    setStep("plan", { status: "ok", message: res.message });
  }

  /** Kroki po mailu — w tej kolejności; termin przed Główne, żeby handlowcy od razu widzieli datę. */
  async function finishAfterMail(opts: { terminHandled?: boolean } = {}) {
    if (!opts.terminHandled && steps.termin.status !== "ok") await runTermin();
    if (steps.glowne.status !== "ok") await runGlowne();
    if (steps.plan.status !== "ok") await runPlan();
  }

  async function send(flags: { resend?: boolean; allowUnknownRecipients?: boolean } = {}) {
    if (!gmail || (previewOnly && live) || running) return;
    const merged = { ...confirm, ...flags };
    setConfirm(merged);
    setMailIssue(null);
    setSendStartedAt(Date.now());
    setStep("mail", { status: "running", message: gmail ? `Wysyłam z ${gmail.email}…` : "Wysyłam…" });
    showProgress();
    const res: SendZdToSupplierResult = live
      ? await actionSendZdToSupplier({
          dokId,
          supplierId,
          to,
          cc,
          subject,
          body,
          terminAfterSend: termin,
          extraFiles: extras.map((x) => x.file),
          primaryOverride: manualPrimary?.file,
          ...merged,
        }).catch((e: unknown) => ({
          ok: false as const,
          message: userFacingErrorTextFromMessage(e instanceof Error ? e.message : String(e), "Nie udało się wysłać zamówienia."),
        }))
      : await wait(1600).then(() => ({
          ok: true as const,
          from: gmail.email,
          to: recipients.ok ? recipients.to : [to],
          cc: recipients.ok ? recipients.cc : [],
          attachmentName: [attachment.state === "ready" ? attachment.file.name : "zamowienie.pdf", ...extras.map((x) => x.file.name)].join(", "),
          sentAt: new Date().toISOString(),
        }));
    if (!res.ok) {
      if ("unknownRecipients" in res && res.unknownRecipients?.length) setMailIssue({ kind: "unknown", emails: res.unknownRecipients });
      else if ("alreadySent" in res && res.alreadySent) setMailIssue({ kind: "already", sent: res.alreadySent });
      else if ("uncertain" in res && res.uncertain) setMailIssue({ kind: "uncertain" });
      setStep("mail", { status: "error", message: res.message });
      return;
    }
    setStep("mail", {
      status: "ok",
      message: `Wysłano do ${[...res.to, ...res.cc].join(", ")} · ${res.attachmentName}`,
    });
    // Termin ustawił już serwer razem z wysyłką; błąd zostaje z przyciskiem „Ponów”.
    const serverTermin = "termin" in res ? res.termin : undefined;
    if (serverTermin) {
      setStep(
        "termin",
        serverTermin.ok
          ? { status: "ok", message: `Termin realizacji: ${plDate(serverTermin.termin)}` }
          : { status: "error", message: serverTermin.message }
      );
    }
    await finishAfterMail({ terminHandled: Boolean(serverTermin) });
  }

  async function markSentManually() {
    if ((previewOnly && live) || running || !scheduleChecked) return;
    const confirmedInGmail = mailIssue?.kind === "uncertain";
    setMailIssue(null);
    setStep("mail", { status: "ok", message: confirmedInGmail ? "Jest w Wysłanych w Gmailu" : "Wysłane poza OnTime" });
    // Zamówienie automatu z tym ZD: etap „wysłane” w panelu dziennym (bez śladu w Gmailu OnTime nic by go nie domknęło).
    if (live) void actionMarkZdAutoProposalSentManually({ dokId, supplierId }).catch(() => undefined);
    showProgress();
    await finishAfterMail();
  }

  const combinedSizeError = mailAttachmentsCombinedError(
    manualPrimary?.file ?? null,
    extras.map((x) => x.file)
  );

  const canSend =
    Boolean(gmail) &&
    (!previewOnly || !live) &&
    !running &&
    !mailDone &&
    recipients.ok &&
    subject.trim() !== "" &&
    body.trim() !== "" &&
    attachment.state === "ready" &&
    !extrasBusy &&
    Boolean(planOk) &&
    !terminInvalid &&
    scheduleChecked &&
    mailIssue?.kind !== "uncertain" &&
    !combinedSizeError;

  const sendElapsed = useElapsedSeconds(steps.mail.status === "running", sendStartedAt);
  const bodyMissing = body.trim() === "";
  const showBodyEditor = bodyOpen || bodyMissing;
  const attachSlow = attachment.state === "loading" && attachElapsed >= ATTACH_SLOW_AFTER_S;
  const locked = mailDone || running;
  const previewAttachments: MailPreviewAttachment[] = [
    ...(attachment.state === "ready" ? [attachment.file] : []),
    ...extras.map((x) => ({
      name: x.file.name,
      size: x.file.size,
      href: x.href,
      opensInline: x.file.type === "application/pdf" || x.file.type.startsWith("image/"),
    })),
  ];
  const headline = mailDone
    ? running
      ? "Mail wysłany - domykam termin, prośby i plan…"
      : allDone
        ? null
        : "Mail wysłany. Krok oznaczony na czerwono wymaga ponowienia - mail nie pójdzie drugi raz."
    : steps.mail.status === "running"
      ? `Wysyłam zamówienie… ${sendElapsed} s`
      : gmail
        ? attachment.state === "loading"
          ? "Przygotowuję dokument ZD - w tym czasie sprawdź adres i temat."
          : "Sprawdź adres i temat, potem „Wyślij i ustaw termin” - resztę OnTime zrobi samo."
        : "Zamów jak zwykle, potem kliknij „Wysłałem ręcznie” - OnTime domknie resztę.";

  return (
    <>
    <section aria-labelledby="zd-send-title" className="space-y-4">
      <div>
        <h3 id="zd-send-title" className={panelTypography.sectionTitle}>
          {mailDone ? "Zamówienie wysłane" : gmail ? `Wyślij zamówienie do ${supplierName}` : `Zamów u ${supplierName}`}
        </h3>
        {headline ? (
          <p className="mt-0.5 text-sm tabular-nums text-slate-600" role="status" aria-live="polite">
            {headline}
          </p>
        ) : null}
      </div>

      {allDone && mailDone ? (
        <div className="flex items-start gap-3 rounded-lg bg-emerald-50 px-4 py-3" role="status">
          <IconCircleCheck size={22} className="mt-0.5 shrink-0 text-emerald-700" aria-hidden />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-emerald-900">Termin, prośby i plan dostawcy są zapisane</p>
            <p className="mt-0.5 text-sm text-emerald-800">Nic więcej nie trzeba robić - możesz zamknąć okno.</p>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-start">
        <div className="min-w-0 space-y-4">
          {gmail ? (
            <div className="rounded-lg border border-slate-200 bg-card p-4">
              <div className="flex items-center justify-between gap-2">
                <p className={panelTypography.sectionTitle}>Wiadomość</p>
                <button
                  type="button"
                  onClick={() => setPreviewOpen(true)}
                  className="inline-flex min-h-8 items-center gap-1 rounded-md px-2 text-xs font-medium text-indigo-700 transition-colors duration-150 hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus max-sm:min-h-10"
                >
                  <IconEye size={14} aria-hidden /> Podgląd maila
                </button>
              </div>
              <p className="mt-0.5 text-xs text-slate-500">Od: {gmail.email}</p>
              <div className="mt-3 space-y-3">
                <div>
                  <div className="flex items-baseline justify-between gap-2">
                    <label htmlFor={ids.to} className="text-xs font-semibold text-slate-600">
                      Do
                    </label>
                    {!ccOpen && !cc && !locked ? (
                      <button
                        type="button"
                        onClick={() => setCcOpen(true)}
                        disabled={locked}
                        className="rounded-sm text-xs font-medium text-indigo-700 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-50"
                      >
                        + DW (kopia)
                      </button>
                    ) : null}
                  </div>
                  <input
                    id={ids.to}
                    value={to}
                    onChange={(e) => {
                      setTo(e.target.value);
                      setConfirm((c) => ({ ...c, allowUnknownRecipients: false }));
                    }}
                    disabled={locked}
                    className={fieldClass}
                  />
                  {!recipients.ok && to.trim() ? <p className="mt-1 text-xs text-red-700">Sprawdź adresy - jeden z nich jest niepoprawny.</p> : null}
                </div>
                {ccOpen || cc ? (
                  <div>
                    <label htmlFor={ids.cc} className="text-xs font-semibold text-slate-600">
                      DW (kopia) <span className="font-normal text-slate-500">- opcjonalnie</span>
                    </label>
                    <input
                      id={ids.cc}
                      value={cc}
                      onChange={(e) => {
                        setCc(e.target.value);
                        setConfirm((c) => ({ ...c, allowUnknownRecipients: false }));
                      }}
                      disabled={locked}
                      inputMode="email"
                      autoComplete="off"
                      placeholder="np. kierownik@mikran.com"
                      className={fieldClass}
                      autoFocus={ccOpen && !cc}
                    />
                  </div>
                ) : null}
                <div>
                  <label htmlFor={ids.subject} className="text-xs font-semibold text-slate-600">
                    Temat
                  </label>
                  <input id={ids.subject} value={subject} onChange={(e) => setSubject(e.target.value)} disabled={locked} className={fieldClass} />
                </div>
                <div>
                  <div className="flex items-baseline justify-between gap-2">
                    {showBodyEditor ? (
                      <label htmlFor={ids.body} className="text-xs font-semibold text-slate-600">
                        Treść
                      </label>
                    ) : (
                      <p className="text-xs font-semibold text-slate-600">Treść</p>
                    )}
                    {!locked && !bodyMissing ? (
                      <button
                        type="button"
                        onClick={() => setBodyOpen((v) => !v)}
                        aria-expanded={showBodyEditor}
                        className="rounded-sm text-xs font-medium text-indigo-700 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                      >
                        {showBodyEditor ? "Zwiń" : "Edytuj treść"}
                      </button>
                    ) : null}
                  </div>
                  {showBodyEditor ? (
                    <textarea
                      id={ids.body}
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      disabled={locked}
                      rows={8}
                      className={cn(fieldClass, "leading-relaxed")}
                    />
                  ) : (
                    <div className="mt-1 rounded-md bg-slate-50 px-3 py-2">
                      {/* Przycięcie bez paddingu, żeby piąta linia nie wystawała spod krawędzi. */}
                      <p className="line-clamp-4 whitespace-pre-line text-sm leading-relaxed text-slate-700">{body}</p>
                    </div>
                  )}
                  {bodyMissing ? <p className="mt-1 text-xs text-red-700">Treść jest pusta - wpisz kilka słów do dostawcy.</p> : null}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2">{manualContact}</div>
          )}

          {mailIssue?.kind === "unknown" ? (
            <div className="space-y-2 rounded-md bg-amber-50 px-3 py-2.5 text-sm text-amber-950 ring-1 ring-amber-200" role="alert">
              <p>
                {mailIssue.emails.join(", ")} nie ma na karcie {supplierName}. Sprawdź adres - zamówienie wyjdzie z Twojej skrzynki.
              </p>
              <Button type="button" variant="secondary" className="min-h-10" disabled={running} onClick={() => void send({ allowUnknownRecipients: true })}>
                Wyślij mimo to
              </Button>
            </div>
          ) : mailIssue?.kind === "already" ? (
            <div className="space-y-2 rounded-md bg-amber-50 px-3 py-2.5 text-sm text-amber-950 ring-1 ring-amber-200" role="alert">
              <p>To ZD wysłano już {sentLabel(mailIssue.sent)}. Wysłać jeszcze raz?</p>
              <Button type="button" variant="secondary" className="min-h-10" disabled={running} onClick={() => void send({ resend: true })}>
                Wyślij ponownie
              </Button>
            </div>
          ) : mailIssue?.kind === "uncertain" ? (
            <div className="space-y-2 rounded-md bg-amber-50 px-3 py-2.5 text-sm text-amber-950 ring-1 ring-amber-200" role="alert">
              <p>Nie wiadomo, czy mail wyszedł. Sprawdź „Wysłane” w Gmailu.</p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" className="min-h-10" disabled={running} onClick={() => void markSentManually()}>
                  Jest w Wysłanych
                </Button>
                <Button type="button" variant="ghost" className="min-h-10" disabled={running} onClick={() => void send()}>
                  Nie ma - wyślij jeszcze raz
                </Button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="min-w-0 space-y-4">
          {gmail ? (
            <div
              className={cn(
                "rounded-lg border bg-card p-4 transition-colors duration-150",
                dragOver ? "border-indigo-400 bg-indigo-50" : "border-slate-200"
              )}
              aria-labelledby="zd-send-attach-title"
              // Pliki można upuścić na kartę — trafiają do dodatkowych załączników maila.
              onDragOver={(e) => {
                if (locked || !Array.from(e.dataTransfer.types).includes("Files")) return;
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragOver(false);
              }}
              onDrop={(e) => {
                if (locked || !e.dataTransfer.files.length) return;
                e.preventDefault();
                setDragOver(false);
                void addExtras(e.dataTransfer.files);
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <p id="zd-send-attach-title" className={panelTypography.sectionTitle}>
                  Załącznik
                </p>
                {attachment.state === "ready" ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-800">
                    <IconCircleCheck size={14} className="text-emerald-700" aria-hidden /> gotowy do wysłania
                  </span>
                ) : null}
              </div>
              <input
                ref={zdPrimaryInputRef}
                type="file"
                accept={PRIMARY_ZD_OVERRIDE_ACCEPT}
                className="sr-only"
                tabIndex={-1}
                onChange={(e) => {
                  if (e.target.files?.length) void uploadPrimaryZd(e.target.files);
                  e.target.value = "";
                }}
              />
              <input
                ref={extrasInputRef}
                type="file"
                multiple
                accept={EXTRA_ATTACHMENTS_ACCEPT}
                className="sr-only"
                tabIndex={-1}
                onChange={(e) => {
                  if (e.target.files?.length) void addExtras(e.target.files);
                  e.target.value = "";
                }}
              />

              {attachment.state === "loading" ? (
                <div className="mt-3 rounded-md bg-slate-50 px-3 py-3" role="status" aria-live="polite">
                  <div className="flex items-center gap-3">
                    <BrandLoader size="md" tile={false} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900">
                        {orderFormKind ? `Wypełniam formularz ${supplierName}` : "Przygotowuję dokument ZD w Subiekcie"}
                      </p>
                      <p className="text-xs tabular-nums text-slate-500">
                        {orderFormKind
                          ? "Wpisuję pozycje tego ZD do formularza dostawcy"
                          : willResetTermin
                            ? "Ustawiam termin na dziś i drukuję PDF"
                            : "Drukuję PDF z terminem na dziś"}{" "}
                        · {attachElapsed} s, zwykle do {ATTACH_SLOW_AFTER_S} s
                      </p>
                    </div>
                  </div>
                  {attachSlow ? (
                    <div className="mt-3 rounded-md bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
                      <p className="font-medium">Trwa dłużej niż zwykle.</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-amber-800">
                        Subiekt bywa wolny przy wydrukach. Możesz dalej czekać albo wgrać PDF ZD zapisany z Subiekta.
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Button type="button" size="sm" variant="secondary" className="max-sm:min-h-10" disabled={extrasBusy || running} onClick={() => zdPrimaryInputRef.current?.click()}>
                          {ZD_ESTIMATE_UI.zdSendAttachUploadZdCta}
                        </Button>
                        <Button type="button" size="sm" variant="ghost" className="max-sm:min-h-10" disabled={running} onClick={refreshDocument}>
                          Spróbuj ponownie
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : attachment.state === "error" && !manualPrimary ? (
                <div className="mt-3 rounded-md bg-amber-50 px-3 py-3" role="group" aria-label={ZD_ESTIMATE_UI.zdSendAttachFailedTitle}>
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-amber-950">
                    <IconAlertCircle size={16} className="shrink-0 text-amber-500" aria-hidden />
                    {ZD_ESTIMATE_UI.zdSendAttachFailedTitle}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-amber-900">{ZD_ESTIMATE_UI.zdSendAttachFailedLead}</p>
                  <p className="mt-1.5 text-[0.6875rem] leading-snug text-amber-800">{attachment.message}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button type="button" className="min-h-10" disabled={extrasBusy || running} onClick={() => zdPrimaryInputRef.current?.click()}>
                      {extrasBusy ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Spinner size="sm" /> Przygotowuję…
                        </span>
                      ) : (
                        ZD_ESTIMATE_UI.zdSendAttachUploadZdCta
                      )}
                    </Button>
                    <Button type="button" variant="secondary" className="min-h-10" disabled={running} onClick={refreshDocument}>
                      Odśwież z Subiekta
                    </Button>
                  </div>
                </div>
              ) : null}

              {previewAttachments.length ? (
                <ul className="mt-3 space-y-1.5">
                  {attachment.state === "ready" ? (
                    <li className="flex min-w-0 items-center gap-3 rounded-md bg-slate-50 px-3 py-2">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-card text-slate-600 ring-1 ring-slate-200" aria-hidden>
                        <IconPaperclip size={15} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block break-all text-sm font-medium text-slate-900">{attachment.file.name}</span>
                        <span className="block text-xs text-slate-500">
                          {manualPrimary ? "Dokument ZD wgrany ręcznie" : orderFormKind ? `Formularz ${supplierName}` : "Wydruk ZD z Subiekta"}
                          {attachment.file.size != null ? ` · ${formatBytes(attachment.file.size)}` : ""}
                        </span>
                      </span>
                      {attachment.file.href ? (
                        <a
                          href={attachment.file.href}
                          target="_blank"
                          rel="noopener"
                          className="inline-flex min-h-8 shrink-0 items-center gap-1 rounded-md px-2 text-xs font-medium text-indigo-700 hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus max-sm:min-h-10"
                        >
                          <IconEye size={14} aria-hidden /> Otwórz
                        </a>
                      ) : null}
                    </li>
                  ) : null}
                  {extras.map((x, i) => (
                    <li key={x.href} className="flex min-w-0 items-center gap-3 rounded-md px-3 py-1.5 ring-1 ring-slate-200">
                      <span className="min-w-0 flex-1">
                        <span className="block break-all text-sm text-slate-900">{x.file.name}</span>
                        <span className="block text-xs text-slate-500">Dodatkowy plik · {formatBytes(x.file.size)}</span>
                      </span>
                      {!mailDone && !running && (attachment.state === "error" || Boolean(manualPrimary)) && canBePrimaryZd(x.file) ? (
                        <button
                          type="button"
                          onClick={() => markExtraAsZd(i)}
                          className="inline-flex min-h-8 shrink-0 items-center rounded-md px-2 text-xs font-medium text-indigo-700 hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                        >
                          {ZD_ESTIMATE_UI.zdSendAttachMarkAsZdCta}
                        </button>
                      ) : null}
                      {!locked ? (
                        <button
                          type="button"
                          onClick={() => removeExtra(i)}
                          aria-label={`Usuń ${x.file.name}`}
                          className="inline-flex min-h-8 min-w-8 shrink-0 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                        >
                          <IconX size={14} aria-hidden />
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : null}

              {manualPrimary ? (
                <p className="mt-2 rounded-md bg-emerald-50 px-2.5 py-2 text-xs leading-relaxed text-emerald-900" role="status">
                  {ZD_ESTIMATE_UI.zdSendAttachMarkedHint}
                </p>
              ) : null}
              {willResetTermin && !mailDone && attachment.state === "ready" ? (
                <p className="mt-2 text-xs leading-relaxed text-slate-500">
                  {planOk!.termin
                    ? `W Subiekcie ZD ma termin ${plDate(planOk!.termin)} - dostawca zobaczy dzisiejszy, nasz wróci po wysyłce.`
                    : "Na wydruku dla dostawcy będzie dzisiejszy termin."}
                </p>
              ) : null}

              {!mailDone ? (
                <div className="mt-2 flex flex-wrap items-center gap-x-1 gap-y-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="max-sm:min-h-10"
                    onClick={() => extrasInputRef.current?.click()}
                    disabled={extrasBusy || running}
                  >
                    {extrasBusy ? <Spinner size="sm" /> : <IconPaperclip size={14} aria-hidden />}
                    {extrasBusy ? "Przygotowuję pliki…" : extras.length ? "Dodaj kolejne pliki" : "Dodaj pliki do maila"}
                  </Button>
                  {attachment.state === "ready" || manualPrimary ? (
                    <button
                      type="button"
                      onClick={refreshDocument}
                      disabled={running}
                      title="Gdy dopisałeś coś do ZD w Subiekcie - pozycje i wydruk wczytają się od nowa"
                      className="inline-flex min-h-9 items-center rounded-md px-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-50"
                    >
                      {manualPrimary ? ZD_ESTIMATE_UI.zdSendAttachClearManualCta : "Odśwież z Subiekta"}
                    </button>
                  ) : null}
                </div>
              ) : null}
              {!mailDone ? (
                <p className="mt-1 text-xs text-slate-500">
                  {dragOver ? "Upuść, aby dołączyć do maila." : `PDF, Excel, Word, CSV albo zdjęcia - do ${EXTRA_ATTACHMENTS_MAX_FILES} plików, razem 15 MB. Możesz też przeciągnąć je tutaj.`}
                </p>
              ) : null}
              {extrasError || combinedSizeError ? (
                <p className="mt-1 text-sm text-red-700" role="alert">
                  {extrasError ?? combinedSizeError}
                </p>
              ) : live && outboundAttachmentBytes > PROXY_BODY_LIMIT_BYTES ? (
                <p className="mt-1 text-xs text-amber-800">
                  {manualPrimary
                    ? "Dokument ZD i dodatkowe pliki mają razem ponad 1 MB — serwer OnTime może odrzucić wysyłkę. Zmniejsz PDF albo wyślij załączniki osobno."
                    : "Dodatkowe pliki mają razem ponad 1 MB — serwer OnTime może odrzucić wysyłkę. Zmniejsz PDF albo wyślij go osobno."}
                </p>
              ) : null}
            </div>
          ) : null}

          <div ref={progressRef} className="scroll-mb-4 rounded-lg border border-slate-200 bg-card p-4">
            <p className={panelTypography.sectionTitle}>{mailDone ? "Postęp" : "Po wysłaniu OnTime zrobi"}</p>
            <ol className="mt-3 space-y-3.5">
              <StepRow
                n={1}
                state={steps.mail}
                title={gmail ? "Mail z dokumentem do dostawcy" : "Zamówienie wysłane poza OnTime"}
                detail={
                  gmail
                    ? manualPrimary
                      ? ZD_ESTIMATE_UI.zdSendAttachStepDetailManual
                      : orderFormKind
                        ? `Załącznik: formularz ${supplierName} wypełniony tym ZD.`
                        : "Załącznik: wydruk ZD z Subiekta z terminem realizacji na dziś."
                    : "Potwierdzasz przyciskiem „Wysłałem ręcznie”."
                }
              />
              <StepRow
                n={2}
                state={steps.termin}
                title="Termin realizacji na ZD w Subiekcie"
                detail={
                  <span className="flex flex-wrap items-center gap-2">
                    <input
                      id={ids.termin}
                      type="date"
                      aria-label="Termin realizacji po wysyłce"
                      value={termin}
                      min={planOk?.today}
                      onChange={(e) => {
                        setTermin(e.target.value);
                        setTerminTouched(true);
                      }}
                      disabled={steps.termin.status === "ok" || steps.termin.status === "running"}
                      className={cn(controlFocusClass, "min-h-9 rounded-md border border-slate-200 bg-card px-2 text-sm tabular-nums")}
                    />
                    <span className="text-xs text-slate-500">
                      {etaDateKey ? `przewidywana dostawa · ${etaSub}` : "brak historii dostaw - wpisz datę"}
                    </span>
                  </span>
                }
                hint="Ustawiany dopiero po wysyłce - dostawca dostaje dokument z dzisiejszą datą."
                onRetry={mailDone && steps.termin.status === "error" ? () => void runTermin() : undefined}
              />
              <StepRow
                n={3}
                state={steps.glowne}
                title="Prośby z tego ZD jako Główne"
                detail={
                  !planOk ? (
                    plan && !plan.ok ? (
                      <span className="text-red-700">{plan.message}</span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-slate-500">
                        <BrandLoader size="sm" tile={false} /> Sprawdzam pozycje ZD w Subiekcie…
                      </span>
                    )
                  ) : (
                    <GlowneSummary plan={planOk} services={serviceOrderIds.length} />
                  )
                }
                onRetry={mailDone && steps.glowne.status === "error" ? () => void runGlowne() : undefined}
              />
              <StepRow
                n={4}
                state={steps.plan}
                title="Plan dostawcy: rodzaj zamówienia"
                detail={
                  scheduleDone ? (
                    "Już zapisany."
                  ) : !scheduleChecked ? (
                    <span className="inline-flex items-center gap-1.5 text-slate-500">
                      <BrandLoader size="sm" tile={false} /> Sprawdzam plan dostawcy…
                    </span>
                  ) : (
                    <span className="mt-1 flex flex-col gap-1.5">
                      <SegmentedControl
                        density="compact"
                        ariaLabel="Rodzaj zamówienia"
                        value={orderKind}
                        onChange={setOrderKindChoice}
                        disabled={steps.plan.status === "running" || steps.plan.status === "ok" || steps.plan.status === "skipped"}
                        options={[
                          { value: "main", label: "Główne" },
                          { value: "side", label: "Uzupełniające" },
                        ]}
                      />
                      <span className="text-xs text-slate-600">
                        {orderKind === "side"
                          ? `Plan dostawcy zostaje bez zmian.${planHint && !scheduleDue ? ` ${planHint}.` : ""}`
                          : !scheduleCanMark
                            ? `${planHint ?? "Ten dostawca nie ma planu do zapisania"}.`
                            : scheduleDue
                              ? "Zapisze zamówienie w planie dostawcy i przeliczy kolejny termin z interwału."
                              : `${planHint ?? "Kolejne zamówienie jest dopiero zaplanowane"} - główne przesunie je i przeliczy kolejny termin od dziś.`}
                      </span>
                    </span>
                  )
                }
                onRetry={mailDone && steps.plan.status === "error" ? () => void runPlan() : undefined}
              />
            </ol>
          </div>
        </div>
      </div>
    </section>
    {previewOnly ? (
      <p className="text-xs text-slate-500">
        {live
          ? "Podgląd - w tym oknie nic nie zostanie wysłane ani zapisane."
          : "Symulacja - przyciski działają, ale nic nie zostanie wysłane ani zapisane w Subiekcie."}
      </p>
    ) : null}
    {gmail ? (
      <ModalShell
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title="Tak zobaczy to dostawca"
        size="lg"
        tier="stack"
        bodyClassName="px-5 py-4 sm:px-6"
      >
        <MailPreview
          from={gmail.email}
          to={to}
          cc={cc}
          subject={subject}
          text={body}
          attachments={previewAttachments}
          attachmentsLoading={
            attachment.state === "loading" ? (orderFormKind ? `Wypełniam formularz ${supplierName}…` : "Przygotowuję wydruk ZD z Subiekta…") : null
          }
          attachmentsError={attachment.state === "error" && !manualPrimary ? attachment.message : null}
        />
      </ModalShell>
    ) : null}
    {/* Główna akcja w stopce okna (portal) — zawsze widoczna, niczego nie przykrywa. Bez stopki: w treści. */}
    {(() => {
      const actions = (
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
        {!mailDone ? (
          <Button
            type="button"
            variant={gmail ? "ghost" : "primary"}
            className="min-h-11 w-full sm:w-auto"
            disabled={(previewOnly && live) || running || !planOk || terminInvalid || !scheduleChecked}
            onClick={() => void markSentManually()}
            title="Wysłałeś zamówienie inną drogą - OnTime ustawi termin, Główne i plan wg rodzaju zamówienia"
          >
            Wysłałem ręcznie
          </Button>
        ) : null}
        {gmail && !mailDone ? (
          <Button
            type="button"
            className="min-h-11 w-full sm:w-auto"
            disabled={!canSend}
            aria-busy={steps.mail.status === "running" || attachment.state === "loading"}
            title={
              attachment.state === "error" && !manualPrimary
                ? "Wgraj dokument ZD albo odśwież z Subiekta — wtedy odblokuje się wysyłka"
                : undefined
            }
            onClick={() => void send()}
          >
            {steps.mail.status === "running" ? (
              <span className="inline-flex items-center gap-2">
                <Spinner className="size-4" /> Wysyłam…
              </span>
            ) : attachment.state === "loading" ? (
              <span className="inline-flex items-center gap-2">
                <Spinner className="size-4" /> Czekam na dokument…
              </span>
            ) : (
              <span className="inline-flex items-center gap-2">
                <IconMail size={16} aria-hidden /> Wyślij i ustaw termin
              </span>
            )}
          </Button>
        ) : null}
        {mailDone && !allDone && !running ? (
          <Button type="button" variant="secondary" className="min-h-11 w-full sm:w-auto" onClick={() => void finishAfterMail()}>
            Dokończ pozostałe kroki
          </Button>
        ) : null}
      </div>
      );
      return actionsSlot ? createPortal(actions, actionsSlot) : actions;
    })()}
    </>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toLocaleString("pl-PL", { maximumFractionDigits: 1 })} MB`;
}

function sentLabel(s: SupplierOrderEmail): string {
  const at = new Date(s.sentAt).toLocaleString("pl-PL", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Warsaw" });
  return `${at} z ${s.from} do ${s.to.join(", ")}`;
}

function GlowneSummary({ plan, services }: { plan: Extract<ZdSendPlan, { ok: true }>; services: number }) {
  const total = plan.inZd.length + services;
  return (
    <span className="block space-y-1">
      <span className="block">
        {total
          ? `${total} ${polishPluralWord(total, "prośba zostanie oznaczona", "prośby zostaną oznaczone", "próśb zostanie oznaczonych")} jako zamówione.`
          : "Żadna prośba nie jest w tym ZD."}
      </span>
      {plan.notInZd.length ? (
        <details className="text-xs text-amber-900">
          <summary className="cursor-pointer font-medium">
            {plan.notInZd.length}{" "}
            {polishPluralWord(
              plan.notInZd.length,
              "prośba nie jest w ZD - zostanie bez zmian",
              "prośby nie są w ZD - zostaną bez zmian",
              "próśb nie jest w ZD - zostanie bez zmian"
            )}
          </summary>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            {plan.notInZd.map((r) => (
              <li key={r.orderId}>{r.label}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </span>
  );
}

function StepRow({
  n,
  state,
  title,
  detail,
  hint,
  onRetry,
}: {
  n: number;
  state: StepState;
  title: string;
  detail: React.ReactNode;
  hint?: string;
  onRetry?: () => void;
}) {
  return (
    <li className="flex gap-3">
      {state.status === "running" || state.status === "ok" ? (
        <BrandStepMark state={state.status === "ok" ? "done" : "running"} size={24} className="mt-0.5" />
      ) : (
        <span
          aria-hidden
          className={cn(
            "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums",
            state.status === "error" ? "bg-red-100 text-red-800" : "bg-card text-slate-600 ring-1 ring-slate-300"
          )}
        >
          {state.status === "error" ? <IconAlertCircle size={14} /> : n}
        </span>
      )}
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-medium text-slate-900">{title}</p>
        <div className="mt-0.5 text-slate-700">{detail}</div>
        {state.message && state.status !== "idle" ? (
          <p className={cn("mt-1 text-xs", state.status === "error" ? "text-red-700" : "text-slate-600")} role={state.status === "error" ? "alert" : undefined}>
            {state.message}
          </p>
        ) : hint && state.status === "idle" ? (
          <p className="mt-1 text-xs text-slate-500">{hint}</p>
        ) : null}
        {onRetry ? (
          <Button type="button" size="sm" variant="secondary" className="mt-1.5" onClick={onRetry}>
            Ponów ten krok
          </Button>
        ) : null}
      </div>
    </li>
  );
}
