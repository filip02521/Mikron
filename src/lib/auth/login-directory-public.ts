import type {
  LoginDirectoryAccount,
  LoginDirectoryAccountPublic,
} from "@/lib/auth/login-directory-shared";

export type { LoginDirectoryAccountPublic };

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
