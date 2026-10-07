"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { actionSupplierOrderReplies } from "@/app/actions/gmail";
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/cn";
import type { GmailReply, GmailReplyKind } from "@/lib/google/gmail";
import { awaitingReplyStatus, businessDaysLabel, businessDaysSince } from "@/lib/suppliers/awaiting-supplier";
import type { SupplierOrderReplies as Item } from "@/lib/google/gmail-connections";

const dateTime = new Intl.DateTimeFormat("pl-PL", {
  timeZone: "Europe/Warsaw",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});
const dateOnly = new Intl.DateTimeFormat("pl-PL", { timeZone: "Europe/Warsaw", day: "2-digit", month: "2-digit" });

/** „Anna Schmidt <a@renfert.de>” → „Anna Schmidt”. */
function senderName(from: string): string {
  const name = from.replace(/<[^>]*>/, "").replace(/"/g, "").trim();
  return name || from.replace(/[<>]/g, "").trim() || "Dostawca";
}

/** Oznaczenie wiadomości, która nie jest odpowiedzią dostawcy (nie zamyka czekania). */
const REPLY_KIND_TAG: Record<Exclude<GmailReplyKind, "supplier">, { text: string; className: string }> = {
  auto: { text: "Autoodpowiedź", className: "bg-slate-200/70 text-slate-700" },
  bounce: { text: "Mail nie doszedł", className: "bg-red-100 text-red-800" },
  internal: { text: "Z Mikranu", className: "bg-slate-200/70 text-slate-700" },
};

/** Wiadomość w wątku: nadawca, czas, początek treści, załączniki; autoodpowiedź / zwrot oznaczone. */
export function MailReplyPreview({ reply }: { reply: GmailReply }) {
  const tag = reply.kind !== "supplier" ? REPLY_KIND_TAG[reply.kind] : null;
  return (
    <div className={cn("rounded-md px-2.5 py-2 ring-1", reply.kind === "bounce" ? "bg-red-50/60 ring-red-200" : "bg-slate-50 ring-slate-200/70")}>
      <p className="flex flex-wrap items-baseline justify-between gap-x-2 text-xs">
        <span className="flex min-w-0 items-baseline gap-1.5">
          {tag ? (
            <span className={cn("shrink-0 rounded px-1.5 py-px text-[10px] font-semibold", tag.className)}>{tag.text}</span>
          ) : null}
          <span className="min-w-0 truncate font-medium text-slate-800" title={reply.from}>
            {senderName(reply.from)}
          </span>
        </span>
        <span className="shrink-0 tabular-nums text-slate-500">{dateTime.format(new Date(reply.at))}</span>
      </p>
      {reply.snippet ? <p className="mt-1 line-clamp-3 text-xs leading-snug text-slate-700">{reply.snippet}</p> : null}
      {reply.attachments.length ? (
        <p className="mt-1 break-all text-[11px] text-slate-500">Załączniki: {reply.attachments.join(", ")}</p>
      ) : null}
    </div>
  );
}

export const mailLinkClass =
  "inline-flex min-h-8 items-center rounded px-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/45";

/** Karta dostawcy: ZD wysłane z OnTime i czy dostawca odpisał (wątek w Gmailu nadawcy). */
export function SupplierOrderReplies({ supplierId }: { supplierId: string }) {
  const pathname = usePathname();
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Stan ustawiany dopiero w .then — efekt przy otwarciu karty nie robi synchronicznego setState.
  const load = useCallback(
    () =>
      actionSupplierOrderReplies(supplierId)
        .then((res) => {
          setError(res.ok ? null : res.message);
          if (res.ok) setItems(res.items);
        })
        .catch(() => setError("Nie udało się sprawdzić odpowiedzi dostawcy."))
        .finally(() => setLoading(false)),
    [supplierId]
  );

  const reload = () => {
    setLoading(true);
    setError(null);
    void load();
  };

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && items == null) {
    return (
      <p className="flex items-center gap-2 text-xs text-slate-500" role="status">
        <Spinner size="sm" />
        Sprawdzam odpowiedzi w Gmailu…
      </p>
    );
  }
  if (error) {
    return (
      <p className="text-xs text-red-700" role="alert">
        {error}{" "}
        <button type="button" className={mailLinkClass} onClick={reload}>
          Spróbuj ponownie
        </button>
      </p>
    );
  }
  if (!items?.length) {
    return <p className="text-xs text-slate-500">Brak ZD wysłanych z OnTime do tego dostawcy w ostatnich 90 dniach.</p>;
  }

  const reconnectHref = `/api/google/connect?returnTo=${encodeURIComponent(pathname || "/")}`;

  return (
    <div className="space-y-2">
      <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200/70">
        {items.map((item) => {
          const replies = item.status === "read" ? item.replies : [];
          const state = awaitingReplyStatus(replies);
          const supplierReplies = replies.filter((r) => r.kind === "supplier").length;
          const waitingDays = businessDaysSince(new Date(item.sentAt));
          return (
            <li key={item.dokId} className="space-y-2 px-3 py-2.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <p className="min-w-0 text-sm font-medium text-slate-900">
                  {item.dokNr}
                  <span className="ml-1.5 text-xs font-normal text-slate-500">
                    wysłano {dateOnly.format(new Date(item.sentAt))}
                  </span>
                </p>
                {item.status === "read" ? (
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
                      state === "replied"
                        ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200"
                        : state === "bounced"
                          ? "bg-red-50 text-red-800 ring-1 ring-red-200"
                          : "bg-slate-100 text-slate-600 ring-1 ring-slate-200"
                    )}
                  >
                    {state === "replied"
                      ? supplierReplies === 1
                        ? "Odpisał"
                        : `Odpisał · ${supplierReplies} wiad.`
                      : state === "bounced"
                        ? "Mail nie doszedł"
                        : waitingDays === 0
                          ? "Czeka na odpowiedź"
                          : `Czeka na odpowiedź · ${businessDaysLabel(waitingDays)}`}
                  </span>
                ) : null}
              </div>

              {item.status === "unavailable" ? (
                <p className="text-xs text-slate-500">
                  {item.reason}
                  {item.reconnectSelf ? (
                    <a href={reconnectHref} className={cn(mailLinkClass, "ml-1")}>
                      Połącz ponownie
                    </a>
                  ) : null}
                </p>
              ) : null}

              {replies.slice(-2).map((r) => (
                <MailReplyPreview key={r.id} reply={r} />
              ))}
              {replies.length > 2 ? (
                <p className="text-[11px] text-slate-500">Starsze odpowiedzi ({replies.length - 2}) są w wątku w Gmailu.</p>
              ) : null}

              {item.gmailUrl ? (
                <a href={item.gmailUrl} target="_blank" rel="noopener" className={cn(mailLinkClass, "-ml-1.5")}>
                  Otwórz wątek w Gmailu
                </a>
              ) : null}
            </li>
          );
        })}
      </ul>
      <button type="button" className={cn(mailLinkClass, "-ml-1.5")} disabled={loading} onClick={reload}>
        {loading ? "Sprawdzam…" : "Sprawdź ponownie"}
      </button>
    </div>
  );
}
