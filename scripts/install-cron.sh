#!/usr/bin/env bash
# Generuje i opcjonalnie instaluje wpisy crona dla OnTime (system-dostaw-web).
#
# Wymaga: .env.local z CRON_SECRET (i opcjonalnie APP_PORT / NEXT_PUBLIC_APP_URL)
#
#   npm run install-cron              # generuje /tmp/system-dostaw.cron
#   npm run install-cron -- --install # kopiuje do /etc/cron.d/system-dostaw (sudo)
#   npm run install-cron -- --test    # test jednego endpointu (morning, force)
#
# Opcje:
#   --help              pomoc
#   --install           zainstaluj jako /etc/cron.d/system-dostaw (root)
#   --output FILE       plik wyjściowy (domyślnie /tmp/system-dostaw.cron)
#   --base URL          baza HTTP aplikacji (domyślnie http://127.0.0.1:PORT)
#   --from-env FILE     wczytaj env z innego pliku zamiast .env.local
#   --test [JOB]        wywołaj endpoint (morning|process-deliveries|catalog-zd-sync|zd-eta-sync)
#   --force             przy --test dodaj ?force=1 (pomija okna czasowe)
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

OUTPUT="/tmp/system-dostaw.cron"
INSTALL=false
FROM_ENV=""
BASE_URL=""
TEST_JOB=""
TEST_FORCE=false
CRON_DEST="/etc/cron.d/system-dostaw"

log() { printf '%s\n' "$*"; }
warn() { printf '⚠ %s\n' "$*" >&2; }
die() { printf '✗ %s\n' "$*" >&2; exit 1; }

usage() {
  sed -n '2,20p' "$0" | sed 's/^# \?//'
  exit 0
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --help|-h) usage ;;
    --install) INSTALL=true; shift ;;
    --output) OUTPUT="$2"; shift 2 ;;
    --base) BASE_URL="$2"; shift 2 ;;
    --from-env) FROM_ENV="$2"; shift 2 ;;
    --test) TEST_JOB="${2:-morning}"; shift; [[ "${1:-}" == "--force" ]] && { TEST_FORCE=true; shift; } || true ;;
    --force) TEST_FORCE=true; shift ;;
    *) die "Nieznana opcja: $1 (użyj --help)" ;;
  esac
done

