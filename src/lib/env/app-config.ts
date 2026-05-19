/** Czy aplikacja działa w trybie produkcyjnym (Vercel / NODE_ENV). */
export function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === "production" || process.env.VERCEL === "1";
}

export function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000";
}

export function isAppUrlProductionReady(): boolean {
  const url = getAppUrl();
  if (!url.startsWith("https://")) return false;
  if (url.includes("localhost") || url.includes("127.0.0.1")) return false;
  return true;
}

export function getCronSecret(): string | undefined {
  const s = process.env.CRON_SECRET?.trim();
  if (!s || s === "change-me-in-production") return undefined;
  return s;
}
