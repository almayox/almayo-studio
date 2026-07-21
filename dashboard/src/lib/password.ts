import bcrypt from "bcryptjs";

export async function hashPassword(password: string) {
  return bcrypt.hash(password.trim(), 12);
}
