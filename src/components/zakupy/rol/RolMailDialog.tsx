"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { actionRolEnsureZd, actionRolPrepareMail, actionRolSendMail, type RolMailPreview } from "@/app/actions/rol";
import { IconAlertCircle } from "@/components/icons/StrokeIcons";
import { ActionTimeline, type ActionStep } from "@/components/ui/ActionTimeline";
import { Alert } from "@/components/ui/Alert";
import { BrandLoader } from "@/components/ui/BrandLoader";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Field, Input, fieldControlClass } from "@/components/ui/Field";
import { ModalShell } from "@/components/ui/ModalShell";
import { polishPlural } from "@/lib/email/polish-plural";
import { rolPeriodLabel } from "@/lib/rol/view";

type StepKey = "zd" | "mail" | "hist";
type Phase = "loading" | "edit" | "sending" | "done";

const kb = (bytes: number) => `${Math.max(1, Math.round(bytes / 1024))} KB`;

/**
 * Okno wysyłki zgłoszenia ROL jednego klienta: mail według wzoru, pliki tej paczki, ZD w Subiekcie.
 * Montowane tylko na czas otwarcia — każde otwarcie zaczyna od świeżego podglądu.
 */
export function RolMailDialog({
  onClose,
  batchId,
  label,
  period,
}: {
  onClose: () => void;
  batchId: string;
  label: string;
  period: string;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("loading");
  const [preview, setPreview] = useState<RolMailPreview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mail, setMail] = useState({ to: "", cc: "", subject: "", body: "" });
  const [confirming, setConfirming] = useState(false);
  const [steps, setSteps] = useState<Record<StepKey, { status: ActionStep["status"]; message?: string }>>({
    zd: { status: "idle" },
    mail: { status: "idle" },
    hist: { status: "idle" },
  });

  useEffect(() => {
    let cancelled = false;
    void actionRolPrepareMail(batchId).then((res) => {
      if (cancelled) return;
      if (!res.ok) {
        setLoadError(res.error);
        setPhase("edit");
        return;
      }
      setPreview(res.preview);
      setMail(res.preview.draft);
      setPhase("edit");
    });
    return () => {
      cancelled = true;
    };
  }, [batchId]);

  const setStep = (key: StepKey, status: ActionStep["status"], message?: string) =>
    setSteps((s) => ({ ...s, [key]: { status, message } }));

  const runFrom = async (from: StepKey) => {
    setPhase("sending");
    if (from === "zd") {
      setStep("zd", "running");
      const zd = await actionRolEnsureZd(batchId);
      if (!zd.ok) {
        setStep("zd", "error", zd.error);
        return;
      }
      setStep("zd", "ok", zd.zdNr);
    }
    setStep("mail", "running");
    const sent = await actionRolSendMail(batchId, mail);
    if (!sent.ok) {
      setStep("mail", "error", sent.error);
      return;
    }
    setStep("mail", "ok", `Wysłano z ${sent.from}`);
    setStep("hist", "ok");
    setPhase("done");
    router.refresh();
  };

  const files = preview?.files ?? [];
  const blockers = [
    !preview?.from ? "połącz Gmail w Ustawieniach" : null,
    preview?.missingPdf.length ? `czekam na PDF: ${preview.missingPdf.join(", ")}` : null,
  ].filter((x): x is string => Boolean(x));
  const timeline: ActionStep[] = [
    {
      key: "zd",
      title: "ZD do Ivoclara w Subiekcie",
      detail: preview?.zd.nr ? `Istniejąca ${preview.zd.nr}` : `Nowa ZD, opis „${preview?.zd.uwagi ?? ""}”`,
      ...steps.zd,
      onRetry: steps.zd.status === "error" ? () => void runFrom("zd") : undefined,
    },
    {
      key: "mail",
      title: "Mail z Gmaila",
      detail: `${polishPlural(files.length, "załącznik", "załączniki", "załączników")} do ${mail.to}`,
      ...steps.mail,
      onRetry: steps.mail.status === "error" ? () => void runFrom("mail") : undefined,
    },
    { key: "hist", title: "Historia zgłoszenia", detail: "Zgłoszenie oznaczone jako wysłane", ...steps.hist },
  ];

  return (
    <ModalShell
      open
      onClose={onClose}
      title={`Zgłoszenie ROL ${label} · ${rolPeriodLabel(period)}`}
      size="xl"
      bodyClassName="px-5 py-4 sm:px-6"
      disableBackdropClose={phase === "sending"}
      footer={
        phase === "edit" ? (
          <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
            {blockers.length ? (
              <p className="flex items-start gap-1.5 text-sm text-amber-800 sm:mr-auto">
                <IconAlertCircle size={16} aria-hidden className="mt-0.5 shrink-0" />
                Przed wysyłką: {blockers.join(" · ")}
              </p>
            ) : null}
            <Button variant="secondary" onClick={onClose}>
              Anuluj
            </Button>
            <Button disabled={!preview || blockers.length > 0} onClick={() => setConfirming(true)}>
              Wyślij zgłoszenie ROL {label}
            </Button>
          </div>
        ) : phase === "done" ? (
          <Button onClick={onClose}>Gotowe</Button>
        ) : phase === "sending" && Object.values(steps).some((s) => s.status === "error") ? (
          <Button variant="secondary" onClick={onClose}>
            Zamknij
          </Button>
        ) : null
      }
    >
      {phase === "loading" ? (
        <div role="status" className="flex min-h-[12rem] flex-col items-center justify-center gap-3 text-sm text-slate-600">
          <BrandLoader size="md" />
          Przygotowuję mail i pliki zgłoszenia…
        </div>
      ) : phase === "sending" || phase === "done" ? (
        <div className="py-2">
          <ActionTimeline steps={timeline} ariaLabel="Wysyłka zgłoszenia ROL" />
        </div>
      ) : loadError ? (
        <Alert tone="error" title="Nie udało się przygotować maila">
          {loadError}
        </Alert>
      ) : preview ? (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Od:{" "}
            {preview.from ? (
              <span className="font-medium text-slate-900">{preview.from}</span>
            ) : (
              <Link href="/ustawienia" className="font-medium text-indigo-700 underline underline-offset-2">
                Połącz Gmail w Ustawieniach
              </Link>
            )}
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Do" hint="Kilka adresów oddziel przecinkiem.">
              <Input value={mail.to} onChange={(e) => setMail((m) => ({ ...m, to: e.target.value }))} />
            </Field>
            <Field label="DW">
              <Input value={mail.cc} onChange={(e) => setMail((m) => ({ ...m, cc: e.target.value }))} />
            </Field>
          </div>
          <Field label="Temat">
            <Input value={mail.subject} onChange={(e) => setMail((m) => ({ ...m, subject: e.target.value }))} />
          </Field>
          <Field label="Treść">
            <textarea
              value={mail.body}
              onChange={(e) => setMail((m) => ({ ...m, body: e.target.value }))}
              rows={12}
              className={fieldControlClass("default", "w-full py-2 font-[inherit] leading-relaxed")}
            />
          </Field>
          <div>
            <p className="text-xs font-semibold tracking-wide text-slate-600">
              Załączniki ({files.length} · {kb(files.reduce((s, f) => s + f.bytes, 0))})
            </p>
            <ul className="mt-1.5 space-y-0.5 text-sm text-slate-700">
              {files.map((f) => (
                <li key={f.name} className="flex justify-between gap-3">
                  <span className="min-w-0 break-words">{f.name}</span>
                  <span className="shrink-0 text-slate-500 tabular-nums">{kb(f.bytes)}</span>
                </li>
              ))}
              {preview.missingPdf.map((nr) => (
                <li key={nr} className="text-amber-800">
                  {nr}: PDF jeszcze się pobiera
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-md bg-slate-50 px-3 py-2.5 text-sm text-slate-700">
            <p className="font-medium text-slate-900">
              ZD w Subiekcie: {preview.zd.nr ?? "powstanie przy wysyłce"} · opis „{preview.zd.uwagi}”
            </p>
            <p className="mt-0.5 text-slate-600">
              {polishPlural(preview.zd.lines.length, "pozycja", "pozycje", "pozycji")} ·{" "}
              {preview.zd.lines.reduce((s, l) => s + l.qty, 0)} szt. — te same co w arkuszu.
            </p>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirming}
        tier="raised"
        title={`Wysłać zgłoszenie ROL ${label}?`}
        message={`Najpierw ${preview?.zd.nr ? `sprawdzę ZD ${preview.zd.nr}` : "utworzę ZD do Ivoclara w Subiekcie (LIVE)"}, potem wyślę mail z ${preview?.from ?? "Twojego Gmaila"} do ${mail.to}.`}
        summary={`${polishPlural(files.length, "załącznik", "załączniki", "załączników")}: arkusz i PDF-y FS tego klienta.`}
        confirmLabel="Utwórz ZD i wyślij"
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          void runFrom("zd");
        }}
      />
    </ModalShell>
  );
}
