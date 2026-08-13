/** Hashing de senha — Argon2id (@node-rs/argon2, binários pré-compilados).
 *  Nunca implementar hash criptográfico manual; senha nunca em texto puro. */
import { hash, verify } from "@node-rs/argon2";

export async function hashPassword(password: string): Promise<string> {
  return hash(password, { algorithm: 2 }); // 2 = Argon2id
}

export async function verifyPassword(hashValue: string, password: string): Promise<boolean> {
  try {
    return await verify(hashValue, password);
  } catch {
    return false;
  }
}
