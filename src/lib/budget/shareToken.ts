// Server-only: share-link token generation + hashing. Uses node:crypto, so this module must
// never be imported into a client component — only server actions and the public route use it.
import { randomBytes, createHash } from 'crypto';

/** 256-bit URL-safe random token. This is the secret that appears in the link. */
export function generateShareToken(): string {
  return randomBytes(32).toString('base64url');
}

/** sha256 hex of a token. Only the hash is stored, so a DB dump can't reconstruct live links. */
export function hashShareToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
