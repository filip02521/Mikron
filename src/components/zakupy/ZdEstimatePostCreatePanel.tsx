"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { actionGetSupplierContact } from "@/app/actions/zd-estimate";
import { SupplierContactActions } from "@/components/procurement/SupplierContactActions";
import { Button } from "@/components/ui/Button";
import { ModalShell } from "@/components/ui/ModalShell";
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/cn";
import {
  buildMailtoHref,
  buildZdSupplierMailto,
  postCreateLinesSnapshotToTsv,
  postCreateNeedsHistoryLink,
  ZD_POST_CREATE_PREVIEW_VISIBLE,
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
}: {
  session: ZdPostCreateSession;
  dateKey: string;
  /** Create nadal zablokowany — pokaż CTA w panelu (bez osobnego banera). */
  createLocked?: boolean;
  onDismiss: () => void;
  onOpenLink: () => void;
  onUnlockCreate?: () => void;
  onCopyError?: (message: string) => void;
}) {
  const router = useRouter();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const rootRef = useRef<HTMLElement>(null);
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

  useEffect(() => {
    rootRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    headingRef.current?.focus();
  }, [session.createdAtMs, session.kind]);

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

  const visible = session.linesSnapshot.slice(0, ZD_POST_CREATE_PREVIEW_VISIBLE);
  const hiddenCount = Math.max(
    0,
    session.linesSnapshot.length - visible.length
  );

  const cardsHref = supplierCardsHref(supplierHubContextForRole("admin"), {
    q: session.supplierName,
  });

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

  return (
    <>
      <section
        ref={rootRef}
        className="scroll-mt-4 rounded-xl border border-emerald-200/80 bg-gradient-to-b from-emerald-50/70 to-white shadow-sm"
        aria-labelledby="zd-post-create-title"
      >
        <div className="border-b border-emerald-100/90 px-4 py-4 sm:px-5">
          <h2
            id="zd-post-create-title"
            ref={headingRef}
            tabIndex={-1}
            className={cn(
              panelTypography.sectionTitle,
              "outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60"
            )}
          >
            {title}
          </h2>
          <p className="mt-1 text-sm text-slate-700">
            <span className="font-semibold tabular-nums text-slate-900">
              {dokLabel}
            </span>
            <span className="text-slate-500"> · </span>
            <span className="font-medium">{session.supplierName}</span>
            <span className="text-slate-500"> · </span>
            <span className="tabular-nums">{session.lineCount} poz.</span>
          </p>
          {candidatesHint ? (
            <p className="mt-2 text-sm text-amber-900">{candidatesHint}</p>
          ) : null}
          {createLocked ? (
            <p className="mt-2 text-sm text-amber-900">
              {session.kind === "timeout_recovery"
                ? ZD_ESTIMATE_UI.postCreateTimeoutLockBody
                : "Create zablokowany dla tej listy — odblokuj świadomie, powiąż ZD albo przelicz listę."}
            </p>
          ) : null}
        </div>

        <div className="space-y-4 px-4 py-4 sm:px-5">
          <ul className="space-y-1.5 text-sm text-slate-700">
            <li className="flex gap-2">
              <StatusDot
                ok={session.kind !== "timeout_recovery"}
                unsure={session.kind === "timeout_recovery"}
              />
              <span>
                {session.kind === "timeout_recovery"
                  ? ZD_ESTIMATE_UI.postCreateStatusSubiektUnsure
                  : ZD_ESTIMATE_UI.postCreateStatusSubiektOk}
              </span>
            </li>
            <li className="flex gap-2">
              <StatusDot ok={session.snapshotOk} />
              <span>
                {session.snapshotOk
                  ? ZD_ESTIMATE_UI.postCreateStatusHistoryOk
                  : session.snapshotMessage?.trim() ||
                    ZD_ESTIMATE_UI.postCreateStatusHistoryNeed}
              </span>
            </li>
            <li className="flex gap-2">
              <StatusDot
                ok={!session.markIndividualsMessage}
                soft={!session.markIndividualsMessage}
              />
              <span>
                {session.markIndividualsMessage?.trim() ||
                  ZD_ESTIMATE_UI.postCreateStatusGlowneNone}
              </span>
            </li>
          </ul>

          {visible.length > 0 ? (
            <div className="overflow-hidden rounded-lg border border-slate-200/80">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-2.5 py-1.5 font-medium">Symbol</th>
                    <th className="px-2.5 py-1.5 text-right font-medium">Do ZD</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((l) => (
                    <tr key={l.twId} className="border-t border-slate-100">
                      <td className="px-2.5 py-1.5 font-medium text-slate-800">
                        {l.symbol}
                      </td>
                      <td className="px-2.5 py-1.5 text-right tabular-nums text-slate-700">
                        {l.ilosc}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {hiddenCount > 0 ? (
                <p className="border-t border-slate-100 bg-slate-50/80 px-2.5 py-1.5 text-[11px] text-slate-500">
                  …i {hiddenCount} poz.
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="rounded-lg border border-slate-200/80 bg-white px-3 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
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
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
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
              {tsvCopied ? "Skopiowano" : ZD_ESTIMATE_UI.postCreateCopyTsvCta}
            </Button>

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
      </section>

      {mailOpen && mailtoSeed && email ? (
        <ModalShell
          open
          onClose={() => setMailOpen(false)}
          title={ZD_ESTIMATE_UI.postCreateMailComposeTitle}
          titleHint={ZD_ESTIMATE_UI.postCreateMailComposeHint}
          titleId="zd-post-create-mail-title"
          size="md"
          tier="raised"
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
                <Button type="button" className="min-h-11 w-full sm:w-auto" disabled>
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
              type="text"
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
                "mt-1 w-full resize-y rounded-md border border-slate-200 bg-white px-3 py-2 text-sm leading-relaxed"
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
        "mt-1.5 size-1.5 shrink-0 rounded-full",
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