load_env_file() {
  local file="$1"
  [[ -f "$file" ]] || die "Brak pliku env: $file"
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line#"${line%%[![:space:]]*}"}"
    line="${line%"${line##*[![:space:]]}"}"
    [[ -z "$line" || "$line" == \#* ]] && continue
    [[ "$line" != *=* ]] && continue
    local key="${line%%=*}"
    local val="${line#*=}"
    key="${key#"${key%%[![:space:]]*}"}"
    key="${key%"${key##*[![:space:]]}"}"
    val="${val#"${val%%[![:space:]]*}"}"
    val="${val%"${val##*[![:space:]]}"}"
    if [[ "$val" == \"*\" && "$val" == *\" ]]; then
      val="${val:1:${#val}-2}"
    elif [[ "$val" == \'*\' && "$val" == *\' ]]; then
      val="${val:1:${#val}-2}"
    fi
    printf -v "$key" '%s' "$val"
    export "$key"
  done <"$file"
}

load_env_file "${FROM_ENV:-$ROOT/.env.local}"

PORT="${APP_PORT:-${PORT:-3000}}"
if [[ -z "$BASE_URL" ]]; then
  BASE_URL="http://127.0.0.1:${PORT}"
fi

if [[ -z "${CRON_SECRET:-}" || "$CRON_SECRET" == "change-me-in-production" || "$CRON_SECRET" == "dev-local-cron-secret" ]]; then
  die "Ustaw silny CRON_SECRET w .env.local (nie change-me-in-production)."
fi

cron_path_for_job() {
  case "$1" in
    morning) echo "/api/cron/morning" ;;
    process-deliveries) echo "/api/cron/process-deliveries" ;;
    catalog-zd-sync) echo "/api/cron/catalog-zd-sync" ;;
    zd-eta-sync) echo "/api/cron/zd-eta-sync" ;;
    morning-sync) echo "/api/cron/morning-sync" ;;
    *) die "Nieznany job: $1 (morning|process-deliveries|catalog-zd-sync|zd-eta-sync|morning-sync)" ;;
  esac
}

run_test() {
  local job="$TEST_JOB"
  local path
  path="$(cron_path_for_job "$job")"
  local url="${BASE_URL}${path}"
  if $TEST_FORCE; then
    url="${url}?force=1"
  fi
  log "Test: curl ${url}"
  curl -fsS -H "Authorization: Bearer ${CRON_SECRET}" "$url" | head -c 2000
  printf '\n'
  log "✓ Odpowiedź OK"
}

write_cron_file() {
  local out="$1"
  cat >"$out" <<EOF
# OnTime — system-dostaw-web
# Wygenerowano: $(date -Iseconds 2>/dev/null || date)
# Katalog projektu: ${ROOT}
# Strefa: Europe/Warsaw (CRON_TZ)
#
# Instalacja: npm run install-cron -- --install
# Logi: /var/log/system-dostaw-cron.log , /var/log/system-dostaw-catalog.log
#
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin
CRON_TZ=Europe/Warsaw
CRON_SECRET=${CRON_SECRET}
BASE=${BASE_URL}

# Pon–pt 6:00 — panel dzienny, kolejka realizacji
0 6 * * 1-5 root curl -fsS -H "Authorization: Bearer \$CRON_SECRET" "\$BASE/api/cron/morning" >> /var/log/system-dostaw-cron.log 2>&1

# Pon–pt co godzinę 8:00–18:00 — zapasowe domknięcie dostaw
0 8-18 * * 1-5 root curl -fsS -H "Authorization: Bearer \$CRON_SECRET" "\$BASE/api/cron/process-deliveries" >> /var/log/system-dostaw-cron.log 2>&1

# Pon–pt co 2 h 8–18 — backup sync terminów ZD (w godzinach pracy)
0 8,10,12,14,16,18 * * 1-5 root curl -fsS -H "Authorization: Bearer \$CRON_SECRET" "\$BASE/api/cron/zd-eta-sync" >> /var/log/system-dostaw-cron.log 2>&1

# Noc 02:00–04:40 co 20 min — synchronizacja katalogu ZD (do ~14 min na wywołanie)
0 2 * * * root curl -fsS -H "Authorization: Bearer \$CRON_SECRET" "\$BASE/api/cron/catalog-zd-sync" >> /var/log/system-dostaw-catalog.log 2>&1
20 2 * * * root curl -fsS -H "Authorization: Bearer \$CRON_SECRET" "\$BASE/api/cron/catalog-zd-sync" >> /var/log/system-dostaw-catalog.log 2>&1
40 2 * * * root curl -fsS -H "Authorization: Bearer \$CRON_SECRET" "\$BASE/api/cron/catalog-zd-sync" >> /var/log/system-dostaw-catalog.log 2>&1
0 3 * * * root curl -fsS -H "Authorization: Bearer \$CRON_SECRET" "\$BASE/api/cron/catalog-zd-sync" >> /var/log/system-dostaw-catalog.log 2>&1
20 3 * * * root curl -fsS -H "Authorization: Bearer \$CRON_SECRET" "\$BASE/api/cron/catalog-zd-sync" >> /var/log/system-dostaw-catalog.log 2>&1
40 3 * * * root curl -fsS -H "Authorization: Bearer \$CRON_SECRET" "\$BASE/api/cron/catalog-zd-sync" >> /var/log/system-dostaw-catalog.log 2>&1
0 4 * * * root curl -fsS -H "Authorization: Bearer \$CRON_SECRET" "\$BASE/api/cron/catalog-zd-sync" >> /var/log/system-dostaw-catalog.log 2>&1
20 4 * * * root curl -fsS -H "Authorization: Bearer \$CRON_SECRET" "\$BASE/api/cron/catalog-zd-sync" >> /var/log/system-dostaw-catalog.log 2>&1
40 4 * * * root curl -fsS -H "Authorization: Bearer \$CRON_SECRET" "\$BASE/api/cron/catalog-zd-sync" >> /var/log/system-dostaw-catalog.log 2>&1
EOF
}

if [[ -n "$TEST_JOB" ]]; then
  run_test
  exit 0
fi

write_cron_file "$OUTPUT"
log "✓ Wygenerowano: ${OUTPUT}"
log ""
log "Harmonogram (Europe/Warsaw):"
log "  06:00 pn–pt     → /api/cron/morning"
log "  08–18 pn–pt    → /api/cron/process-deliveries (co godzinę)"
log "  08–18 pn–pt    → /api/cron/zd-eta-sync (8,10,12,14,16,18)"
log "  02:00–04:40     → /api/cron/catalog-zd-sync (co 20 min, noc, Subiekt LAN)"
log ""
log "Baza HTTP: ${BASE_URL}"
log ""

if ! $INSTALL; then
  log "Podgląd:"
  sed 's/^CRON_SECRET=.*/CRON_SECRET=[ukryty]/' "$OUTPUT" | sed 's/^/  /'
  log ""
  log "Instalacja (jako root na serwerze Linux):"
  log "  npm run install-cron -- --install"
  log "  # albo:"
  log "  sudo cp ${OUTPUT} ${CRON_DEST}"
  log "  sudo chmod 644 ${CRON_DEST}"
  exit 0
fi

if [[ "$(id -u)" -ne 0 ]]; then
  die "Opcja --install wymaga root (sudo npm run install-cron -- --install)"
fi

cp "$OUTPUT" "$CRON_DEST"
chmod 644 "$CRON_DEST"

# Puste logi — cron append bez błędu przy pierwszym uruchomieniu
touch /var/log/system-dostaw-cron.log /var/log/system-dostaw-catalog.log
chmod 644 /var/log/system-dostaw-cron.log /var/log/system-dostaw-catalog.log 2>/dev/null || true

log "✓ Zainstalowano ${CRON_DEST}"
log ""
log "Sprawdzenie:"
log "  sudo systemctl status cron || sudo systemctl status crond"
log "  tail -f /var/log/system-dostaw-cron.log"
log ""
log "Test ręczny (pomija okna czasowe):"
log "  npm run install-cron -- --test morning --force"
