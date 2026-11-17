"use client";

import { useState, useTransition } from "react";
import { actionDisconnectMikranHelpdesk, actionTestMikranHelpdesk, type MikranHelpdeskActionResult } from "@/app/actions/mikran-helpdesk";
import { AdminMetrics } from "@/components/admin/AdminMetrics";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button, buttonClass } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { askConfirm } from "@/components/ui/ConfirmHost";
import { Spinner } from "@/components/ui/Spinner";
import { formatWarsawDateTime } from "@/lib/time/warsaw";

export type MikranHelpdeskPanelProps = {
  connection: { connectedAt: string; connectedByEmail: string | null; scope: string } | null;
  /** Sekret klienta w env — serwer bierze token sam (client_credentials), logowanie nie jest potrzebne. */
  secretMode: boolean;
  /** Klucz szyfrowania tokenów na serwerze — bez niego połączenia nie da się zapisać. */
  canStore: boolean;
};

/** Połączenie z helpdeskiem mikran.pl: logowanie administratora na mikran.pl (login, hasło, Authenticator) → tokeny w OnTime. */
export function MikranHelpdeskPanel({ connection, secretMode, canStore }: MikranHelpdeskPanelProps) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<MikranHelpdeskActionResult | null>(null);
  const connected = Boolean(connection) || secretMode;
  // Po nieudanym sprawdzeniu plakietka nie może dalej mówić „Połączony”.
  const expired = Boolean(result && !result.ok && result.reconnect);
  const badge = expired ? "Wymaga ponownego połączenia" : connected ? "Połączony" : "Niepołączony";

  const run = (fn: () => Promise<MikranHelpdeskActionResult>) => {
    setResult(null);
    start(async () => setResult(await fn()));
  };

  const disconnect = async () => {
    const ok = await askConfirm({
      title: "Odłączyć helpdesk mikran.pl?",
      message: "Panel serwisu przestanie pobierać zgłoszenia, dopóki serwisant albo administrator nie połączy go ponownie.",
      confirmLabel: "Odłącz",
      danger: true,
    });
    if (ok) run(actionDisconnectMikranHelpdesk);
  };

  return (
    <section id="helpdesk-mikran" className="scroll-mt-20">
      <Card padding={false} className="overflow-hidden">
        <CardHeader
          inset
          density="compact"
          title="Helpdesk mikran.pl"
          description="Zgłoszenia serwisowe ze sklepu w panelu serwisu — połączenie logowaniem na mikran.pl (serwisant w swoim panelu albo administrator tutaj)."
          action={<Badge variant={connected && !expired ? "success" : "warning"}>{badge}</Badge>}
        />
        <div className="space-y-4 px-3 py-4 sm:px-4 lg:px-5">
          {secretMode ? (
            <p className="text-sm text-slate-600">Serwer używa sekretu klienta z ustawień (MIKRAN_API_CLIENT_SECRET) — logowanie nie jest potrzebne.</p>
          ) : connection ? (
            <AdminMetrics
              items={[
                { label: "Połączył", value: connection.connectedByEmail?.split("@")[0] ?? "—", hint: connection.connectedByEmail ?? "konto usunięte" },
                { label: "Od", value: formatWarsawDateTime(connection.connectedAt) },
                { label: "Zakres", value: connection.scope.includes("helpdesk:write") ? "Odczyt i zapis" : "Odczyt", hint: connection.scope },
              ]}
            />
          ) : (
            <p className="text-sm text-slate-600">
              Zwykle łączy serwisant, swoim kontem mikran.pl, w panelu serwisu. Stąd połączysz własnym kontem (login, hasło, kod z
              Authenticatora). Wpisy, które OnTime doda w helpdesku, będą przypisane do konta, które połączyło.
            </p>
          )}

          {!canStore && !secretMode ? (
            <Alert tone="warning" title="Połączenia nie da się zapisać">
              Na serwerze OnTime brakuje klucza szyfrowania tokenów (GOOGLE_OAUTH_TOKEN_KEY, 32 bajty base64). Dodaj go w ustawieniach serwera i uruchom aplikację ponownie.
            </Alert>
          ) : null}

          {result ? (
            <Alert tone={result.ok ? "success" : "warning"}>
              <span className="text-sm">{result.message}</span>
            </Alert>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {!secretMode && canStore ? (
              // Zwykły link (nie fetch): przeglądarka musi przejść na mikran.pl i z powrotem.
              <a href="/api/mcp/connect" className={buttonClass(connection ? "secondary" : "primary", "sm")}>
                {connection ? "Połącz ponownie" : "Połącz z helpdeskiem"}
              </a>
            ) : null}
            {connected ? (
              <Button variant="secondary" size="sm" disabled={pending} onClick={() => run(actionTestMikranHelpdesk)}>
                {pending ? (
                  <>
                    <Spinner size="sm" />
                    Sprawdzam…
                  </>
                ) : (
                  "Sprawdź połączenie"
                )}
              </Button>
            ) : null}
            {connection ? (
              <Button variant="secondary" size="sm" disabled={pending} onClick={disconnect} className="text-red-700 hover:text-red-800">
                Odłącz
              </Button>
            ) : null}
          </div>
        </div>
      </Card>
    </section>
  );
}
