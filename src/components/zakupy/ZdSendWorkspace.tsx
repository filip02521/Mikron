"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { actionSendZdToSupplier, type SendZdToSupplierResult } from "@/app/actions/gmail";
import { actionSetZdTerminAfterSend, actionZdSendPlan, type ZdSendPlan } from "@/app/actions/zd-send";
import {
  actionMarkZdEstimateIndividualsGlowne,
  actionMarkZdEstimateSupplierOrdered,
} from "@/app/actions/zd-estimate";
import { IconAlertCircle, IconCircleCheck, IconMail } from "@/components/icons/StrokeIcons";
import { MailPreview, type MailPreviewAttachment } from "@/components/mail/MailPreview";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/cn";
import { parseMailRecipients } from "@/lib/email/recipients";
import { zdTerminError } from "@/lib/orders/zd-send-plan";
import type { SupplierOrderEmail } from "@/lib/google/gmail-connections";
import type { DailyPanelUndoPayload } from "@/lib/orders/daily-panel-undo";
import { userFacingErrorTextFromMessage } from "@/lib/ui/user-facing-error";
import { controlFocusClass } from "@/lib/ui/ontime-theme";

const fieldClass = cn(controlFocusClass, "mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm");

type StepKey = "mail" | "termin" | "glowne" | "plan";
type StepState = { status: "idle" | "running" | "ok" | "error" | "skipped"; message?: string };

const plDate = (key: string) => key.split("-").reverse().join(".");

