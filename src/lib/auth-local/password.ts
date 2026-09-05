import { compare, hash } from "bcryptjs";

const BCRYPT_COST = 10;

export async function hashPassword(plain: string): Promise<string> {
  return hash(plain, BCRYPT_COST);
}

export async function verifyPassword(plain: string, hashed: string): Promise<boolean> {
  if (!plain || !hashed) return false;
  try {
    return await compare(plain, hashed);
  } catch {
    return false;
  }
}
