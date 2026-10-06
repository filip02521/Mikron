"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  actionPreparePriceList,
  actionSearchPriceCechy,
  type PriceCechaOption,
} from "@/app/actions/price-lists";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { DataTable, TableScroll } from "@/components/ui/DataTable";
import { Field, Input, Select } from "@/components/ui/Field";
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
}: {
  imports: PriceListImport[];
  host: { label: string; isLive: boolean } | null;
  hostError: string | null;
}) {
  const router = useRouter();
  // Cenniki tego samego dostawcy wracają — podstawiamy ostatnio użytą cechę.
  const last = imports[0];
  const [search, setSearch] = useState(last?.cechaName ?? "");
  const [cechy, setCechy] = useState<PriceCechaOption[]>(last ? [{ id: last.cechaId, name: last.cechaName }] : []);
  const [cechaId, setCechaId] = useState(last ? String(last.cechaId) : "");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!host || search.trim().length < 2 || search === last?.cechaName) return;
    const t = setTimeout(async () => {
      const res = await actionSearchPriceCechy(search).catch(() => null);
      if (!res || !res.ok) {
        setError(res?.error ?? "Nie udało się pobrać cech z Subiekta.");
        return;
      }
      setError(null);
      setCechy(res.cechy);
      const exact = res.cechy.find((c) => c.name.toLowerCase() === search.trim().toLowerCase());
      setCechaId(String((exact ?? res.cechy[0])?.id ?? ""));
    }, 300);
    return () => clearTimeout(t);
  }, [search, host, last?.cechaName]);

  const cecha = cechy.find((c) => String(c.id) === cechaId);
  const blocker = !cecha ? "Wybierz cechę dostawcy." : !file ? "Wybierz plik cennika." : null;

  function submit() {
    if (!cecha || !file) return;
    setError(null);
    const fd = new FormData();
    fd.set("file", file);
    fd.set("cechaId", String(cecha.id));
    fd.set("cechaName", cecha.name);
    startTransition(async () => {
      const res = await actionPreparePriceList(fd).catch(() => null);
      if (!res || !res.ok) {
        setError(res?.error ?? "Brak połączenia z serwerem (sesja mogła wygasnąć). Odśwież stronę i spróbuj ponownie.");
        return;
      }
      router.push(`/zakupy/cenniki/${res.id}`);
    });
  }

  return (
    <div className="space-y-4">
      {hostError ? <Alert tone="warning" title="Brak hosta cen Subiekta">{hostError}</Alert> : null}
      {host ? (
        <Card>
          <CardHeader
            title="Nowy cennik"
            description="Wybierz cechę dostawcy i wgraj cennik. Porównam ceny tylko dla towarów z tej cechy — w Subiekcie nic się nie zmieni, dopóki nie zatwierdzisz zapisu."
            action={<HostBadge isLive={host.isLive} />}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Cecha dostawcy w Subiekcie"
              hint={cecha ? `Porównam tylko towary z cechą „${cecha.name}”.` : "Wpisz min. 2 litery, np. Ivoclar."}
            >
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Szukaj cechy…"
                  aria-label="Szukaj cechy"
                  disabled={pending}
                  className="flex-1"
                />
                <Select
                  value={cechaId}
                  onChange={(e) => setCechaId(e.target.value)}
                  disabled={pending || cechy.length === 0}
                  aria-label="Wybrana cecha"
                  className="flex-1"
                >
                  {cechy.length === 0 ? <option value="">-</option> : null}
                  {cechy.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </div>
            </Field>
            <Field
              label="Plik cennika – Excel lub CSV"
              hint="Kolumny rozpoznam po nagłówkach: numer katalogowy, cena zakupu (dealer) netto, cena detaliczna netto, upust % (nasza marża), VAT."
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
                  <th>Wgrano</th>
                  <th>Stan</th>
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
                    <td className="whitespace-nowrap">
                      {new Date(imp.createdAt).toLocaleString("pl-PL", { dateStyle: "short", timeStyle: "short" })}
                      <div className="text-xs text-slate-500">{imp.createdByName ?? ""}</div>
                    </td>
                    <td className="text-sm">
                      <ImportState counts={imp.counts} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          </TableScroll>
        )}
      </Card>
    </div>
  );
}

/** Słowny stan cennika: co czeka, co zapisano, co wymaga uwagi. */
function ImportState({ counts }: { counts: PriceListImport["counts"] }) {
  const problems = counts.failed + counts.mismatch + counts.changed;
  const parts: React.ReactNode[] = [];
  if (counts.selectedPending) parts.push(<span key="p">{polishPlural(counts.selectedPending, "cena", "ceny", "cen")} do zapisu</span>);
  if (counts.applied) parts.push(<span key="a" className="text-emerald-800">{counts.applied} zapisanych</span>);
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
