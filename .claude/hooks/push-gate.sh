#!/bin/bash
# PreToolUse(Bash): przed `git push` / `gh pr create` wymaga authz-reviewer + checków z /pre-deploy.
# Znaczniki per commit w <git-common-dir>/claude-gate/, więc ponowny push tego samego HEAD nic nie powtarza.
# ponytail: używa cwd sesji; `cd inny-katalog && git push` sprawdzi katalog sesji, nie docelowy.
input=$(cat)
cmd=$(jq -r '.tool_input.command // empty' <<<"$input")
grep -Eq '(^|[;&|[:space:](])(git[[:space:]]+push|gh[[:space:]]+pr[[:space:]]+create)' <<<"$cmd" || exit 0

cwd=$(jq -r '.cwd // empty' <<<"$input")
root=$(git -C "${cwd:-.}" rev-parse --show-toplevel 2>/dev/null) || exit 0
cd "$root" || exit 0
sha=$(git rev-parse HEAD)
gate="$(cd "$(git rev-parse --git-common-dir)" && pwd)/claude-gate"
mkdir -p "$gate"

base=$(git rev-parse -q --verify origin/main >/dev/null && echo origin/main || echo main)
if [ -n "$(git diff --name-only "$base"...HEAD -- src/app/actions src/app/api)" ] && [ ! -f "$gate/$sha.authz" ]; then
  cat >&2 <<EOF
BRAMKA PUSH: zmiany w src/app/actions lub src/app/api bez przeglądu autoryzacji dla $sha.
Uruchom agenta authz-reviewer na: git diff $base...HEAD -- src/app/actions src/app/api
- brak problemów: touch "$gate/$sha.authz" i ponów push,
- są problemy: pokaż je użytkownikowi i NIE pushuj.
EOF
  exit 2
fi

if [ ! -f "$gate/$sha.predeploy" ]; then
  log="$gate/$sha.predeploy.log"
  fail=""; : >"$log"
  for step in "npx tsc --noEmit" "npm run lint" "npm test" "npm run verify:deploy"; do
    echo "== $step" >>"$log"
    eval "$step" >>"$log" 2>&1 || fail="$fail\n- $step"
  done
  if [ -n "$fail" ]; then
    printf "BRAMKA PUSH: /pre-deploy nie przeszedł dla %s:%b\nLog: %s\nPokaż użytkownikowi błędy (ścieżka:linia) i zapytaj, czy naprawić. NIE pushuj.\n" "$sha" "$fail" "$log" >&2
    exit 2
  fi
  touch "$gate/$sha.predeploy"
fi
exit 0