/** Laboratorium: przebieg wysyłki bez wysyłania i bez zapisu w Subiekcie. */
export type ZdSendSimulation = "ok" | "termin_error";
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
  scheduleHint,
  previousSend,
  manualContact,
  actionsSlot,
  simulation,
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
  scheduleHint: string | null;
  previousSend: SupplierOrderEmail | null;
  /** Kontakt i kopiowanie treści, gdy nie ma wysyłki z Gmaila. */
  manualContact: React.ReactNode;
  /** Miejsce w stopce okna na przyciski wysyłki; null = przyciski pod treścią. */
  actionsSlot?: HTMLElement | null;
  /** Tylko laboratorium: kroki udają odpowiedzi serwera (nic nie wychodzi, nic się nie zapisuje). */
  simulation?: ZdSendSimulation | null;
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
  const [steps, setSteps] = useState<Record<StepKey, StepState>>({
    mail: { status: previousSend ? "ok" : "idle", message: previousSend ? sentLabel(previousSend) : undefined },
    termin: { status: "idle" },
    glowne: { status: glowneDone ? "ok" : "idle" },
    plan: { status: scheduleDone ? "ok" : "idle" },
  });
  const [confirm, setConfirm] = useState<{ resend?: boolean; allowUnknownRecipients?: boolean }>({});
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
    const controller = new AbortController();
    let objectUrl: string | null = null;
    const url = `/api/operations/supplier-forms/zd/${dokId}/mail-attachment?supplierId=${encodeURIComponent(supplierId)}${refreshKey ? "&fresh=1" : ""}`;
    fetch(url, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) {
          const json = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(json?.error ?? `HTTP ${res.status}`);
        }
        const blob = await res.blob();
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
  }, [gmail, dokId, supplierId, refreshKey]);

  const refreshDocument = () => {
    setPlan(null);
    setAttachment({ state: "loading" });
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
  const willResetTermin = Boolean(planOk && !planOk.usesSupplierForm && planOk.termin !== planOk.today);

  const setStep = (key: StepKey, state: StepState) => setSteps((prev) => ({ ...prev, [key]: state }));

  async function runTermin(): Promise<boolean> {
    setStep("termin", { status: "running" });
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
    setStep("glowne", { status: "running" });
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
    if (scheduleDone || (!scheduleCanMark && live)) {
      setStep("plan", { status: "skipped", message: scheduleDone ? "Już zapisany" : (scheduleHint ?? "Bez planu do zapisania") });
      return;
    }
    setStep("plan", { status: "running" });
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
    setStep("mail", { status: "running" });
    showProgress();
    const res: SendZdToSupplierResult = live
      ? await actionSendZdToSupplier({ dokId, supplierId, to, cc, subject, body, terminAfterSend: termin, ...merged }).catch((e: unknown) => ({
          ok: false as const,
          message: userFacingErrorTextFromMessage(e instanceof Error ? e.message : String(e), "Nie udało się wysłać zamówienia."),
        }))
      : await wait(1600).then(() => ({
          ok: true as const,
          from: gmail.email,
          to: recipients.ok ? recipients.to : [to],
          cc: recipients.ok ? recipients.cc : [],
          attachmentName: attachment.state === "ready" ? attachment.file.name : "zamowienie.pdf",
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
    if ((previewOnly && live) || running) return;
    const confirmedInGmail = mailIssue?.kind === "uncertain";
    setMailIssue(null);
    setStep("mail", { status: "ok", message: confirmedInGmail ? "Jest w Wysłanych w Gmailu" : "Wysłane poza OnTime" });
    showProgress();
    await finishAfterMail();
  }

  const canSend =
    Boolean(gmail) &&
    (!previewOnly || !live) &&
    !running &&
    !mailDone &&
    recipients.ok &&
    subject.trim() !== "" &&
    body.trim() !== "" &&
    attachment.state === "ready" &&
    Boolean(planOk) &&
    !terminInvalid &&
    mailIssue?.kind !== "uncertain";

  return (
    <>
    <section aria-labelledby="zd-send-title" className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] md:items-start">
      <div className="min-w-0 space-y-4">
        <div>
          <h3 id="zd-send-title" className="text-base font-semibold text-slate-900">
            {mailDone ? "Zamówienie wysłane" : gmail ? `Wyślij zamówienie do ${supplierName}` : `Zamów u ${supplierName}`}
          </h3>
          <p className="mt-0.5 text-sm text-slate-600" role="status" aria-live="polite">
            {mailDone
              ? running
                ? "Mail wysłany - domykam termin, prośby i plan…"
                : allDone
                  ? "Gotowe - termin, prośby i plan są zapisane. Możesz zamknąć okno."
                  : "Mail wysłany. Krok oznaczony na czerwono wymaga ponowienia - mail nie pójdzie drugi raz."
              : gmail
                ? "Jedno kliknięcie wyśle maila z dokumentem i domknie resztę w Subiekcie i w planie."
                : "Zamów jak zwykle, potem kliknij „Wysłałem ręcznie” - OnTime domknie resztę."}
          </p>
        </div>

        {gmail ? (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor={ids.to} className="text-xs font-medium text-slate-500">
                  Do
                </label>
                <input id={ids.to} value={to} onChange={(e) => { setTo(e.target.value); setConfirm((c) => ({ ...c, allowUnknownRecipients: false })); }} disabled={mailDone} className={fieldClass} />
              </div>
              <div>
                <label htmlFor={ids.cc} className="text-xs font-medium text-slate-500">
                  DW (kopia) <span className="font-normal">- opcjonalnie</span>
                </label>
                <input
                  id={ids.cc}
                  value={cc}
                  onChange={(e) => { setCc(e.target.value); setConfirm((c) => ({ ...c, allowUnknownRecipients: false })); }}
                  disabled={mailDone}
                  inputMode="email"
                  autoComplete="off"
                  placeholder="np. kierownik@mikran.com"
                  className={fieldClass}
                />
              </div>
            </div>
            <div>
              <label htmlFor={ids.subject} className="text-xs font-medium text-slate-500">
                Temat
              </label>
              <input id={ids.subject} value={subject} onChange={(e) => setSubject(e.target.value)} disabled={mailDone} className={fieldClass} />
            </div>
            <div>
              <label htmlFor={ids.body} className="text-xs font-medium text-slate-500">
                Treść
              </label>
              <textarea
                id={ids.body}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                disabled={mailDone}
                rows={9}
                className={cn(fieldClass, "leading-relaxed")}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-2">{manualContact}</div>
        )}

        <div ref={progressRef} className="scroll-mb-4 rounded-[var(--radius-panel)] border border-slate-200 bg-slate-50/70 p-3.5">
          <p className="text-sm font-semibold text-slate-900">{mailDone ? "Postęp" : "Po wysłaniu OnTime zrobi"}</p>
          <ol className="mt-2.5 space-y-3">
            <StepRow
              n={1}
              state={steps.mail}
              title={gmail ? "Mail z dokumentem do dostawcy" : "Zamówienie wysłane poza OnTime"}
              detail={
                gmail
                  ? orderFormKind
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
                    className={cn(controlFocusClass, "min-h-9 rounded-md border border-slate-200 bg-white px-2 text-sm tabular-nums")}
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
                      <Spinner size="sm" /> Sprawdzam pozycje ZD w Subiekcie…
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
              title="Plan dostawcy: zamówienie złożone"
              detail={scheduleDone ? "Już zapisany." : scheduleCanMark ? "Przeliczy termin kolejnego zamówienia." : (scheduleHint ?? "Ten dostawca nie ma planu do zapisania.")}
              onRetry={mailDone && steps.plan.status === "error" ? () => void runPlan() : undefined}
            />
          </ol>
        </div>

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
            <p>
              To ZD wysłano już {sentLabel(mailIssue.sent)}. Wysłać jeszcze raz?
            </p>
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

      {gmail ? (
        <div className="min-w-0 space-y-2 md:sticky md:top-0">
          {willResetTermin && !mailDone ? (
            <p className="rounded-md bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-700 ring-1 ring-slate-200">
              {planOk!.termin
                ? `ZD ma teraz w Subiekcie termin ${plDate(planOk!.termin)}. Przed wysyłką ustawię dzisiejszy i wydrukuję dokument ponownie - dostawca nie zobaczy naszej daty.`
                : "ZD nie ma terminu realizacji w Subiekcie. Przed wysyłką ustawię dzisiejszy, żeby był na wydruku dla dostawcy."}
            </p>
          ) : null}
          <MailPreview
            from={gmail.email}
            to={to}
            cc={cc}
            subject={subject}
            text={body}
            attachments={attachment.state === "ready" ? [attachment.file] : []}
            attachmentsLoading={
              attachment.state === "loading"
                ? orderFormKind
                  ? `Wypełniam formularz ${supplierName}…`
                  : "Pobieram wydruk ZD z Subiekta (do ok. 30 s)…"
                : null
            }
            attachmentsError={attachment.state === "error" ? attachment.message : null}
          />
          {!mailDone ? (
            <button
              type="button"
              onClick={refreshDocument}
              disabled={attachment.state === "loading" || running}
              className="inline-flex min-h-9 items-center rounded px-1.5 text-xs font-medium text-indigo-700 underline decoration-indigo-300 underline-offset-2 hover:decoration-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/45 disabled:opacity-50"
              title="Gdy dopisałeś coś do ZD w Subiekcie - pozycje i wydruk wczytają się od nowa"
            >
              Odśwież dokument z Subiekta
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
    {previewOnly ? (
      <p className="text-xs text-slate-500">
        {live
          ? "Podgląd - w tym oknie nic nie zostanie wysłane ani zapisane."
          : "Symulacja - przyciski działają, ale nic nie zostanie wysłane ani zapisane w Subiekcie."}
      </p>
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
            disabled={(previewOnly && live) || running || !planOk || terminInvalid}
            onClick={() => void markSentManually()}
            title="Wysłałeś zamówienie inną drogą - OnTime ustawi termin, Główne i plan"
          >
            Wysłałem ręcznie
          </Button>
        ) : null}
        {gmail && !mailDone ? (
          <Button
            type="button"
            className="min-h-11 w-full sm:w-auto"
            disabled={!canSend}
            aria-busy={steps.mail.status === "running"}
            onClick={() => void send()}
          >
            {steps.mail.status === "running" ? (
              <span className="inline-flex items-center gap-2">
                <Spinner className="size-4" /> Wysyłam…
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
          ? `${total} ${total === 1 ? "prośba zostanie oznaczona" : total < 5 ? "prośby zostaną oznaczone" : "próśb zostanie oznaczonych"} jako zamówione.`
          : "Żadna prośba nie jest w tym ZD."}
      </span>
      {plan.notInZd.length ? (
        <details className="text-xs text-amber-900">
          <summary className="cursor-pointer font-medium">
            {plan.notInZd.length} {plan.notInZd.length === 1 ? "prośba nie jest" : "próśb nie jest"} w ZD - zostaną bez zmian
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
      <span
        aria-hidden
        className={cn(
          "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums",
          state.status === "ok"
            ? "bg-emerald-100 text-emerald-800"
            : state.status === "error"
              ? "bg-red-100 text-red-800"
              : "bg-white text-slate-600 ring-1 ring-slate-300"
        )}
      >
        {state.status === "running" ? (
          <Spinner size="sm" />
        ) : state.status === "ok" ? (
          <IconCircleCheck size={14} />
        ) : state.status === "error" ? (
          <IconAlertCircle size={14} />
        ) : (
          n
        )}
      </span>
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
