"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import {
  actionExportIvoclarInventoryXlsx,
  actionExportIvoclarSelloutXlsx,
  actionFetchIvoclarInventory,
  actionFetchIvoclarSellout,
  type IvoclarReportBootstrapResult,
} from "@/app/actions/ivoclar-report";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { DataTable, TableScroll } from "@/components/ui/DataTable";
import { Field, Input } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { PanelSummaryMetric } from "@/components/ui/PanelSummaryMetric";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Spinner } from "@/components/ui/Spinner";
import { NoticeToast } from "@/components/ui/NoticeToast";
import {
  IVOCLAR_COUNTRY_SOURCE_LABELS,
  IVOCLAR_DATA_GAP_LABELS,
  IVOCLAR_INVENTORY_FILE_COLUMNS,
  IVOCLAR_INVENTORY_NOTE_LABELS,
  IVOCLAR_REPORT_COPY,
  IVOCLAR_SELLOUT_FILE_COLUMNS,
  isBlockingSelloutDataGap,
  isInventoryReviewNote,
  selloutPostalCodeForFile,
  selloutRowHasReviewGap,
  type IvoclarInventoryRow,
  type IvoclarInventorySummary,
  type IvoclarSelloutRow,
  type IvoclarSelloutSummary,
  type IvoclarFsFetchError,
} from "@/lib/orders/ivoclar-report";
import {
  toastFromActionError,
  toastFromUnknown,
  toastWarning,
  type ToastNotice,
} from "@/lib/ui/notice-copy";
import { panelTypography } from "@/lib/ui/ontime-theme";

type Tab = "sellout" | "inventory";

function formatQty(n: number): string {
  return Number.isInteger(n) ? String(n) : String(n);
}

