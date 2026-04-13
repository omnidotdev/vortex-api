import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Compare two secrets using a timing-safe comparison.
 * Both values are hashed to fixed length before comparison to avoid
 * leaking the secret length via early return on length mismatch.
 * @param a - First secret
 * @param b - Second secret
 * @returns Whether the secrets match
 */
const secretsMatch = (a: string, b: string): boolean => {
  const hashA = createHash("sha256").update(a).digest();
  const hashB = createHash("sha256").update(b).digest();
  return timingSafeEqual(hashA, hashB);
};

export default secretsMatch;
