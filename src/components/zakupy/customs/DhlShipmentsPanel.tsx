"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { actionCreateDhlClearance, actionDismissDhlShipment, actionRetryDhlShipment } from "@/app/actions/customs-dhl";
import type { CustomsSupplierOption } from "@/app/actions/customs-clearance";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Select } from "@/components/ui/Field";
import type { DhlShipmentItem } from "@/lib/customs/dhl-data";

const DAY_MS = 86_400_000;
/** DHL Express: 3 dni kalendarzowe bez opłat (z dniem przybycia), zwrot do nadawcy po 10 dniach. */
const FREE_DAYS = 3;
const RETURN_DAYS = 10;

function dayLabel(ms: number): string {
  return new Date(ms).toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", timeZone: "Europe/Warsaw" });
}

function deadlines(requestedAt: string | null, now: number): { text: string; tone: "warning" | "danger" | "default" } | null {
  if (!requestedAt) return null;
  const start = new Date(requestedAt).getTime();
  const lastFree = start + (FREE_DAYS - 1) * DAY_MS;
  const returnAt = start + RETURN_DAYS * DAY_MS;
  if (now > returnAt) return { text: `Termin zwrotu minął ${dayLabel(returnAt)}`, tone: "danger" };
  if (now > lastFree + DAY_MS) return { text: `Składowanie płatne · zwrot ${dayLabel(returnAt)}`, tone: "danger" };
  return { text: `Bez opłat do ${dayLabel(lastFree)}`, tone: lastFree - now < DAY_MS ? "warning" : "default" };
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Warsaw",
  });
}

export function DhlShipmentsPanel({
  shipments,
  suppliers,
}: {
  shipments: DhlShipmentItem[];
  suppliers: CustomsSupplierOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [messages, setMessages] = useState<Record<string, { tone: "error" | "info"; text: string }>>({});
  const [now] = useState(() => Date.now());

  if (!shipments.length) return null;

  function run(id: string, fn: () => Promise<{ ok: true; id?: string | null; note?: string | null } | { ok: false; error: string }>) {
    setBusyId(id);
    setMessages(({ [id]: _cleared, ...rest }) => rest);
    startTransition(async () => {
      const res = await fn();
      setBusyId(null);
      if (!res.ok) {
        setMessages((m) => ({ ...m, [id]: { tone: "error", text: res.error } }));
        return;
      }
      if (res.id) {
        router.push(`/zakupy/odprawy/${res.id}`);
        return;
      }
      if (res.note) setMessages((m) => ({ ...m, [id]: { tone: "info", text: res.note! } }));
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader
        title="Z maili DHL"
        description="Prośby Agencji Celnej DHL o dyspozycję. Odprawa zakłada się sama z faktury w załączniku - sprawdź pozycje i wyślij odpowiedź w wątku agencji."
      />
      <ul className="mt-3 divide-y divide-slate-100">
        {shipments.map((s) => {
          const due = s.stage === "request" ? deadlines(s.requestedAt, now) : null;
          const busy = pending && busyId === s.id;
          const msg = messages[s.id];
          return (
            <li key={s.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
              <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:gap-4">
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="text-sm font-semibold text-slate-900 tabular-nums">
                    AWB {s.awb}
                    {s.sellerName ? <span className="font-normal text-slate-600"> · {s.sellerName}</span> : null}
                  </p>
                  <p className="text-xs text-slate-500 tabular-nums">
                    {[s.ticket ? `T#${s.ticket}` : null, `prośba ${formatDateTime(s.requestedAt)}`]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
                  {s.reminderCount > 0 ? (
                    <Badge variant="danger">Ponaglenie{s.reminderCount > 1 ? ` ×${s.reminderCount}` : ""}</Badge>
                  ) : null}
                  {due ? <Badge variant={due.tone}>{due.text}</Badge> : null}
                  {s.stage === "request" ? <Badge variant="warning">Czeka na odpowiedź</Badge> : null}
                </div>
              </div>

              {s.clearanceId ? (
                <div className="flex flex-wrap items-center gap-3">
                  <Link
                    href={`/zakupy/odprawy/${s.clearanceId}`}
                    className="text-sm font-medium text-indigo-700 hover:text-indigo-900"
                  >
                    Otwórz odprawę
                  </Link>
                  <span className="text-xs text-slate-500">
                    {s.canReplyInThread
                      ? "Wysyłka z odprawy odpowie w wątku agencji."
                      : "Oryginał prośby nie dotarł do połączonej skrzynki - mail pójdzie jako odpowiedź z tematem prośby."}
                  </span>
                </div>
              ) : (
                <>
                  {s.note ? <p className="text-sm text-slate-600">{s.note}</p> : null}
                  {!s.hasInvoice ? (
                    <p className="text-sm text-slate-600">
                      Faktury nie było w załączniku. Załóż odprawę ręcznie przyciskiem „Nowa odprawa”.
                    </p>
                  ) : null}
                  <div className="flex flex-wrap items-center gap-2">
                    {s.hasInvoice ? (
                      <>
                        <Select
                          className="w-auto min-w-48"
                          value={picked[s.id] ?? s.supplierId ?? ""}
                          onChange={(e) => setPicked((p) => ({ ...p, [s.id]: e.target.value }))}
                          aria-label={`Dostawca dla AWB ${s.awb}`}
                        >
                          <option value="">- dostawca -</option>
                          {suppliers.map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.name}
                            </option>
                          ))}
                        </Select>
                        <Button
                          size="sm"
                          disabled={pending || !(picked[s.id] ?? s.supplierId)}
                          onClick={() => run(s.id, () => actionCreateDhlClearance(s.id, (picked[s.id] ?? s.supplierId)!))}
                        >
                          {busy ? "Zakładam…" : "Załóż odprawę"}
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={pending}
                          onClick={() => run(s.id, () => actionRetryDhlShipment(s.id))}
                        >
                          Odczytaj ponownie
                        </Button>
                      </>
                    ) : null}
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={pending}
                      onClick={() => run(s.id, () => actionDismissDhlShipment(s.id, true))}
                    >
                      Pomiń
                    </Button>
                  </div>
                </>
              )}
              {msg ? <Alert tone={msg.tone === "error" ? "error" : "info"}>{msg.text}</Alert> : null}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
