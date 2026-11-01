/**
 * DPoP（RFC 9449）：ES256 金鑰、thumbprint、proof 產生。
 * 私鑰 extractable:false —— XSS 能「使用」金鑰簽章（頁面存活期間），但無法把私鑰帶走。
 * jti 只能用一次，所以每個請求都要重簽。
 */
import { bytesToBase64Url, sha256Base64Url, stringToBase64Url } from './encoding';

export interface PublicJwk { kty: 'EC'; crv: 'P-256'; x: string; y: string }

/** 產生 ES256（ECDSA P-256）金鑰對；私鑰不可匯出，公鑰仍可匯出。 */
export function generateDpopKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']);
}

/** 只取公鑰成員 kty／crv／x／y（絕不含 d）。 */
export async function exportPublicJwk(keyPair: CryptoKeyPair): Promise<PublicJwk> {
  const jwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
  return { kty: 'EC', crv: 'P-256', x: jwk.x as string, y: jwk.y as string };
}

/** RFC 7638：EC 的必要成員 crv、kty、x、y 依字典序、無空白。 */
export function jwkThumbprint(jwk: PublicJwk): Promise<string> {
  return sha256Base64Url(JSON.stringify({ crv: jwk.crv, kty: jwk.kty, x: jwk.x, y: jwk.y }));
}

export interface DpopProofInput {
  keyPair: CryptoKeyPair;
  method: string;
  /** 完整 URL；query 與 fragment 會被去掉。 */
  url: string;
  /** 打資源端點時帶；會寫入 ath。token endpoint 不帶。 */
  accessToken?: string;
  /** 測試用：指定時間（毫秒）。 */
  now?: number;
}

export async function createDpopProof({ keyPair, method, url, accessToken, now }: DpopProofInput): Promise<string> {
  const u = new URL(url);
  const claims: Record<string, unknown> = {
    jti: crypto.randomUUID(),
    htm: method.toUpperCase(),
    htu: `${u.protocol}//${u.host}${u.pathname}`,
    iat: Math.floor((now ?? Date.now()) / 1000),
  };
  if (accessToken !== undefined) claims.ath = await sha256Base64Url(accessToken);
  const header = { typ: 'dpop+jwt', alg: 'ES256', jwk: await exportPublicJwk(keyPair) };
  const signingInput = `${stringToBase64Url(JSON.stringify(header))}.${stringToBase64Url(JSON.stringify(claims))}`;
  // WebCrypto 的 ECDSA 輸出就是 JWS 要的 IEEE P1363（r||s），不用轉 DER
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, keyPair.privateKey, new TextEncoder().encode(signingInput));
  return `${signingInput}.${bytesToBase64Url(sig)}`;
}
