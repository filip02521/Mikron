"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { actionGmailStatus } from "@/app/actions/gmail";
import { MailPreview } from "@/components/mail/MailPreview";
import { Button } from "@/components/ui/Button";
import { ModalShell } from "@/components/ui/ModalShell";
import { Spinner } from "@/components/ui/Spinner";
import {
  actionPrepareSupplierInquiry,
  actionSendSupplierInquiry,
  type SendSupplierInquiryResult,
  type SupplierInquiryPrep,
} from "@/app/actions/department-board-inquiry";
import { formatBoardDate } from "@/lib/department-board/format";
import { parseMailRecipients } from "@/lib/email/recipients";
import { cn } from "@/lib/cn";
import { controlFocusClass } from "@/lib/ui/ontime-theme";
import { userFacingErrorText } from "@/lib/ui/user-facing-error";

const GMAIL_CONNECT_HREF = "/api/google/connect?returnTo=/ustawienia";

type Prep = Extract<SupplierInquiryPrep, { ok: true }>;
type SendError = Extract<SendSupplierInquiryResult, { ok: false }>;

const fieldClass = cn(controlFocusClass, "mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm");

/** Okienko „Zapytaj dostawcę” — szkic maila o cenę, dostępność i termin, wysyłka z Gmaila osoby z zakupów. */
export function SupplierInquiryDialog({
  threadId,
  onClose,
  onSent,
}: {
  threadId: string;
  onClose: () => void;
  onSent: () => void;
}) {
  const ids = { supplier: useId(), to: useId(), cc: useId(), subject: useId(), body: useId() };
  const [prep, setPrep] = useState<Prep | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [supplierId, setSupplierId] = useState("");
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<SendError | null>(null);
  /** Potwierdzenia z poprzednich prób (ponowne zapytanie, adres spoza karty) — kumulują się. */
  const [confirmed, setConfirmed] = useState<{ resend?: boolean; allowUnknownRecipients?: boolean }>({});

  useEffect(() => {
    let alive = true;
    actionPrepareSupplierInquiry(threadId)
      .then((res) => {
        if (!alive) return;
        if (!res.ok) return setLoadError(res.message);
        setPrep(res);
        if (res.suggestedIds.length === 1) pickSupplier(res, res.suggestedIds[0]!);
      })
      .catch((e) => alive && setLoadError(userFacingErrorText(e, "Nie udało się przygotować zapytania.")));
    return () => {
      alive = false;
    };
     
  }, [threadId]);

  // „Połącz z Gmailem” otwiera nową kartę — po powrocie okno ma zobaczyć połączenie bez ponownego otwierania.
  const gmailEmail = prep?.gmail.email ?? null;
  const gmailConfigured = prep?.gmail.configured ?? false;
  useEffect(() => {
    if (!gmailConfigured || gmailEmail) return;
    const refresh = () =>
      void actionGmailStatus()
        .then((res) => {
          if (res.email) setPrep((p) => (p ? { ...p, gmail: { configured: true, email: res.email } } : p));
        })
        .catch(() => undefined);
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [gmailConfigured, gmailEmail]);

  function pickSupplier(p: Prep, id: string) {
    setSupplierId(id);
    setSendError(null);
    setConfirmed({});
    const supplier = p.suppliers.find((s) => s.id === id);
    if (!supplier) return;
    const draft = supplier.english ? p.draftEn : p.draftPl;
    setTo(supplier.emails[0] ?? "");
    setSubject(draft.subject);
    setBody(draft.body);
  }

  const supplier = prep?.suppliers.find((s) => s.id === supplierId) ?? null;
  const orderedSuppliers = useMemo(() => {
    if (!prep) return { suggested: [], rest: [] };
    const suggested = new Set(prep.suggestedIds);
    return {
      suggested: prep.suppliers.filter((s) => suggested.has(s.id)),
      rest: prep.suppliers.filter((s) => !suggested.has(s.id)),
    };
  }, [prep]);
  const recipients = parseMailRecipients(to, cc);
  const canSend =
    Boolean(prep?.gmail.email) && Boolean(supplier) && recipients.ok && subject.trim() !== "" && body.trim() !== "";

  async function send(opts: { resend?: boolean; allowUnknownRecipients?: boolean } = {}) {
    if (!supplier || sending) return;
    const flags = { ...confirmed, ...opts };
    setConfirmed(flags);
    setSending(true);
    setSendError(null);
    try {
      const res = await actionSendSupplierInquiry({ threadId, supplierId: supplier.id, to, cc, subject, body, ...flags });
      if (res.ok) {
        onSent();
        onClose();
      } else {
        setSendError(res);
      }
    } catch (e) {
      setSendError({ ok: false, message: userFacingErrorText(e, "Nie udało się wysłać zapytania.") });
    } finally {
      setSending(false);
    }
  }

  return (
    <ModalShell
      open
      onClose={() => !sending && onClose()}
      title="Zapytaj dostawcę"
      titleHint="Mail o cenę, dostępność i czas realizacji wychodzi z Twojego Gmaila. Handlowiec od razu widzi w wątku, że czekacie na dostawcę — nie trzeba tego dopisywać. Odpowiedź dostawcy pokaże się w tym wątku (z propozycją odpowiedzi dla handlowca); Twoja odpowiedź handlowcowi zakończy oczekiwanie."
      titleId={`supplier-inquiry-${threadId}`}
      size="full"
      tier="top"
      loadingMessage={!prep && !loadError ? "Przygotowuję zapytanie…" : null}
      bodyClassName="grid auto-rows-max gap-5 px-5 py-5 sm:px-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] md:items-start"
      footer={
        <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" className="min-h-11 w-full sm:w-auto" disabled={sending} onClick={onClose}>
            Anuluj
          </Button>
          <Button
            type="button"
            className="min-h-11 w-full sm:w-auto"
            disabled={!canSend || sending}
            aria-busy={sending}
            onClick={() => void send()}
          >
            {sending ? (
              <span className="inline-flex items-center gap-2">
                <Spinner className="size-4" /> Wysyłam…
              </span>
            ) : (
              "Wyślij zapytanie"
            )}
          </Button>
        </div>
      }
    >
      {loadError ? (
        <p className="text-sm text-rose-800" role="alert">
          {loadError}
        </p>
      ) : prep ? (
        <>
          <div className="min-w-0 space-y-4">
          {!prep.gmail.configured ? (
            <p className="rounded-md bg-amber-50 px-3 py-2.5 text-sm text-amber-950 ring-1 ring-amber-200" role="alert">
              Wysyłka z Gmaila nie jest skonfigurowana na serwerze.
            </p>
          ) : !prep.gmail.email ? (
            <p className="rounded-md bg-amber-50 px-3 py-2.5 text-sm text-amber-950 ring-1 ring-amber-200" role="alert">
              Najpierw połącz swojego Gmaila.{" "}
              <a href={GMAIL_CONNECT_HREF} target="_blank" rel="noopener" className="font-medium underline">
                Połącz z Gmailem
              </a>
            </p>
          ) : null}

          {prep.pending ? (
            <p className="text-xs leading-relaxed text-slate-500">
              W tym wątku czeka już zapytanie do <span className="font-medium text-slate-700">{prep.pending.supplierName}</span>{" "}
              ({formatBoardDate(prep.pending.sentAt)}).
            </p>
          ) : null}

          <div>
            <label htmlFor={ids.supplier} className="text-xs font-medium text-slate-500">
              Dostawca
            </label>
            <select
              id={ids.supplier}
              value={supplierId}
              onChange={(e) => pickSupplier(prep, e.target.value)}
              className={fieldClass}
            >
              <option value="" disabled>
                Wybierz dostawcę…
              </option>
              {orderedSuppliers.suggested.length ? (
                <optgroup label="Powiązani z tym towarem">
                  {orderedSuppliers.suggested.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </optgroup>
              ) : null}
              <optgroup label={orderedSuppliers.suggested.length ? "Pozostali" : "Dostawcy"}>
                {orderedSuppliers.rest.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          {supplier ? (
            <>
              <div>
                <label htmlFor={ids.to} className="text-xs font-medium text-slate-500">
                  Do
                </label>
                {supplier.emails.length > 1 ? (
                  <select id={ids.to} value={to} onChange={(e) => { setTo(e.target.value); setConfirmed((c) => ({ ...c, allowUnknownRecipients: false })); }} className={fieldClass}>
                    {supplier.emails.map((email) => (
                      <option key={email} value={email}>
                        {email}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input id={ids.to} value={to} onChange={(e) => { setTo(e.target.value); setConfirmed((c) => ({ ...c, allowUnknownRecipients: false })); }} className={fieldClass} />
                )}
                <p className="mt-1 text-xs text-slate-500">
                  {supplier.english ? "Szkic po angielsku (dostawca zagraniczny)." : "Szkic po polsku."}
                </p>
              </div>
              <div>
                <label htmlFor={ids.cc} className="text-xs font-medium text-slate-500">
                  DW (kopia) <span className="font-normal">- opcjonalnie, adresy po przecinku</span>
                </label>
                <input
                  id={ids.cc}
                  type="text"
                  inputMode="email"
                  autoComplete="off"
                  value={cc}
                  onChange={(e) => { setCc(e.target.value); setConfirmed((c) => ({ ...c, allowUnknownRecipients: false })); }}
                  placeholder="np. kierownik@mikran.com"
                  className={fieldClass}
                />
              </div>
              <div>
                <label htmlFor={ids.subject} className="text-xs font-medium text-slate-500">
                  Temat
                </label>
                <input id={ids.subject} value={subject} onChange={(e) => setSubject(e.target.value)} className={fieldClass} />
              </div>
              <div>
                <label htmlFor={ids.body} className="text-xs font-medium text-slate-500">
                  Treść
                </label>
                <textarea
                  id={ids.body}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={12}
                  className={cn(fieldClass, "font-sans leading-relaxed")}
                />
                {prep.productFromTitle ? (
                  <p className="mt-1 rounded-md bg-amber-50 px-2.5 py-1.5 text-xs text-amber-950 ring-1 ring-amber-200">
                    Handlowiec nie wybrał produktu — w szkicu jest tytuł pytania. Wpisz nazwę i symbol produktu w temacie i treści.
                  </p>
                ) : null}
                <p className="mt-1 text-xs text-slate-500">
                  Treść pytania handlowca nie trafia do maila — dopisz ilość, jeśli ma znaczenie dla ceny.
                </p>
              </div>
            </>
          ) : null}

          {sendError?.unknownRecipients?.length ? (
            <div className="space-y-2 rounded-md bg-amber-50 px-3 py-2.5 text-sm text-amber-950 ring-1 ring-amber-200" role="alert">
              <p>
                {sendError.unknownRecipients.join(", ")} nie ma na karcie {supplier?.name}. Sprawdź adres — zapytanie wyjdzie z Twojej
                skrzynki.
              </p>
              <Button type="button" variant="secondary" className="min-h-10" disabled={sending} onClick={() => void send({ allowUnknownRecipients: true })}>
                Wyślij mimo to
              </Button>
            </div>
          ) : sendError?.alreadyPending ? (
            <div className="space-y-2 rounded-md bg-amber-50 px-3 py-2.5 text-sm text-amber-950 ring-1 ring-amber-200" role="alert">
              <p>
                Zapytanie do {sendError.alreadyPending.supplierName} wysłano już {formatBoardDate(sendError.alreadyPending.sentAt)} i czeka na
                odpowiedź. Wysłać jeszcze raz?
              </p>
              <Button type="button" variant="secondary" className="min-h-10" disabled={sending} onClick={() => void send({ resend: true })}>
                Wyślij ponownie
              </Button>
            </div>
          ) : sendError ? (
            <p className="text-sm text-rose-800" role="alert">
              {sendError.message}{" "}
              {sendError.reconnect ? (
                <a href={GMAIL_CONNECT_HREF} target="_blank" rel="noopener" className="font-medium underline">
                  Połącz z Gmailem
                </a>
              ) : null}
            </p>
          ) : null}
          </div>
          {supplier ? (
            <MailPreview
              className="md:sticky md:top-0"
              from={prep.gmail.email}
              to={to}
              cc={cc}
              subject={subject}
              text={body}
              attachments={[]}
            />
          ) : (
            <p className="rounded-[var(--radius-panel)] border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">
              Wybierz dostawcę — tu zobaczysz wiadomość dokładnie tak, jak do niego wyjdzie.
            </p>
          )}
        </>
      ) : null}
    </ModalShell>
  );
}
