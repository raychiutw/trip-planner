/**
 * 對照組輸出的掃描器：找真實 email 與 token 樣式。
 * 驗收只驗輸出，所以這是最後一道、與消毒流程分開跑的檢查（redactTokens 與掃描共用樣式，確保「洗過就掃不到」）。
 */
export type FindingKind = 'email' | 'jwt' | 'hex' | 'bearer' | 'apikey' | 'b64url';
export interface Finding {
  kind: FindingKind;
  match: string;
  index: number;
}

export const FAKE_EMAIL_DOMAIN = 'control.invalid';
export const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

const TOKEN_PATTERNS: { kind: Exclude<FindingKind, 'email'>; re: RegExp }[] = [
  { kind: 'jwt', re: /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]*/g },
  { kind: 'bearer', re: /Bearer\s+[A-Za-z0-9._~+/=-]{16,}/gi },
  { kind: 'apikey', re: /AIza[0-9A-Za-z_-]{30,}|sk-[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9]{30,}|xox[abprs]-[A-Za-z0-9-]{10,}/g },
  { kind: 'hex', re: /\b[0-9a-fA-F]{32,}\b/g },
  // 長度 43 以上、同時含大小寫與數字的 base64url（32 位元組的隨機值編碼後是 43 字元）
  { kind: 'b64url', re: /(?<![A-Za-z0-9_/-])(?=[A-Za-z0-9_-]*[A-Z])(?=[A-Za-z0-9_-]*[a-z])(?=[A-Za-z0-9_-]*\d)[A-Za-z0-9_-]{43,}(?![A-Za-z0-9_-])/g },
];

export function isFakeEmail(email: string): boolean {
  return email.toLowerCase().endsWith(`@${FAKE_EMAIL_DOMAIN}`);
}

export function scan(text: string): Finding[] {
  const findings: Finding[] = [];
  for (const m of text.matchAll(EMAIL_RE)) {
    if (!isFakeEmail(m[0])) findings.push({ kind: 'email', match: m[0], index: m.index! });
  }
  for (const { kind, re } of TOKEN_PATTERNS) {
    for (const m of text.matchAll(re)) findings.push({ kind, match: m[0], index: m.index! });
  }
  return findings;
}

/** 把字串裡的 token 樣式換成 [token]。 */
export function redactTokens(text: string): string {
  let out = text;
  for (const { re } of TOKEN_PATTERNS) out = out.replace(re, '[token]');
  return out;
}
