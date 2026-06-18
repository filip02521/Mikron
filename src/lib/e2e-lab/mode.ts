import type { LoginDirectoryAccount } from "@/lib/auth/login-directory";
import { ROLE_LABELS } from "@/lib/users/labels";

/** CI / Playwright — serwer bez prawdziwego Supabase. */
export function isE2ELab(): boolean {
  return process.env.E2E_LAB === "1";
}

/** Stały katalog kont na ekranie logowania w testach E2E. */
export const E2E_LOGIN_DIRECTORY_FIXTURE: LoginDirectoryAccount[] = [
  {
    id: "e2e-login-account-1",
    email: "jan.kowalski@firma.pl",
    role: "sales",
    roleLabel: "Handlowiec",
    displayName: "Jan Kowalski",
    salesPersonName: "Jan Kowalski",
  },
  {
    id: "e2e-login-account-2",
    email: "anna.nowak@firma.pl",
    role: "sales_manager",
    roleLabel: ROLE_LABELS.sales_manager,
    displayName: "Anna Nowak",
    salesPersonName: "Anna Nowak",
  },
];
