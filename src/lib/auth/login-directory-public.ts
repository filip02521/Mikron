import type { LoginDirectoryAccount } from "@/lib/auth/login-directory";

/** Konto widoczne na ekranie logowania — bez adresu e-mail w kliencie. */
export type LoginDirectoryAccountPublic = Omit<LoginDirectoryAccount, "email">;

export function toPublicLoginDirectoryAccounts(
  accounts: LoginDirectoryAccount[]
): LoginDirectoryAccountPublic[] {
  return accounts.map(({ id, role, roleLabel, displayName, salesPersonName, assignmentLabel }) => ({
    id,
    role,
    roleLabel,
    displayName,
    salesPersonName,
    assignmentLabel,
  }));
}
