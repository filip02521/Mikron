import {
  findEligiblePasswordResetUser,
  findEligiblePasswordResetUserByAccountId,
} from "@/lib/auth/password-reset-otp";

export async function resolveLoginEmailFromAccountId(
  accountId: string
): Promise<{ email: string; userId: string } | null> {
  const user = await findEligiblePasswordResetUserByAccountId(accountId);
  if (!user) return null;
  return { email: user.email, userId: user.id };
}

export { findEligiblePasswordResetUser, findEligiblePasswordResetUserByAccountId };
