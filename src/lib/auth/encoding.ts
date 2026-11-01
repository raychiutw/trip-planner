/* base64url 編碼（RFC 4648 §5，不含 padding）。PKCE、DPoP、JWT 共用。 */

export function bytesToBase64Url(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = '';
  for (const b of view) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function stringToBase64Url(s: string): string {
  return bytesToBase64Url(new TextEncoder().encode(s));
}

export async function sha256Base64Url(input: string): Promise<string> {
  return bytesToBase64Url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input)));
}
