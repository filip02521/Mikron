# Deploy na serwer (Windows / Linux)

## Problem: „Cannot find module tailwindcss”

Przyczyna: `npm ci` uruchomione przy **`NODE_ENV=production`** pomija `devDependencies`. Build Next.js (`npm run build`) **wymaga** Tailwind i PostCSS.

## Rozwiązanie w repo

- `tailwindcss`, `@tailwindcss/postcss` i `typescript` są w **`dependencies`** (nie tylko dev).
- Skrypty deploy (`installer/nightly-deploy.ps1`, `installer/install-windows-service.ps1`, `scripts/server-setup.sh`) **czyszczą `NODE_ENV` przed `npm ci`**.
- Nocny deploy wymusza `npm ci`, gdy brakuje `node_modules/tailwindcss`.

## Ręczny deploy (Windows)

```powershell
cd C:\ścieżka\do\Mikron
git pull origin main
# NIE: $env:NODE_ENV = "production"  — dopiero przed build/start
npm ci
npm run build
Restart-Service OnTime
```

## Pierwszy raz po aktualizacji

Jeśli nadal brakuje modułów:

```powershell
Remove-Item -Recurse -Force node_modules
npm ci
npm run build
```

Lub wymuś pełny install usługi:

```powershell
.\installer\install-windows-service.ps1 -ForceInstall -Force
```
