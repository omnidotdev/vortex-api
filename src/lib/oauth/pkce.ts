/**
 * PKCE (Proof Key for Code Exchange) utilities.
 *
 * PKCE is a security extension to OAuth 2.0 that helps prevent
 * authorization code interception attacks.
 */

import { createHash, randomBytes } from "node:crypto";

/**
 * Generate a cryptographically random code verifier.
 * The verifier is a random string between 43-128 characters.
 * @knipignore - Used by generatePkcePair
 */
export function generateCodeVerifier(): string {
  // Generate 32 random bytes and encode as base64url
  // This produces a 43-character string
  return randomBytes(32).toString("base64url");
}

/**
 * Generate a code challenge from a code verifier.
 * Uses SHA256 hash encoded as base64url (S256 method).
 * @knipignore - Used by generatePkcePair
 */
export function generateCodeChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

/**
 * Generate a PKCE pair (verifier and challenge).
 */
export function generatePkcePair(): { verifier: string; challenge: string } {
  const verifier = generateCodeVerifier();
  const challenge = generateCodeChallenge(verifier);
  return { verifier, challenge };
}
