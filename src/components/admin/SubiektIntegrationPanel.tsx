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
          setTestSuccessDetail(
            result.message ?? "Połączenie działa."
          );
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

  return (
    <Card padding={false} className="overflow-hidden">
      <CardHeader
        inset
        density="compact"
        title="Integracja Subiekt"
        description="REST API v1 w sieci LAN (odczyt). Komunikaty błędów: src/lib/subiekt/feedback.ts"
        action={
          <Badge variant={configured ? "success" : "warning"}>
            {configured ? "Skonfigurowane" : "Brak konfiguracji"}
          </Badge>
        }
      />
      <div className="space-y-4 px-3 pb-4 sm:px-4 lg:px-5">
        {configured ? (
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">Adres API</dt>
              <dd className="font-mono text-xs text-slate-900">{baseUrl}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Uwierzytelnianie</dt>
              <dd className="text-slate-900">
                {authMode ? AUTH_LABELS[authMode] : "—"}
              </dd>
            </div>
          </dl>
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
          <div className="space-y-4 border-t border-slate-200 pt-4">
            <p className="text-sm font-medium text-slate-800">Szybki test odczytu (LAN)</p>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1">
                <label className="mb-1 block text-xs text-slate-500" htmlFor="subiekt-product-q">
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
                <label className="mb-1 block text-xs text-slate-500" htmlFor="subiekt-supplier-q">
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

            {productResults && productResults.length > 0 ? (
              <ul className="list-inside list-disc text-sm text-slate-700">
                {productResults.map((p) => (
                  <li key={p.tw_Id}>{formatProduct(p)}</li>
                ))}
              </ul>
            ) : null}

            {supplierResults && supplierResults.length > 0 ? (
              <ul className="list-inside list-disc text-sm text-slate-700">
                {supplierResults.map((k) => (
                  <li key={k.kh_Id}>{formatSupplier(k)}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        <p className="text-xs leading-relaxed text-slate-500">
          Słownik komunikatów:{" "}
          <code className="rounded bg-slate-100 px-1">src/lib/subiekt/feedback.ts</code>
        </p>
      </div>
    </Card>
  );
}
