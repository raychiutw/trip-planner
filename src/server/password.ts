/**
 * Password hashing module — V2-P2 (per docs/v2-oauth-server-plan.md)
 *
 * 設計取捨：
 *   - 用 Web Crypto PBKDF2-SHA256（CF Workers native，無 wasm dep）
 *   - 不用 argon2id（雖然 spec 較 prefer）— argon2 在 CF Workers 需 wasm
 *     （hash-wasm package），增加 cold-start 跟 deps 風險。PBKDF2 with
 *     600,000 iterations 是 OWASP 2023 password 儲存 recommendation 之一
 *     [https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html]
 *   - V2-P6 security hardening 階段 evaluate argon2id wasm migration（可
 *     共存：根據 hash format prefix 決定 verify 方式）
 *
 * Hash format（self-describing，便於將來 algorithm migration）:
 *
 *   pbkdf2$<iterations>$<base64url salt>$<base64url hash>
 *
 * 例：pbkdf2$600000$rA5j...$x8K2...
 *
 * Verify 時 parse format → 用同 iteration + salt 重算 → constant-time compare。
 */

const ALGORITHM_NAME = 'pbkdf2';
const HASH_FN = 'SHA-256';
const ITERATIONS = 600_000; // OWASP 2023 PBKDF2-SHA256 recommendation
const SALT_BYTES = 16;
const HASH_BYTES = 32;

function base64urlEncode(bytes: Uint8Array): string {
  let str = '';
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]!);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlDecode(s: string): Uint8Array {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/') + '=='.slice(0, (4 - (s.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function pbkdf2(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits'],
  );
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: HASH_FN,
      // TS 5.x strict：Uint8Array<ArrayBufferLike> 不能直接當 BufferSource
      // (因可能含 SharedArrayBuffer)。cast 到 ArrayBuffer subset 因 new Uint8Array() 永遠不會 share。
      salt: salt as unknown as ArrayBuffer,
      iterations,
    },
    key,
    HASH_BYTES * 8,
  );
  return new Uint8Array(derivedBits);
}

function constantTimeEquals(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

/**
 * Hash a plaintext password。
 * Returns format: `pbkdf2$<iter>$<salt-b64u>$<hash-b64u>`
 */
export async function hashPassword(plain: string): Promise<string> {
  if (!plain || plain.length < 8) {
    throw new Error('Password must be at least 8 chars');
  }
  const salt = new Uint8Array(SALT_BYTES);
  crypto.getRandomValues(salt);
  const hash = await pbkdf2(plain, salt, ITERATIONS);
  return `${ALGORITHM_NAME}$${ITERATIONS}$${base64urlEncode(salt)}$${base64urlEncode(hash)}`;
}

/**
 * Verify plaintext against stored hash。
 * Returns true if match, false otherwise (no throw on bad format — fail closed)。
 */
export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  if (!plain || !stored) return false;
  const parts = stored.split('$');
  if (parts.length !== 4) return false;
  const [algo, iterStr, saltB64, hashB64] = parts;
  if (algo !== ALGORITHM_NAME) return false;
  if (!iterStr || !saltB64 || !hashB64) return false;
  const iterations = Number(iterStr);
  if (!Number.isFinite(iterations) || iterations < 1) return false;
  let salt: Uint8Array;
  let storedHash: Uint8Array;
  try {
    salt = base64urlDecode(saltB64);
    storedHash = base64urlDecode(hashB64);
  } catch {
    return false;
  }
  const computed = await pbkdf2(plain, salt, iterations);
  return constantTimeEquals(computed, storedHash);
}

/**
 * Re-hash if iteration count is below current。Useful for incremental upgrade
 * when OWASP recommendation bumps（V2-P6 might raise to 1M）。Caller storing
 * password should call this on successful login + persist if returned non-null。
 */
export function needsRehash(stored: string): boolean {
  const parts = stored.split('$');
  if (parts.length !== 4) return true;
  const [algo, iterStr] = parts;
  if (algo !== ALGORITHM_NAME) return true;
  const iterations = Number(iterStr);
  return !Number.isFinite(iterations) || iterations < ITERATIONS;
}
