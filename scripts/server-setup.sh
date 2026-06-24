#!/usr/bin/env bash
# Konfiguracja serwera produkcyjnego / LAN dla OnTime (system-dostaw-web).
#
# Uruchom w katalogu projektu (po sklonowaniu / skopiowaniu kodu):
#   bash scripts/server-setup.sh
#   npm run server-setup
#
# Opcje:
#   --help              ta pomoc
#   --non-interactive   bez pytań (wymaga zmiennych SETUP_* — patrz --help)
#   --from-env FILE     bazuj na istniejącym pliku (.env.work, backup itd.)
#   --port N            port aplikacji (domyślnie 3000)
#   --app-url URL       wymusza NEXT_PUBLIC_APP_URL (np. https://ontime.firma.pl)
#   --skip-install      pomiń npm install
#   --skip-build        pomiń npm run build
#   --systemd           wygeneruj unit systemd (wymaga sudo do instalacji)
#   --cron              wygeneruj wpisy crona (/etc/cron.d/system-dostaw)
#   --force-env         nadpisz istniejący .env.local (backup i tak powstaje)
#
# Zmienne dla --non-interactive (albo ustaw w środowisku przed uruchomieniem):
#   SETUP_SUPABASE_URL, SETUP_SUPABASE_ANON_KEY, SETUP_SUPABASE_SERVICE_ROLE_KEY
#   SETUP_RESEND_API_KEY (opcjonalnie)
#   SETUP_EMAIL_FROM (opcjonalnie)
#   SETUP_APP_URL (opcjonalnie — inaczej wykryty IP:PORT)
#   SETUP_SUBIEKT_BASE_URL (opcjonalnie)
#   SETUP_CRON_SECRET (opcjonalnie — inaczej losowy)
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PORT=3000
NON_INTERACTIVE=false
FROM_ENV=""
APP_URL=""
SKIP_INSTALL=false
SKIP_BUILD=false
INSTALL_SYSTEMD=false
INSTALL_CRON=false
FORCE_ENV=false

log() { printf '%s\n' "$*"; }
warn() { printf '⚠ %s\n' "$*" >&2; }
die() { printf '✗ %s\n' "$*" >&2; exit 1; }

usage() {
  sed -n '2,28p' "$0" | sed 's/^# \?//'
  exit 0
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --help|-h) usage ;;
    --non-interactive) NON_INTERACTIVE=true; shift ;;
    --from-env) FROM_ENV="${2:-}"; shift 2 ;;
    --port) PORT="${2:-}"; shift 2 ;;
    --app-url) APP_URL="${2:-}"; shift 2 ;;
    --skip-install) SKIP_INSTALL=true; shift ;;
    --skip-build) SKIP_BUILD=true; shift ;;
    --systemd) INSTALL_SYSTEMD=true; shift ;;
    --cron) INSTALL_CRON=true; shift ;;
    --force-env) FORCE_ENV=true; shift ;;
    *) die "Nieznana opcja: $1 (użyj --help)" ;;
  esac
done

prompt() {
  local label="$1"
  local default="${2:-}"
  local var
  if $NON_INTERACTIVE; then
    echo "$default"
    return
  fi
  if [[ -n "$default" ]]; then
    read -r -p "${label} [${default}]: " var
    echo "${var:-$default}"
  else
    read -r -p "${label}: " var
    echo "$var"
  fi
}

prompt_secret() {
  local label="$1"
  local default="${2:-}"
  local var
  if $NON_INTERACTIVE; then
    echo "$default"
    return
  fi
  if [[ -n "$default" ]]; then
    read -r -s -p "${label} [****]: " var
    printf '\n' >&2
    echo "${var:-$default}"
  else
    read -r -s -p "${label}: " var
    printf '\n' >&2
    echo "$var"
  fi
}

detect_lan_ip() {
  if command -v ip >/dev/null 2>&1; then
    ip -4 route get 1.1.1.1 2>/dev/null | awk '{for(i=1;i<=NF;i++) if($i=="src") print $(i+1); exit}' || true
    return
  fi
  if command -v hostname >/dev/null 2>&1; then
    hostname -I 2>/dev/null | awk '{print $1}' || true
    return
  fi
  if command -v ipconfig >/dev/null 2>&1; then
    ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true
  fi
}

generate_cron_secret() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex 24
  else
    head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n'
  fi
}

