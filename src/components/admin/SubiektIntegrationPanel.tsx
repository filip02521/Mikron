"use client";

import { useState, useTransition } from "react";
import {
  actionGetSubiektStatus,
  actionSubiektLookupProduct,
  actionSubiektLookupSupplier,
  actionTestSubiektConnection,
} from "@/app/actions/subiekt";
import type { SubiektAuthMode } from "@/lib/subiekt/config";
import type { SubiektFeedback } from "@/lib/subiekt/feedback";
import { getSubiektFeedback } from "@/lib/subiekt/feedback";
import type { SubiektKontrahent, SubiektProduct } from "@/lib/subiekt/types";
import { SubiektFeedbackAlert } from "@/components/subiekt/SubiektFeedbackAlert";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Alert } from "@/components/ui/Alert";
import { Spinner } from "@/components/ui/Spinner";
import { Input } from "@/components/ui/Field";
import { HelpBlock } from "@/components/ui/HelpBlock";
import { HelpPopover } from "@/components/ui/HelpPopover";
import { PanelSummaryMetric } from "@/components/ui/PanelSummaryMetric";
import { cn } from "@/lib/cn";
import { panelTypography } from "@/lib/ui/ontime-theme";

const AUTH_LABELS: Record<SubiektAuthMode, string> = {
  bearer: "Bearer (klucz API)",
  basic: "Basic (login + hasło)",
  "api-key-header": "Nagłówek API Key",
  none: "Bez uwierzytelniania",
};

function formatProduct(p: SubiektProduct): string {
  const sym = p.tw_Symbol ?? "—";
  const name = p.tw_Nazwa ?? "";
  return `${sym}${name ? ` — ${name}` : ""}`;
}

function formatSupplier(k: SubiektKontrahent): string {
  const sym = k.kh_Symbol ?? "—";
  const name = k.adr_NazwaPelna ?? k.adr_Nazwa ?? "";
  return `${sym}${name ? ` — ${name}` : ""}`;
}

