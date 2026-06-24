# Deploy na serwer (Windows / Linux)

## Problem: „Cannot find module tailwindcss”

Przyczyna: `npm ci` uruchomione przy **`NODE_ENV=production`** pomija `devDependencies`. Build Next.js (`npm run build`) **wymaga** Tailwind, PostCSS i TypeScript.

## Rozwiązanie w repo (wielowarstwowe)

1. **Kluczowe pakiety build w `dependencies`:** `tailwindcss`, `@tailwindcss/postcss`, `typescript`.
2. **Skrypt `npm run deps:ci`:** `npm ci --include=dev` — zawsze instaluje pełny zestaw modułów.
3. **Deploy skrypty** czyszczą `NODE_ENV` przed instalacją i sprawdzają kompletność `node_modules` (`next`, `tailwindcss`, `@tailwindcss/postcss`, `typescript`).
4. Wspólny moduł: `installer/npm-ci-for-build.ps1` (używany przez `install-windows-service.ps1` i `nightly-deploy.ps1`).

## Ręczny deploy (Windows)

```powershell
cd C:\ścieżka\do\Mikron
git pull origin main
# NIE ustawiaj NODE_ENV=production przed instalacją — tylko przed build/start
npm run deps:ci
npm run build
Restart-Service OnTime
```

## Pierwszy raz po aktualizacji

Jeśli nadal brakuje modułów:

```powershell
Remove-Item -Recurse -Force node_modules
npm run deps:ci
npm run build
```

Lub wymuś pełny install usługi:

```powershell
.\installer\install-windows-service.ps1 -ForceInstall -Force
```

## Linux (`scripts/server-setup.sh`)

```bash
env -u NODE_ENV npm run deps:ci
NODE_ENV=production npm run build
```

## Nocny deploy

`installer/nightly-deploy.ps1` automatycznie uruchamia `deps:ci`, gdy zmienił się lockfile lub brakuje modułów build.