load_env_file() {
  local file="$1"
  [[ -f "$file" ]] || return 1
  # shellcheck disable=SC1090
  set -a
  source <(grep -E '^[A-Za-z_][A-Za-z0-9_]*=' "$file" | sed 's/\r$//')
  set +a
}

mask_secret() {
  local v="$1"
  local n=${#v}
  if [[ $n -le 8 ]]; then
    echo "****"
  else
    echo "${v:0:4}…${v: -4}"
  fi
}

write_env_local() {
  local dest="$ROOT/.env.local"
  if [[ -f "$dest" ]] && ! $FORCE_ENV; then
    die ".env.local już istnieje. Użyj --force-env albo usuń ręcznie (zostanie backup)."
  fi
  if [[ -f "$dest" ]]; then
    cp "$dest" "${dest}.bak.$(date +%Y%m%d-%H%M%S)"
    log "Kopia zapasowa: ${dest}.bak.*"
  fi

  cat >"$dest" <<EOF
# Wygenerowane przez scripts/server-setup.sh — $(date -Iseconds)
NEXT_PUBLIC_SUPABASE_URL=${SUPABASE_URL}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
RESEND_API_KEY=${RESEND_API_KEY:-}
EMAIL_FROM=${EMAIL_FROM:-Mikran - Asystent Zamówień <onboarding@resend.dev>}
CRON_SECRET=${CRON_SECRET}
NEXT_PUBLIC_APP_URL=${FINAL_APP_URL}
DEV_ADMIN_MODE=false
EOF

  if [[ -n "${LAN_DEV_HOST:-}" ]]; then
    echo "LAN_DEV_HOST=${LAN_DEV_HOST}" >>"$dest"
  fi
  if [[ -n "${APP_SERVER_HOST:-}" ]]; then
    echo "APP_SERVER_HOST=${APP_SERVER_HOST}" >>"$dest"
    echo "APP_PORT=${APP_PORT:-3000}" >>"$dest"
  fi
  if [[ -n "${SERVER_ACTION_ALLOWED_ORIGINS:-}" ]]; then
    echo "SERVER_ACTION_ALLOWED_ORIGINS=${SERVER_ACTION_ALLOWED_ORIGINS}" >>"$dest"
  fi

  if [[ -n "${SUBIEKT_API_BASE_URL:-}" ]]; then
    cat >>"$dest" <<EOF

# Subiekt (LAN)
SUBIEKT_API_BASE_URL=${SUBIEKT_API_BASE_URL}
SUBIEKT_API_AUTH_MODE=${SUBIEKT_API_AUTH_MODE:-none}
SUBIEKT_API_HEALTH_PATH=${SUBIEKT_API_HEALTH_PATH:-/health}
SUBIEKT_API_TIMEOUT_MS=${SUBIEKT_API_TIMEOUT_MS:-15000}
EOF
    if [[ -n "${SUBIEKT_API_KEY:-}" ]]; then
      echo "SUBIEKT_API_KEY=${SUBIEKT_API_KEY}" >>"$dest"
    fi
  fi

  chmod 600 "$dest"
  log "Zapisano ${dest}"
}

check_prerequisites() {
  log ""
  log "=== 1/6 — Wymagania ==="
  command -v node >/dev/null 2>&1 || die "Brak Node.js — zainstaluj Node 24 LTS (https://nodejs.org)"
  command -v npm >/dev/null 2>&1 || die "Brak npm"

  local node_major
  node_major="$(node -p "process.versions.node.split('.')[0]")"
  if [[ "$node_major" -lt 20 ]] || [[ "$node_major" -eq 20 && "$(node -p "process.versions.node.split('.')[1]")" -lt 9 ]]; then
    die "Node $(node -v) — wymagane minimum 20.9 (zalecany 24 LTS, plik .nvmrc)"
  elif [[ "$node_major" -lt 24 ]]; then
    warn "Node $(node -v) — działa; zalecany 24 LTS (nvm use / .nvmrc)"
    log "Node $(node -v) — OK"
  else
    log "Node $(node -v) — OK"
  fi
}

collect_configuration() {
  log ""
  log "=== 2/6 — Plik .env.local ==="

  local base_file=""
  if [[ -n "$FROM_ENV" ]]; then
    base_file="$FROM_ENV"
    [[ -f "$base_file" ]] || die "Brak pliku: $base_file"
  elif [[ -f "$ROOT/.env.work" ]] && ! $NON_INTERACTIVE; then
    local ans
    read -r -p "Znaleziono .env.work — użyć jako baza? [T/n]: " ans
    if [[ "${ans:-T}" =~ ^[TtYy]?$ ]]; then
      base_file="$ROOT/.env.work"
    fi
  elif [[ -f "$ROOT/.env.local" ]] && ! $FORCE_ENV; then
    base_file="$ROOT/.env.local"
    log "Aktualizuję istniejący .env.local (backup + --force-env)"
    FORCE_ENV=true
  fi

  if [[ -n "$base_file" ]]; then
    log "Wczytuję: $base_file"
    load_env_file "$base_file" || true
  fi

  SUPABASE_URL="${SETUP_SUPABASE_URL:-${NEXT_PUBLIC_SUPABASE_URL:-}}"
  SUPABASE_ANON_KEY="${SETUP_SUPABASE_ANON_KEY:-${NEXT_PUBLIC_SUPABASE_ANON_KEY:-}}"
  SUPABASE_SERVICE_ROLE_KEY="${SETUP_SUPABASE_SERVICE_ROLE_KEY:-${SUPABASE_SERVICE_ROLE_KEY:-}}"
  RESEND_API_KEY="${SETUP_RESEND_API_KEY:-${RESEND_API_KEY:-}}"
  EMAIL_FROM="${SETUP_EMAIL_FROM:-${EMAIL_FROM:-}}"
  CRON_SECRET="${SETUP_CRON_SECRET:-${CRON_SECRET:-}}"
  SUBIEKT_API_BASE_URL="${SETUP_SUBIEKT_BASE_URL:-${SUBIEKT_API_BASE_URL:-}}"

  if $NON_INTERACTIVE; then
    [[ -n "$SUPABASE_URL" && -n "$SUPABASE_ANON_KEY" && -n "$SUPABASE_SERVICE_ROLE_KEY" ]] \
      || die "W trybie --non-interactive ustaw SETUP_SUPABASE_*"
  else
    SUPABASE_URL="$(prompt "NEXT_PUBLIC_SUPABASE_URL" "$SUPABASE_URL")"
    SUPABASE_ANON_KEY="$(prompt_secret "NEXT_PUBLIC_SUPABASE_ANON_KEY" "$SUPABASE_ANON_KEY")"
    SUPABASE_SERVICE_ROLE_KEY="$(prompt_secret "SUPABASE_SERVICE_ROLE_KEY" "$SUPABASE_SERVICE_ROLE_KEY")"
    if [[ -z "$RESEND_API_KEY" ]]; then
      read -r -p "RESEND_API_KEY (Enter = pomiń, bez maili): " RESEND_API_KEY
    fi
    if [[ -z "$EMAIL_FROM" ]]; then
      EMAIL_FROM="$(prompt "EMAIL_FROM" "Mikran - Asystent Zamówień <onboarding@resend.dev>")"
    fi
    if [[ -z "$SUBIEKT_API_BASE_URL" ]]; then
      read -r -p "SUBIEKT_API_BASE_URL (Enter = pomiń): " SUBIEKT_API_BASE_URL
    fi
  fi

  if [[ -z "$CRON_SECRET" || "$CRON_SECRET" == "change-me-in-production" || "$CRON_SECRET" == "dev-local-cron-secret" ]]; then
    CRON_SECRET="$(generate_cron_secret)"
    log "Wygenerowano nowy CRON_SECRET: $(mask_secret "$CRON_SECRET")"
  fi

  local detected_ip
  detected_ip="$(detect_lan_ip || true)"
  local default_url=""
  if [[ -n "$APP_URL" ]]; then
    default_url="$APP_URL"
  elif [[ -n "${SETUP_APP_URL:-}" ]]; then
    default_url="$SETUP_APP_URL"
  elif [[ -n "${NEXT_PUBLIC_APP_URL:-}" && "${NEXT_PUBLIC_APP_URL}" != "http://localhost:3000" ]]; then
    default_url="$NEXT_PUBLIC_APP_URL"
  elif [[ -n "$detected_ip" ]]; then
    default_url="http://${detected_ip}:${PORT}"
  else
    default_url="http://localhost:${PORT}"
  fi

  if $NON_INTERACTIVE; then
    FINAL_APP_URL="${APP_URL:-${SETUP_APP_URL:-$default_url}}"
  else
    log ""
    log "Adres aplikacji MUSI być identyczny z tym, co wpisujesz w przeglądarce (ciasteczka sesji)."
    if [[ -n "$detected_ip" ]]; then
      log "Wykryte IP serwera w LAN: ${detected_ip}"
    fi
    FINAL_APP_URL="$(prompt "NEXT_PUBLIC_APP_URL" "$default_url")"
  fi

  LAN_DEV_HOST=""
  if [[ "$FINAL_APP_URL" =~ ^http://([0-9.]+):([0-9]+)$ ]]; then
    LAN_DEV_HOST="${BASH_REMATCH[1]}"
  fi

  write_env_local
}

install_and_build() {
  log ""
  log "=== 3/6 — Zależności i build ==="
  if ! $SKIP_INSTALL; then
    if [[ -f package-lock.json ]]; then
      # NODE_ENV=production powoduje pomijanie devDependencies — build wymaga pełnych modulow.
      env -u NODE_ENV npm ci
    else
      env -u NODE_ENV npm install
    fi
  else
    log "Pominięto npm install"
  fi

  if ! $SKIP_BUILD; then
    NODE_ENV=production npm run build
  else
    log "Pominięto npm run build"
  fi
}

run_setup_check() {
  log ""
  log "=== 4/6 — Weryfikacja (setup-check) ==="
  if npm run setup-check; then
    log "setup-check OK"
  else
    warn "setup-check zgłosił problemy — popraw .env.local lub migracje w Supabase"
    return 1
  fi
}

install_systemd_unit() {
  log ""
  log "=== 5/6 — systemd (opcjonalnie) ==="
  if ! $INSTALL_SYSTEMD; then
    log "Pominięto (--systemd aby wygenerować)"
    return 0
  fi

  local unit="/tmp/system-dostaw.service"
  local user_name
  user_name="$(whoami)"
  cat >"$unit" <<EOF
[Unit]
Description=OnTime System Dostaw (Next.js)
After=network.target

[Service]
Type=simple
User=${user_name}
WorkingDirectory=${ROOT}
Environment=NODE_ENV=production
Environment=PORT=${PORT}
ExecStart=$(command -v npm) run start
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

  log "Wygenerowano ${unit}"
  log "Instalacja (jako root):"
  log "  sudo cp ${unit} /etc/systemd/system/system-dostaw.service"
  log "  sudo systemctl daemon-reload"
  log "  sudo systemctl enable --now system-dostaw"
  log "  sudo systemctl status system-dostaw"
}

install_cron_jobs() {
  log ""
  log "=== 6/6 — Cron (opcjonalnie) ==="
  if ! $INSTALL_CRON; then
    log "Pominięto (--cron aby wygenerować)"
    return 0
  fi

  bash "$ROOT/scripts/install-cron.sh" --output /tmp/system-dostaw.cron
}

print_summary() {
  # shellcheck disable=SC1091
  source "$ROOT/.env.local"

  log ""
  log "=== Gotowe ==="
  log ""
  log "Aplikacja:"
  log "  URL:     ${NEXT_PUBLIC_APP_URL}"
  log "  Start:   npm run start   (port ${PORT})"
  log "  Dev:     npm run dev"
  log ""
  log "Supabase → Authentication → URL Configuration:"
  log "  Site URL:        ${NEXT_PUBLIC_APP_URL}"
  log "  Redirect URLs:   ${NEXT_PUBLIC_APP_URL}/**"
  if [[ -n "${APP_SERVER_HOST:-}" ]]; then
    log "                   http://${APP_SERVER_HOST}:${APP_PORT:-3000}/**"
    log "                   http://${APP_SERVER_HOST}/**"
  fi
  if [[ "${NEXT_PUBLIC_APP_URL}" != *":3000"* && "${NEXT_PUBLIC_APP_URL}" == http://* ]]; then
    warn "Brak :3000 w URL — OK tylko gdy masz reverse proxy (port 80 → 3000)."
  fi
  log ""
  log "Po zmianie URL zrestartuj aplikację."
  log "Diagnostyka LAN: npm run lan-check"
  log "Pełna weryfikacja: npm run setup-check"
  log ""
  if [[ "${NEXT_PUBLIC_APP_URL}" == http://* ]]; then
    warn "Używasz HTTP — upewnij się, że Supabase ma ten adres w Redirect URLs."
  fi
}

main() {
  log "OnTime — konfiguracja serwera"
  log "Katalog projektu: ${ROOT}"
  check_prerequisites
  collect_configuration
  install_and_build
  run_setup_check || true
  install_systemd_unit
  install_cron_jobs
  print_summary
}

main