function downloadXlsxFromBase64(filename: string, base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  const blob = new Blob([copy], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function IvoclarReportWorkbench({
  bootstrap,
}: {
  bootstrap: IvoclarReportBootstrapResult;
}) {
  const [toast, setToast] = useState<ToastNotice | null>(null);
  const week = bootstrap.ok ? bootstrap.previousWeek : { dataOd: "", dataDo: "" };
  const [dataOd, setDataOd] = useState(week.dataOd);
  const [dataDo, setDataDo] = useState(week.dataDo);
  const [tab, setTab] = useState<Tab>("sellout");
  const [query, setQuery] = useState("");
  const [onlyDataGaps, setOnlyDataGaps] = useState(false);
  const [selloutPending, startSellout] = useTransition();
  const [inventoryPending, startInventory] = useTransition();
  const [exportSelloutPending, startExportSellout] = useTransition();
  const [exportInventoryPending, startExportInventory] = useTransition();

  const [selloutRows, setSelloutRows] = useState<IvoclarSelloutRow[] | null>(null);
  const [selloutSummary, setSelloutSummary] = useState<IvoclarSelloutSummary | null>(null);
  const [fetchErrors, setFetchErrors] = useState<IvoclarFsFetchError[]>([]);
  const [selloutFilename, setSelloutFilename] = useState(
    bootstrap.ok ? bootstrap.selloutFilename : ""
  );
  const [inventoryFilename, setInventoryFilename] = useState(
    bootstrap.ok ? bootstrap.inventoryFilename : ""
  );
  const [inventoryRows, setInventoryRows] = useState<IvoclarInventoryRow[] | null>(null);
  const [inventorySummary, setInventorySummary] = useState<IvoclarInventorySummary | null>(
    null
  );

  const busy =
    selloutPending || inventoryPending || exportSelloutPending || exportInventoryPending;

  function applyPreviousWeek() {
    if (!bootstrap.ok) return;
    setDataOd(bootstrap.previousWeek.dataOd);
    setDataDo(bootstrap.previousWeek.dataDo);
  }

  function applyPreviousMonth() {
    if (!bootstrap.ok) return;
    setDataOd(bootstrap.previousMonth.dataOd);
    setDataDo(bootstrap.previousMonth.dataDo);
  }

  function loadInventory() {
    startInventory(async () => {
      try {
        const result = await actionFetchIvoclarInventory();
        if (!result.ok) {
          setToast(toastFromActionError(result.message));
          return;
        }
        setInventoryRows(result.rows);
        setInventorySummary(result.summary);
        setInventoryFilename(result.inventoryFilename);
        setTab("inventory");
      } catch (e) {
        setToast(toastFromUnknown(e, "Nie udało się pobrać stanów Ivoclar."));
      }
    });
  }

  function exportSellout() {
    if (!selloutRows) return;
    startExportSellout(async () => {
      try {
        const result = await actionExportIvoclarSelloutXlsx({
          filename: selloutFilename,
          rows: selloutRows,
        });
        if (!result.ok) {
          setToast(toastFromActionError(result.message));
          return;
        }
        downloadXlsxFromBase64(result.filename, result.base64);
        if (result.skippedCount > 0) {
          setToast(
            toastWarning(
              `Zapisano ${result.exportedCount} wierszy Sellout`,
              `Pominięto ${result.skippedCount} bez obowiązkowych pól procedury.`
            )
          );
        }
      } catch (e) {
        setToast(toastFromUnknown(e, "Nie udało się pobrać Sellout.xlsx."));
      }
    });
  }

  function exportInventory() {
    if (!inventoryRows) return;
    startExportInventory(async () => {
      try {
        const result = await actionExportIvoclarInventoryXlsx({
          filename: inventoryFilename,
          rows: inventoryRows,
        });
        if (!result.ok) {
          setToast(toastFromActionError(result.message));
          return;
        }
        downloadXlsxFromBase64(result.filename, result.base64);
        if (result.skippedCount > 0) {
          setToast(
            toastWarning(
              `Zapisano ${result.exportedCount} SKU Inventory`,
              `Pominięto ${result.skippedCount} bez Article albo ze stanem 0.`
            )
          );
        }
      } catch (e) {
        setToast(toastFromUnknown(e, "Nie udało się pobrać Inventory.xlsx."));
      }
    });
  }

  function loadSellout() {
    startSellout(async () => {
      try {
        const result = await actionFetchIvoclarSellout({ dataOd, dataDo });
        if (!result.ok) {
          setToast(toastFromActionError(result.message));
          return;
        }
        setSelloutRows(result.rows);
        setSelloutSummary(result.summary);
        setFetchErrors(result.fetchErrors);
        setSelloutFilename(result.selloutFilename);
        setInventoryFilename(result.inventoryFilename);
        setInventoryRows(result.inventoryRows);
        setInventorySummary(result.inventorySummary);
        setTab("sellout");
      } catch (e) {
        setToast(toastFromUnknown(e, "Nie udało się pobrać sprzedaży FS."));
      }
    });
  }

  const q = query.trim().toLowerCase();

  const visibleSellout = useMemo(() => {
    if (!selloutRows) return [];
    return selloutRows.filter((row) => {
      if (onlyDataGaps && !selloutRowHasReviewGap(row)) return false;
      if (!q) return true;
      const hay = [
        row.article,
        row.twSymbol,
        row.twNazwa,
        row.dokNr,
        row.khName,
        row.postalCode,
        row.suggestedCountry ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [selloutRows, onlyDataGaps, q]);

  const visibleInventory = useMemo(() => {
    if (!inventoryRows) return [];
    return inventoryRows.filter((row) => {
      if (
        onlyDataGaps &&
        !row.notes.some(isInventoryReviewNote)
      ) {
        return false;
      }
      if (!q) return true;
      const hay = [row.article, row.twSymbol, row.twNazwa, row.groupName]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [inventoryRows, onlyDataGaps, q]);

  return (
    <div className="space-y-4">
      {toast ? <NoticeToast notice={toast} onDismiss={() => setToast(null)} /> : null}

      <PageHeader
        title={IVOCLAR_REPORT_COPY.pageTitle}
        description={IVOCLAR_REPORT_COPY.pageDescription}
      />

      {!bootstrap.ok ? (
        <Alert tone="error" title="Nie udało się otworzyć narzędzia">
          {bootstrap.message}
        </Alert>
      ) : null}

      {bootstrap.ok && !bootstrap.configured ? (
        <Alert tone="warning" title="Subiekt niedostępny">
          {bootstrap.configMessage ?? "Host ORDERS nie jest skonfigurowany."}
        </Alert>
      ) : null}

      <Alert tone="info" title={IVOCLAR_REPORT_COPY.apiGapsTitle}>
        <p>{IVOCLAR_REPORT_COPY.apiGapsBody}</p>
        <p className="mt-1.5">
          {IVOCLAR_REPORT_COPY.sourceNote} {IVOCLAR_REPORT_COPY.inventoryNote}
        </p>
        <p className="mt-1.5">
          {IVOCLAR_REPORT_COPY.sendScheduleNote} {IVOCLAR_REPORT_COPY.sendToNote}{" "}
          <Link href="/admin/mail/ivoclar_weekly" className="font-medium text-indigo-700 hover:underline">
            Centrum maili (harmonogram i logi)
          </Link>
          .
        </p>
      </Alert>

      <Card>
        <CardHeader
          title="Zakres sprzedaży"
          description="Domyślnie poprzedni pełny tydzień (poniedziałek–niedziela, Warszawa)."
        />
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Od">
            <Input
              type="date"
              value={dataOd}
              onChange={(e) => setDataOd(e.target.value)}
              disabled={busy}
            />
          </Field>
          <Field label="Do">
            <Input
              type="date"
              value={dataDo}
              onChange={(e) => setDataDo(e.target.value)}
              disabled={busy}
            />
          </Field>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={applyPreviousWeek} disabled={busy}>
            Poprzedni tydzień
          </Button>
          <Button variant="secondary" size="sm" onClick={applyPreviousMonth} disabled={busy}>
            Poprzedni miesiąc
          </Button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={loadSellout} disabled={busy || (bootstrap.ok && !bootstrap.configured)}>
            {selloutPending ? <Spinner size="sm" /> : null}
            Pobierz sprzedaż FS
          </Button>
          <Button
            variant="secondary"
            onClick={loadInventory}
            disabled={busy || (bootstrap.ok && !bootstrap.configured)}
          >
            {inventoryPending ? <Spinner size="sm" /> : null}
            Pobierz stany
          </Button>
          <Button
            variant="secondary"
            onClick={exportSellout}
            disabled={busy || selloutRows == null}
          >
            {exportSelloutPending ? <Spinner size="sm" /> : null}
            Pobierz Sellout.xlsx
          </Button>
          <Button
            variant="secondary"
            onClick={exportInventory}
            disabled={busy || inventoryRows == null}
          >
            {exportInventoryPending ? <Spinner size="sm" /> : null}
            Pobierz Inventory.xlsx
          </Button>
        </div>
        {selloutPending ? (
          <p className={`mt-3 ${panelTypography.caption}`}>
            Pobieram nagłówki FS, potem pozycje Ivoclar (ok. minuty przy ~800 fakturach).
          </p>
        ) : null}
        {bootstrap.ok ? (
          <p className={`mt-3 ${panelTypography.caption}`}>
            Nazwa pliku Sellout: {selloutFilename || bootstrap.selloutFilename}.xlsx. Inventory:{" "}
            {inventoryFilename || bootstrap.inventoryFilename}.xlsx. Numer klienta{" "}
            {bootstrap.dealerNumber}.
          </p>
        ) : null}
      </Card>

      {tab === "sellout" && selloutSummary ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <PanelSummaryMetric label="FS w zakresie" value={selloutSummary.fsHeaderCount} />
          <PanelSummaryMetric label="Linie Ivoclar" value={selloutSummary.ivoclarLineCount} />
          <PanelSummaryMetric
            label="Kraj ustalony"
            value={selloutSummary.countryResolvedCount}
            tone="success"
            hint="Z formatu kodu, miasta, VAT lub telefonu"
          />
          <PanelSummaryMetric
            label="Kraj niejasny"
            value={selloutSummary.countryUnknownCount}
            tone={selloutSummary.countryUnknownCount > 0 ? "warning" : "success"}
            hint={`Bez adresu: ${selloutSummary.countryMissingAddressCount} · sprzeczność: ${selloutSummary.countryConflictCount}`}
          />
          <PanelSummaryMetric
            label="Luki w danych"
            value={selloutSummary.rowsWithBlockingDataGaps}
            tone={selloutSummary.rowsWithBlockingDataGaps > 0 ? "warning" : "success"}
            hint="Kod, Article albo sprzeczny kraj"
          />
          <PanelSummaryMetric
            label="Pominięte nie-Ivoclar"
            value={selloutSummary.skippedNonIvoclarLines}
            hint={[
              selloutSummary.skippedZeroQtyLines > 0
                ? `Ilość 0: ${selloutSummary.skippedZeroQtyLines}`
                : null,
              selloutSummary.skippedExcludedLines > 0
                ? `Zestawy: ${selloutSummary.skippedExcludedLines}`
                : null,
            ]
              .filter(Boolean)
              .join(" · ") || undefined}
          />
        </div>
      ) : null}

      {tab === "inventory" && inventorySummary ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <PanelSummaryMetric label="SKU Ivoclar" value={inventorySummary.skuCount} />
          <PanelSummaryMetric label="Stan 0" value={inventorySummary.zeroStockCount} />
          <PanelSummaryMetric label="Zablokowane" value={inventorySummary.blockedCount} />
          <PanelSummaryMetric label="Symbol z dopiskiem" value={inventorySummary.suffixCount} />
        </div>
      ) : null}

      {fetchErrors.length > 0 ? (
        <Alert tone="warning" title={`${fetchErrors.length} FS bez pozycji`}>
          Nie udało się pobrać szczegółu części faktur. Pierwsze:{" "}
          {fetchErrors
            .slice(0, 5)
            .map((e) => e.dokNr)
            .join(", ")}
          {fetchErrors.length > 5 ? "…" : ""}
        </Alert>
      ) : null}

      <Card padding={false}>
        <div className="flex flex-col gap-3 px-6 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <SegmentedControl
            ariaLabel="Widok raportu"
            value={tab}
            onChange={setTab}
            options={[
              { value: "sellout", label: "Sprzedaż FS" },
              { value: "inventory", label: "Magazyn" },
            ]}
          />
          <label className="flex items-center gap-2 text-xs text-slate-600">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300"
              checked={onlyDataGaps}
              onChange={(e) => setOnlyDataGaps(e.target.checked)}
            />
            Tylko luki danych
            {tab === "inventory" ? " (bez stanu 0)" : ""}
          </label>
        </div>
        <div className="px-6 pt-3 pb-2">
          <Input
            type="search"
            placeholder="Szukaj: Article, FS, kontrahent, kod…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {tab === "sellout" ? (
          selloutRows == null ? (
            <p className={`px-6 pb-6 ${panelTypography.sectionDesc}`}>
              Kliknij „Pobierz sprzedaż FS”, żeby zobaczyć linie Ivoclar z faktur.
            </p>
          ) : visibleSellout.length === 0 ? (
            <p className={`px-6 pb-6 ${panelTypography.sectionDesc}`}>
              Brak wierszy sprzedaży w tym filtrze.
            </p>
          ) : (
            <>
              <p className={`px-6 pb-2 ${panelTypography.caption}`}>
                {IVOCLAR_REPORT_COPY.selloutColumnsNote} Dalej: Data, FS, Kontrahent, Luki
                (tylko podgląd).
              </p>
              <TableScroll>
                <DataTable className="queue-table">
                  <thead>
                    <tr>
                      {IVOCLAR_SELLOUT_FILE_COLUMNS.map((label) => (
                        <th
                          key={label}
                          className={label === "Quantity" ? "text-right" : undefined}
                        >
                          {label}
                        </th>
                      ))}
                      <th>Data</th>
                      <th>FS</th>
                      <th>Kontrahent</th>
                      <th>Luki</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleSellout.map((row, i) => {
                      const postalForFile = selloutPostalCodeForFile(row);
                      return (
                      <tr key={`${row.dokId}-${row.twId}-${i}`}>
                        <td className="whitespace-nowrap">
                          <span className="font-semibold tabular-nums">
                            {row.suggestedCountry ?? "—"}
                          </span>
                          {row.countrySource ? (
                            <span className="mt-0.5 block text-[11px] font-normal text-slate-500">
                              {IVOCLAR_COUNTRY_SOURCE_LABELS[row.countrySource]}
                              {row.countryConfidence === "low" ? " · słabe" : ""}
                            </span>
                          ) : null}
                          {row.countryConflict.length > 0 ? (
                            <span className="mt-0.5 block text-[11px] text-amber-800">
                              {row.countryConflict.join(" / ")}
                            </span>
                          ) : null}
                        </td>
                        <td className="font-medium tabular-nums">
                          {row.article || "—"}
                          {row.twSymbol && row.twSymbol !== row.article ? (
                            <span className="mt-0.5 block text-[11px] font-normal text-slate-500">
                              {row.twSymbol}
                            </span>
                          ) : null}
                        </td>
                        <td className="text-right tabular-nums">{formatQty(row.quantity)}</td>
                        <td className="whitespace-nowrap tabular-nums">
                          {postalForFile || "—"}
                          {row.postalCode &&
                          postalForFile &&
                          row.postalCode !== postalForFile ? (
                            <span className="mt-0.5 block text-[11px] text-slate-500">
                              w Subiekcie: {row.postalCode}
                            </span>
                          ) : null}
                        </td>
                        <td className="whitespace-nowrap">{row.endUser}</td>
                        <td>{row.subDealerName || "—"}</td>
                        <td className="whitespace-nowrap tabular-nums">
                          {row.dokDataWyst ?? "—"}
                        </td>
                        <td className="whitespace-nowrap">{row.dokNr}</td>
                        <td>{row.khName}</td>
                        <td>
                          <div className="flex flex-wrap gap-1">
                            {row.dataGaps.map((code) => (
                              <Badge
                                key={code}
                                variant={isBlockingSelloutDataGap(code) ? "warning" : "default"}
                              >
                                {IVOCLAR_DATA_GAP_LABELS[code]}
                              </Badge>
                            ))}
                          </div>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </DataTable>
              </TableScroll>
            </>
          )
        ) : inventoryRows == null ? (
          <p className={`px-6 pb-6 ${panelTypography.sectionDesc}`}>
            Kliknij „Pobierz stany”, żeby zobaczyć katalog cechy Ivoclar.
          </p>
        ) : visibleInventory.length === 0 ? (
          <p className={`px-6 pb-6 ${panelTypography.sectionDesc}`}>
            Brak SKU w tym filtrze.
          </p>
        ) : (
          <>
            <p className={`px-6 pb-2 ${panelTypography.caption}`}>
              {IVOCLAR_REPORT_COPY.inventoryColumnsNote} Dalej: Symbol, Nazwa, Grupa, Rez.,
              Uwagi (tylko podgląd).
            </p>
            <TableScroll>
              <DataTable className="queue-table">
                <thead>
                  <tr>
                    {IVOCLAR_INVENTORY_FILE_COLUMNS.map((label) => (
                      <th
                        key={label}
                        className={label === "Balance" ? "text-right" : undefined}
                      >
                        {label}
                      </th>
                    ))}
                    <th>Symbol</th>
                    <th>Nazwa</th>
                    <th>Grupa</th>
                    <th className="text-right">Rez.</th>
                    <th>Uwagi</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleInventory.map((row) => (
                    <tr key={row.twId}>
                      <td className="font-medium tabular-nums">{row.article || "—"}</td>
                      <td className="text-right tabular-nums">{formatQty(row.balance)}</td>
                      <td className="whitespace-nowrap">{row.twSymbol || "—"}</td>
                      <td>{row.twNazwa || "—"}</td>
                      <td>{row.groupName || "—"}</td>
                      <td className="text-right tabular-nums">{formatQty(row.reserved)}</td>
                      <td>
                        <div className="flex flex-wrap gap-1">
                          {row.notes.map((code) => (
                            <Badge
                              key={code}
                              variant={code === "empty_article" ? "warning" : "default"}
                            >
                              {IVOCLAR_INVENTORY_NOTE_LABELS[code]}
                            </Badge>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            </TableScroll>
          </>
        )}
      </Card>

      <p className={panelTypography.caption}>
        {IVOCLAR_REPORT_COPY.apiGapsBody}
      </p>
    </div>
  );
}
