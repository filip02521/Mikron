"use client";

import { useState, useTransition } from "react";
import {
  actionGetSubiektStatus,
  actionTestSubiektConnection,
} from "@/app/actions/subiekt";
import type { SubiektAuthMode } from "@/lib/subiekt/config";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Alert } from "@/components/ui/Alert";
import { Spinner } from "@/components/ui/Spinner";

const AUTH_LABELS: Record<SubiektAuthMode, string> = {
  bearer: "Bearer (klucz API)",
  basic: "Basic (login + hasło)",
  "api-key-header": "Nagłówek API Key",
  none: "Bez uwierzytelniania",
};

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
  const [testMessage, setTestMessage] = useState<string | null>(null);
  const [testOk, setTestOk] = useState<boolean | null>(null);

  const runTest = () => {
    setTestMessage(null);
    setTestOk(null);
    start(async () => {
      try {
        const summary = await actionGetSubiektStatus();
        setConfigured(summary.configured);
        setBaseUrl(summary.baseUrl);
        setAuthMode(summary.authMode);

        const result = await actionTestSubiektConnection();
        setTestOk(result.ok);
        setTestMessage(
          result.message ??
            (result.ok ? "Połączenie działa." : "Nie udało się połączyć z API.")
        );
      } catch (e) {
        setTestOk(false);
        setTestMessage(e instanceof Error ? e.message : "Błąd testu połączenia");
      }
    });
  };

  return (
    <Card className="mb-6">
      <CardHeader
        title="Integracja Subiekt"
        description="Połączenie z API Subiekta (mostek REST lub usługa pośrednia). Sekrety tylko w .env.local — nie w repozytorium."
        action={
          <Badge variant={configured ? "success" : "warning"}>
            {configured ? "Skonfigurowane" : "Brak konfiguracji"}
          </Badge>
        }
      />
      <div className="space-y-4">
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
          <Alert tone="warning">
            <p className="font-medium">Uzupełnij zmienne środowiskowe</p>
            <p className="mt-1 text-sm opacity-90">
              Skopiuj wpisy z <code className="rounded bg-amber-100/80 px-1">.env.example</code> do{" "}
              <code className="rounded bg-amber-100/80 px-1">.env.local</code> i podaj adres API od
              dostawcy integracji / mostka Subiekt.
            </p>
          </Alert>
        )}

        {testMessage ? (
          <Alert tone={testOk ? "success" : "error"}>
            <span className="text-sm">{testMessage}</span>
          </Alert>
        ) : null}

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

        <p className="text-xs leading-relaxed text-slate-500">
          Po udanym teście możemy dodać synchronizację stanów magazynowych, kartoteki towarów lub
          dokumentów ZK — zależnie od tego, co udostępnia Twoje API. Szczegóły:{" "}
          <code className="rounded bg-slate-100 px-1">docs/integrations/subiekt.md</code>
        </p>
      </div>
    </Card>
  );
}