function LookupResults({
  title,
  items,
}: {
  title: string;
  items: { id: number; label: string }[];
}) {
  if (!items.length) return null;

  return (
    <div className="overflow-hidden rounded-md border border-slate-200/90 bg-white">
      <p className="border-b border-slate-100 bg-slate-50/80 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </p>
      <ul className="divide-y divide-slate-100">
        {items.map((item) => (
          <li key={item.id} className="px-3 py-2 text-sm text-slate-800">
            {item.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

function shortApiHost(url: string | null): string {
  if (!url) return "—";
  try {
    return new URL(url).host;
  } catch {
    return url.length > 36 ? `${url.slice(0, 33)}…` : url;
  }
}

export function SubiektIntegrationPanel({
  initialConfigured,
  initialBaseUrl,
  initialAuthMode,
}: {
  initialConfigured: boolean;
  initialBaseUrl: string | null;
  initialAuthMode: SubiektAuthMode | null;
}) {
  const [pending, start] = useTransition();
  const [configured, setConfigured] = useState(initialConfigured);
  const [baseUrl, setBaseUrl] = useState(initialBaseUrl);
  const [authMode, setAuthMode] = useState(initialAuthMode);
  const [testFeedback, setTestFeedback] = useState<SubiektFeedback | null>(null);
  const [testOk, setTestOk] = useState<boolean | null>(null);
  const [testSuccessDetail, setTestSuccessDetail] = useState<string | null>(null);

  const [productQuery, setProductQuery] = useState("");
  const [supplierQuery, setSupplierQuery] = useState("");
  const [productResults, setProductResults] = useState<SubiektProduct[] | null>(null);
  const [supplierResults, setSupplierResults] = useState<SubiektKontrahent[] | null>(null);
  const [lookupFeedback, setLookupFeedback] = useState<SubiektFeedback | null>(null);

  const runTest = () => {
    setTestFeedback(null);
    setTestOk(null);
    setTestSuccessDetail(null);
    start(async () => {
      try {
        const summary = await actionGetSubiektStatus();
        setConfigured(summary.configured);
        setBaseUrl(summary.baseUrl);
        setAuthMode(summary.authMode);

        const result = await actionTestSubiektConnection();
        setTestOk(result.ok);
        if (result.ok && !result.feedback) {
          setTestSuccessDetail(result.message ?? "Połączenie działa.");
          setTestFeedback(null);
        } else if (result.feedback) {
          setTestFeedback(result.feedback);
          setTestSuccessDetail(result.ok ? result.message ?? null : null);
        } else if (!result.ok) {
          setTestFeedback(
            getSubiektFeedback("network", { message: result.message ?? "Błąd połączenia." })
          );
        }
      } catch (e) {
        setTestOk(false);
        setTestFeedback(
          getSubiektFeedback("unknown", {
            message: e instanceof Error ? e.message : "Błąd testu połączenia",
          })
        );
      }
    });
  };

  const runProductLookup = () => {
    setLookupFeedback(null);
    setProductResults(null);
    start(async () => {
      const res = await actionSubiektLookupProduct(productQuery);
      if (!res.ok) {
        setLookupFeedback(res.feedback);
        return;
      }
      setProductResults(res.items);
      setLookupFeedback(res.feedback ?? null);
    });
  };

  const runSupplierLookup = () => {
    setLookupFeedback(null);
    setSupplierResults(null);
    start(async () => {
      const res = await actionSubiektLookupSupplier(supplierQuery);
      if (!res.ok) {
        setLookupFeedback(res.feedback);
        return;
      }
      setSupplierResults(res.items);
      setLookupFeedback(res.feedback ?? null);
    });
  };

  const productItems =
    productResults?.map((p) => ({ id: p.tw_Id, label: formatProduct(p) })) ?? [];
  const supplierItems =
    supplierResults?.map((k) => ({ id: k.kh_Id, label: formatSupplier(k) })) ?? [];

  return (
    <Card padding={false} className="overflow-hidden">
      <CardHeader
        inset
        density="compact"
        title="Integracja Subiekt"
        description="REST API v1 w sieci LAN — odczyt towarów, dostawców i ZD dla katalogu."
        action={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <HelpPopover
              label="Pomoc — integracja Subiekt"
              title="Subiekt GT — REST API"
              shortLabel="Pomoc"
            >
              <HelpBlock title="Konfiguracja">
                <p>
                  Adres API i uwierzytelnianie ustawiasz w zmiennych środowiskowych serwera. System
                  łączy się tylko odczytem — zapis realizacji odbywa się w panelu OnTime.
                </p>
              </HelpBlock>
              <HelpBlock title="Test odczytu">
                <p>
                  Po udanym teście połączenia możesz wyszukać towar lub dostawcę — to szybka
                  diagnostyka sieci LAN, nie pełny import katalogu.
                </p>
              </HelpBlock>
            </HelpPopover>
            <Badge variant={configured ? "success" : "warning"}>
              {configured ? "Skonfigurowane" : "Brak konfiguracji"}
            </Badge>
          </div>
        }
      />
      <div className="space-y-4 px-3 pb-4 sm:px-4 lg:px-5">
        {configured ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <PanelSummaryMetric
              label="Adres API"
              value={shortApiHost(baseUrl)}
              hint={baseUrl ?? "—"}
            />
            <PanelSummaryMetric
              label="Uwierzytelnianie"
              value={authMode ? AUTH_LABELS[authMode].split("(")[0].trim() : "—"}
              hint={authMode ? AUTH_LABELS[authMode] : "Nie ustawiono"}
              tone={authMode ? "success" : "warning"}
            />
          </div>
        ) : (
          <SubiektFeedbackAlert feedback={getSubiektFeedback("not_configured")} />
        )}

        {testOk && testSuccessDetail && !testFeedback ? (
          <Alert tone="success">
            <span className="text-sm">{testSuccessDetail}</span>
          </Alert>
        ) : null}
        {testFeedback ? <SubiektFeedbackAlert feedback={testFeedback} /> : null}

        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" disabled={pending} onClick={runTest}>
            {pending ? (
              <>
                <Spinner size="sm" />
                Testuję połączenie…
              </>
            ) : (
              "Test połączenia"
            )}
          </Button>
        </div>

        {configured ? (
          <div className="space-y-4 rounded-md border border-slate-200/90 bg-slate-50/30 p-3 sm:p-4">
            <div>
              <p className={panelTypography.sectionLabel}>Szybki test odczytu</p>
              <p className={cn(panelTypography.sectionDesc, "mt-1")}>
                Wyszukiwanie po symbolu, nazwie lub NIP — wyniki z API Subiekta w LAN.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1">
                <label
                  className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500"
                  htmlFor="subiekt-product-q"
                >
                  Symbol / towar
                </label>
                <Input
                  id="subiekt-product-q"
                  value={productQuery}
                  onChange={(e) => setProductQuery(e.target.value)}
                  placeholder="np. ABC-123"
                  disabled={pending}
                />
              </div>
              <Button
                variant="secondary"
                size="sm"
                disabled={pending || !productQuery.trim()}
                onClick={runProductLookup}
              >
                Szukaj towaru
              </Button>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1">
                <label
                  className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500"
                  htmlFor="subiekt-supplier-q"
                >
                  Dostawca
                </label>
                <Input
                  id="subiekt-supplier-q"
                  value={supplierQuery}
                  onChange={(e) => setSupplierQuery(e.target.value)}
                  placeholder="symbol, nazwa lub NIP"
                  disabled={pending}
                />
              </div>
              <Button
                variant="secondary"
                size="sm"
                disabled={pending || !supplierQuery.trim()}
                onClick={runSupplierLookup}
              >
                Szukaj dostawcy
              </Button>
            </div>

            {lookupFeedback ? <SubiektFeedbackAlert feedback={lookupFeedback} /> : null}

            {productItems.length > 0 ? (
              <LookupResults title="Towary" items={productItems} />
            ) : null}

            {supplierItems.length > 0 ? (
              <LookupResults title="Dostawcy" items={supplierItems} />
            ) : null}
          </div>
        ) : null}
      </div>
    </Card>
  );
}
