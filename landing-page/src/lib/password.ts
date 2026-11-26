import bcrypt from "bcryptjs";
import { createHash } from "crypto";

const BCRYPT_PREFIX = "$2";

export function isBcryptHash(hash: string) {
  return hash.startsWith(BCRYPT_PREFIX);
}

export async function verifyPassword(password: string, storedHash: string) {
  const trimmed = password.trim();
  if (!storedHash) return false;
  if (isBcryptHash(storedHash)) {
    return bcrypt.compare(trimmed, storedHash);
  }
  const legacy = createHash("sha256").update(trimmed).digest("hex");
  return legacy === storedHash;
}
