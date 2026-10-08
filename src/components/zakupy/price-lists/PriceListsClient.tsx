"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { actionPreparePriceList, actionSetPricesHost } from "@/app/actions/price-lists";
import { PRICE_LIST_PROFILES } from "@/lib/price-lists/price-list";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable, TableScroll } from "@/components/ui/DataTable";
import { Field, Select } from "@/components/ui/Field";
import { polishPlural } from "@/lib/email/polish-plural";
import type { PriceListImport } from "@/lib/price-lists/data";

export function formatDate(value: string | null): string {
  if (!value) return "-";
  const [y, m, d] = value.slice(0, 10).split("-");
  return `${d}.${m}.${y}`;
}

export function HostBadge({ isLive }: { isLive: boolean }) {
  return isLive ? <Badge variant="danger">LIVE :5080</Badge> : <Badge variant="info">Test :5082</Badge>;
}

export function PriceListsClient({
  imports,
  host,
  hostError,
  canSwitchHost,
}: {
  imports: PriceListImport[];
  host: { label: string; isLive: boolean } | null;
  hostError: string | null;
  canSwitchHost: boolean;
}) {
  const router = useRouter();
  const [profileId, setProfileId] = useState(PRICE_LIST_PROFILES[0]!.id);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [confirmSwitch, setConfirmSwitch] = useState(false);

  function switchHost() {
    if (!host) return;
    setError(null);
    startTransition(async () => {
      const res = await actionSetPricesHost(host.isLive ? "orders_test" : "live").catch(() => null);
      setConfirmSwitch(false);
      if (!res || !res.ok) {
        setError(res?.error ?? "Brak połączenia z serwerem. Odśwież stronę i spróbuj ponownie.");
        return;
      }
      router.refresh();
    });
  }
  // Bieżący wpis = najświeższy (wgrany lub zaktualizowany) dla tej cechy i Subiekta; starsze to archiwum.
  const currentIds = new Set(
    [...imports]
      .sort((x, y) => (y.updatedAt ?? y.createdAt).localeCompare(x.updatedAt ?? x.createdAt))
      .filter((imp, i, all) => all.findIndex((o) => o.cechaId === imp.cechaId && o.hostKind === imp.hostKind) === i)
      .map((imp) => imp.id)
  );

  const profile = PRICE_LIST_PROFILES.find((p) => p.id === profileId)!;
  const blocker = !file ? "Wybierz plik cennika." : null;

  function submit() {
    if (!file) return;
    setError(null);
    const fd = new FormData();
    fd.set("file", file);
    fd.set("profile", profile.id);
    startTransition(async () => {
      const res = await actionPreparePriceList(fd).catch(() => null);
      if (!res || !res.ok) {
        setError(res?.error ?? "Brak połączenia z serwerem (sesja mogła wygasnąć). Odśwież stronę i spróbuj ponownie.");
        return;
      }
      router.push(`/zakupy/cenniki/${res.id}${res.updated ? "?zaktualizowano=1" : ""}`);
    });
  }

  return (
    <div className="space-y-4">
      {hostError ? <Alert tone="warning" title="Brak hosta cen Subiekta">{hostError}</Alert> : null}
      {host ? (
        <Card>
          <CardHeader
            title="Nowy cennik"
            description="Wybierz rodzaj cennika i wgraj plik od dostawcy. Porównam ceny tylko dla towarów jego cechy — w Subiekcie nic się nie zmieni, dopóki nie zatwierdzisz zapisu."
            action={
              <div className="flex items-center gap-2">
                <HostBadge isLive={host.isLive} />
                {canSwitchHost ? (
                  <Button size="sm" variant="secondary" disabled={pending} onClick={() => setConfirmSwitch(true)}>
                    {host.isLive ? "Przełącz na test :5082" : "Przełącz na LIVE :5080"}
                  </Button>
                ) : null}
              </div>
            }
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Rodzaj cennika"
              hint={`Porównam tylko towary z cechą „${profile.cechaName}”. Inne cenniki dodamy jako kolejne rodzaje.`}
            >
              <Select value={profileId} onChange={(e) => setProfileId(e.target.value)} disabled={pending} aria-label="Rodzaj cennika">
                {PRICE_LIST_PROFILES.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label="Plik cennika – Excel lub CSV"
              hint={`Oryginalny plik ${profile.label} z kolumnami: ${Object.values(profile.headers).join(", ")}. Plik w innym układzie odrzucę.`}
            >
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                disabled={pending}
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="block w-full min-w-0 pt-1 text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-indigo-700 hover:file:bg-indigo-100"
              />
            </Field>
          </div>
          {error ? <Alert tone="error" className="mt-4">{error}</Alert> : null}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button onClick={submit} disabled={Boolean(blocker) || pending}>
              {pending ? "Porównuję z Subiektem…" : "Porównaj z Subiektem"}
            </Button>
            <span className="text-xs text-slate-500">
              {pending ? "Czytam ceny towarów z Subiekta — przy ~1500 towarach trwa to do minuty." : blocker ?? "Porównanie niczego nie zmienia w Subiekcie."}
            </span>
          </div>
        </Card>
      ) : null}

      <Card padding={false}>
        <div className="p-6 pb-3 sm:p-7 sm:pb-3">
          <CardHeader title="Wgrane cenniki" density="compact" />
        </div>
        {imports.length === 0 ? (
          <p className="px-6 pb-6 text-sm text-slate-500 sm:px-7">Jeszcze nie wgrano cennika. Pierwszy porównasz powyżej — zobaczysz każdą zmianę ceny, zanim cokolwiek trafi do Subiekta.</p>
        ) : (
          <TableScroll>
            <DataTable>
              <thead>
                <tr>
                  <th>Cennik</th>
                  <th>Stan</th>
                  <th>Wgrano</th>
                </tr>
              </thead>
              <tbody>
                {imports.map((imp) => (
                  <tr key={imp.id}>
                    <td>
                      <Link
                        href={`/zakupy/cenniki/${imp.id}`}
                        title={imp.fileName}
                        className="rounded font-medium text-indigo-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/45"
                      >
                        {imp.cechaName} · ważny od {formatDate(imp.validFrom)}
                      </Link>
                      <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                        <span className="whitespace-nowrap"><HostBadge isLive={imp.hostKind === "live"} /></span>
                        <span className="min-w-0 truncate">{imp.fileName}</span>
                      </div>
                    </td>
                    <td className="text-sm">
                      {currentIds.has(imp.id) ? (
                        <ImportState counts={imp.counts} />
                      ) : (
                        <span className="text-slate-500">Zastąpiony nowszym</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap">
                      {new Date(imp.createdAt).toLocaleString("pl-PL", { dateStyle: "short", timeStyle: "short" })}
                      <div className="text-xs text-slate-500">{imp.createdByName ?? ""}</div>
                      {imp.updatedAt ? (
                        <div className="text-xs text-slate-500">
                          zaktualizowano {new Date(imp.updatedAt).toLocaleString("pl-PL", { dateStyle: "short", timeStyle: "short" })} · {imp.uploadCount}×
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          </TableScroll>
        )}
      </Card>
      {host && canSwitchHost ? (
        <ConfirmDialog
          open={confirmSwitch}
          title={host.isLive ? "Przełączyć cenniki na Subiekt testowy?" : "Przełączyć cenniki na LIVE?"}
          summary={host.isLive ? "Test :5082 — produkcja bez zmian" : "LIVE :5080 — baza produkcyjna, zapis zmieni ceny widoczne dla handlowców"}
          summaryTone={host.isLive ? "neutral" : "warning"}
          danger={!host.isLive}
          message="Dotyczy wszystkich użytkowników Cenników. Podglądy przygotowane na drugim Subiekcie nie dadzą się zapisać — trzeba wgrać cennik ponownie. Ustawienie zastępuje port z SUBIEKT_API_PRICES_BASE_URL."
          confirmLabel={host.isLive ? "Przełącz na test" : "Przełącz na LIVE"}
          pending={pending}
          onCancel={() => setConfirmSwitch(false)}
          onConfirm={switchHost}
        />
      ) : null}
    </div>
  );
}

/** Słowny stan cennika: co czeka, co zapisano, co wymaga uwagi. */
function ImportState({ counts }: { counts: PriceListImport["counts"] }) {
  const problems = counts.failed + counts.mismatch + counts.changed + (counts.restore_failed ?? 0);
  const parts: React.ReactNode[] = [];
  if (counts.selectedPending) parts.push(<span key="p">{polishPlural(counts.selectedPending, "cena", "ceny", "cen")} do zapisu</span>);
  if (counts.applied) parts.push(<span key="a" className="text-emerald-800">{polishPlural(counts.applied, "cena zmieniona", "ceny zmienione", "cen zmienionych")} w Subiekcie</span>);
  if (counts.restored) parts.push(<span key="r">{polishPlural(counts.restored, "cena przywrócona", "ceny przywrócone", "cen przywróconych")}</span>);
  if (problems) parts.push(<span key="x" className="font-semibold text-red-700">{polishPlural(problems, "problem", "problemy", "problemów")}</span>);
  if (!parts.length) return <span className="text-slate-500">Nic do zapisania</span>;
  return (
    <span className="flex flex-wrap gap-x-3 tabular-nums">
      {parts.map((p, i) => (
        <span key={i} className="whitespace-nowrap">
          {p}
        </span>
      ))}
    </span>
  );
}
