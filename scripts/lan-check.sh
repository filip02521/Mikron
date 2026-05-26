#!/usr/bin/env bash
# Szybka diagnostyka dostępu LAN — uruchom na Macu z działającym npm run dev
set -euo pipefail

IP="${1:-$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true)}"
PORT=3000

echo "=== LAN — system dostaw ==="
echo ""
if [[ -z "${IP}" ]]; then
  echo "Nie wykryto IP Wi‑Fi (en0/en1). Podaj ręcznie: npm run lan-check -- 192.168.x.x"
  exit 1
fi

echo "Adres tego Maca:     ${IP}"
echo "URL dla innych PC:   http://${IP}:${PORT}"
echo "Logowanie:           http://${IP}:${PORT}/login"
echo ""

if lsof -iTCP:"${PORT}" -sTCP:LISTEN -nP >/dev/null 2>&1; then
  echo "Port ${PORT}:         NASŁUCHUJE (OK)"
  lsof -iTCP:"${PORT}" -sTCP:LISTEN -nP | tail -1
else
  echo "Port ${PORT}:         NIE DZIAŁA — uruchom: npm run dev"
  exit 1
fi

echo ""
HTTP=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 3 "http://${IP}:${PORT}/" || echo "fail")
echo "Test HTTP z Maca:    ${HTTP} (oczekiwane 200/307/308)"

ENV_URL=""
if [[ -f .env.local ]]; then
  ENV_URL=$(grep '^NEXT_PUBLIC_APP_URL=' .env.local | cut -d= -f2- | tr -d '"' || true)
fi
echo ""
if [[ "${ENV_URL}" == "http://${IP}:${PORT}" ]]; then
  echo ".env.local URL:      OK (${ENV_URL})"
else
  echo ".env.local URL:      SPRAWDŹ — masz: ${ENV_URL:-brak}"
  echo "                     powinno być: http://${IP}:${PORT}"
  echo "                     potem: zrestartuj npm run dev"
fi

echo ""
echo "Na DRUGIM komputerze (ta sama sieci Wi‑Fi):"
echo "  1. ping ${IP}"
echo "  2. przeglądarka: http://${IP}:${PORT}  (http, nie https, z :3000)"
echo ""
echo "Jeśli ping nie przechodzi — izolacja Wi‑Fi / inna podsieć (np. gość), nie błąd aplikacji."
echo "Supabase → Authentication → Redirect URLs: http://${IP}:${PORT}/**"
