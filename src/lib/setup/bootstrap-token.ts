import { isProductionRuntime } from "@/lib/env/app-config";

export function getSetupToken(): string | undefined {
  const token = process.env.SETUP_TOKEN?.trim();
  return token || undefined;
}

/** W produkcji wymagany SETUP_TOKEN przy pierwszym adminie. */
export function isSetupTokenConfigured(): boolean {
  return Boolean(getSetupToken());
}

export function validateSetupToken(provided: string | undefined): boolean {
  const expected = getSetupToken();
  if (isProductionRuntime()) {
    if (!expected) return false;
    return provided?.trim() === expected;
  }
  if (!expected) return true;
  return provided?.trim() === expected;
}

export function setupTokenRequiredMessage(): string | null {
  if (!isProductionRuntime()) return null;
  if (isSetupTokenConfigured()) {
    return "Do utworzenia konta administratora potrzebny jest token z konfiguracji serwera (SETUP_TOKEN).";
  }
  return "Brak SETUP_TOKEN w konfiguracji serwera — ustaw losowy sekret przed pierwszym uruchomieniem.";
}
