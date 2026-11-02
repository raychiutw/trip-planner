/* PKCE（RFC 7636）：code_verifier 與 S256 code_challenge。 */
import { bytesToBase64Url, sha256Base64Url } from './encoding';

/** 32 位元組隨機 → base64url 43 字元（規範下限 43、上限 128）。 */
export function generateCodeVerifier(): string {
  return bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32)));
}

export function codeChallengeS256(verifier: string): Promise<string> {
  return sha256Base64Url(verifier);
}

export async function createPkcePair(): Promise<{ verifier: string; challenge: string }> {
  const verifier = generateCodeVerifier();
  return { verifier, challenge: await codeChallengeS256(verifier) };
}
