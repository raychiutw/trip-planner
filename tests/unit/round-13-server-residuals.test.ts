/**
 * round-13-server-residuals.test.ts — v2.33.59 Round 12 defer 全做 guard
 *
 * 6 個 fix source-grep lock:
 *  1. PUBLIC_ORIGIN env + getPublicOrigin helper + 5 callsite migrated
 *  2. PKCE mandatory for all clients (public + confidential)
 *  3. HMAC HKDF domain separation (session_v1 / invitation_token_v1)
 *  4. Unicode email NFKC + casefold normalize
 *  5. forgot-password / send-verification waitUntil (anti-enum timing oracle)
 *  6. verify endpoint POST primary + GET backward compat + Referrer-Policy
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const read = (p: string) => readFileSync(path.resolve(__dirname, '../..', p), 'utf-8');

const TYPES_SRC = read('functions/api/_types.ts');
const UTILS_SRC = read('functions/api/_utils.ts');
const FORGOT_SRC = read('functions/api/oauth/forgot-password.ts');
const SEND_VERIFY_SRC = read('functions/api/oauth/send-verification.ts');
const VERIFY_SRC = read('functions/api/oauth/verify.ts');
const PERMISSIONS_SRC = read('functions/api/permissions.ts');
const ID_TOKEN_SRC = read('functions/api/oauth/_id_token.ts');
const OPENID_CONFIG_SRC = read('functions/api/oauth/.well-known/openid-configuration.ts');
const VALIDATE_AUTH_SRC = read('src/server/oauth-server/validate-authorize-request.ts');
const HKDF_SRC = read('src/server/hkdf.ts');
const SESSION_SRC = read('src/server/session.ts');
const INVITATION_TOKEN_SRC = read('src/server/invitation-token.ts');
const EMAIL_UTILS_SRC = read('src/server/email-utils.ts');
const INVITATION_ACCEPT_SRC = read('src/server/invitation-accept.ts');
const MIDDLEWARE_SRC = read('functions/api/_middleware.ts');
const VERIFY_PAGE_SRC = read('src/pages/VerifyEmailPage.tsx');
const MAIN_SRC = read('src/entries/main.tsx');

describe('v2.33.59 Step 1 — PUBLIC_ORIGIN env', () => {
  it('Env type 加 PUBLIC_ORIGIN?', () => {
    expect(TYPES_SRC).toMatch(/PUBLIC_ORIGIN\?: string/);
  });

  it('_utils.ts 加 getPublicOrigin helper', () => {
    expect(UTILS_SRC).toMatch(/export function getPublicOrigin/);
    expect(UTILS_SRC).toMatch(/env\.PUBLIC_ORIGIN/);
  });

  it('5 個 callsite 改 getPublicOrigin', () => {
    expect(FORGOT_SRC).toContain('getPublicOrigin(context.env, context.request)');
    expect(SEND_VERIFY_SRC).toContain('getPublicOrigin(context.env, context.request)');
    expect(PERMISSIONS_SRC).toContain('getPublicOrigin(context.env, context.request)');
    // v2.55.85: id_token 改走 getOidcIssuer（= getPublicOrigin + `/api/oauth`
    // 後綴）。本條要守的是「iss 不信 attacker-spoofable 的 Host header」，多一層
    // 間接不影響 —— 但要證明那條鏈確實終結在 getPublicOrigin，否則等於放行。
    expect(ID_TOKEN_SRC).toContain('getOidcIssuer(env, request)');
    expect(UTILS_SRC).toMatch(
      /export function getOidcIssuer[\s\S]{0,200}?getPublicOrigin\(env, request\)/,
    );
  });

  it('5 個 callsite 拔掉 new URL(request.url).origin', () => {
    // 全應換掉，剩餘的只應出現在 getPublicOrigin helper 內部 fallback
    expect(FORGOT_SRC).not.toMatch(/new URL\(context\.request\.url\)\.origin/);
    expect(SEND_VERIFY_SRC).not.toMatch(/new URL\(context\.request\.url\)\.origin/);
    expect(PERMISSIONS_SRC).not.toMatch(/new URL\(context\.request\.url\)\.origin/);
    // v2.55.85 補網：discovery doc 的 issuer 當初漏在這張清單外，一直直接用
    // `new URL(context.request.url).origin` —— 與 _id_token 同一個 Host header
    // 信任問題，卻沒有守門員。現已一併收斂到 getOidcIssuer。
    expect(OPENID_CONFIG_SRC).not.toMatch(/new URL\(context\.request\.url\)\.origin/);
    expect(OPENID_CONFIG_SRC).toContain('getOidcIssuer(context.env, context.request)');
  });
});

describe('v2.33.59 Step 2 — PKCE mandatory (OAuth 2.1)', () => {
  it('PKCE require 不分 client_type', () => {
    expect(VALIDATE_AUTH_SRC).toMatch(/PKCE code_challenge required \(OAuth 2\.1 baseline\)/);
  });

  it('拔掉 confidential client PKCE optional 分支', () => {
    expect(VALIDATE_AUTH_SRC).not.toMatch(/PKCE optional V2-P4/);
  });
});

describe('v2.33.59 Step 3 — HMAC HKDF domain separation', () => {
  it('src/server/hkdf.ts 新增 deriveSubSecret helper', () => {
    expect(HKDF_SRC).toMatch(/export async function deriveSubSecret/);
    expect(HKDF_SRC).toMatch(/'session_v1' \| 'invitation_token_v1'/);
    expect(HKDF_SRC).toMatch(/name: 'HKDF',\s+hash: 'SHA-256'/);
  });

  it('session.ts sign 用 derived sub-secret', () => {
    expect(SESSION_SRC).toMatch(/deriveSubSecret\(secret, 'session_v1'\)/);
  });

  it('session.ts verify 雙路徑 (derived + legacy backward compat)', () => {
    expect(SESSION_SRC).toMatch(/legacySig = await hmacSign\(secret, payloadStr\)/);
  });

  it('invitation-token.ts hash 用 derived (TTL 7d, 無 backward compat)', () => {
    expect(INVITATION_TOKEN_SRC).toMatch(/deriveSubSecret\(secret, 'invitation_token_v1'\)/);
  });
});

describe('v2.33.59 Step 4 — Unicode email NFKC', () => {
  it('src/server/email-utils.ts 新增 normalizeEmail (NFKC + casefold)', () => {
    expect(EMAIL_UTILS_SRC).toMatch(/export function normalizeEmail/);
    expect(EMAIL_UTILS_SRC).toMatch(/\.normalize\('NFKC'\)\.toLowerCase\(\)/);
  });

  it('invitation-accept 用 normalizeEmail 比對 (Unicode-correct)', () => {
    expect(INVITATION_ACCEPT_SRC).toMatch(/normalizeEmail\(user\.email\)/);
    expect(INVITATION_ACCEPT_SRC).toMatch(/normalizeEmail\(invitation\.invited_email\)/);
  });

  it('permissions.ts 用 normalizeEmail (write + lookup)', () => {
    expect(PERMISSIONS_SRC).toMatch(/normalizeEmail\(email\)/);
    expect(PERMISSIONS_SRC).toMatch(/normalizeEmail\(auth\.email\)/);
  });

  it('_middleware.ts 用 normalizeEmail', () => {
    expect(MIDDLEWARE_SRC).toMatch(/normalizeEmail\(userRow\.email\)/);
  });
});

describe('v2.33.59 Step 5 — forgot-password / send-verification waitUntil (anti-enum)', () => {
  it('forgot-password 改 context.waitUntil background send', () => {
    expect(FORGOT_SRC).toMatch(/context\.waitUntil\(\(async/);
    expect(FORGOT_SRC).toContain('return genericResponse;');
  });

  it('send-verification 改 context.waitUntil background send', () => {
    expect(SEND_VERIFY_SRC).toMatch(/context\.waitUntil\(\(async/);
    expect(SEND_VERIFY_SRC).toContain('return genericResponse;');
  });

  it('兩處拔掉 sync EMAIL_SEND_FAILED 500 response', () => {
    expect(FORGOT_SRC).not.toMatch(/status:\s*500.*EMAIL_SEND_FAILED/);
    expect(SEND_VERIFY_SRC).not.toMatch(/status:\s*500.*EMAIL_SEND_FAILED/);
  });
});

describe('v2.33.59 Step 6 — verify endpoint POST + landing page', () => {
  it('verify.ts 加 onRequestPost return JSON', () => {
    expect(VERIFY_SRC).toMatch(/export const onRequestPost: PagesFunction<Env>/);
    expect(VERIFY_SRC).toMatch(/jsonResponse/);
  });

  it('verify.ts onRequestGet 保留 backward compat', () => {
    expect(VERIFY_SRC).toMatch(/export const onRequestGet: PagesFunction<Env>/);
  });

  it('verify.ts 所有 response 加 Referrer-Policy: no-referrer', () => {
    expect(VERIFY_SRC).toMatch(/'Referrer-Policy': 'no-referrer'/);
  });

  it('共用 consume helper (不重複 logic)', () => {
    expect(VERIFY_SRC).toMatch(/async function consumeVerifyToken/);
  });

  it('send-verification verifyUrl 改指 SPA page /auth/verify-email', () => {
    expect(SEND_VERIFY_SRC).toMatch(/\/auth\/verify-email\?token=/);
  });

  it('SPA page VerifyEmailPage.tsx 存在', () => {
    expect(VERIFY_PAGE_SRC).toMatch(/export default function VerifyEmailPage/);
    expect(VERIFY_PAGE_SRC).toContain("method: 'POST'");
  });

  it('VerifyEmailPage no-JS fallback', () => {
    expect(VERIFY_PAGE_SRC).toContain('<noscript>');
    expect(VERIFY_PAGE_SRC).toContain('method="POST"');
  });

  it('v2.33.114: VerifyEmailPage 拔 useEffect auto-POST，require user gesture', () => {
    // 防 enterprise email scanner (Mimecast / Safe Links) headless render
    // 觸發 useEffect → silent consume token。
    expect(VERIFY_PAGE_SRC).not.toMatch(/useEffect\([^)]*performVerify/);
    expect(VERIFY_PAGE_SRC).not.toContain('import { useEffect, useState }');
    expect(VERIFY_PAGE_SRC).toContain("import { useState } from 'react'");
    // idle button + testid 鎖
    expect(VERIFY_PAGE_SRC).toContain('verify-email-confirm-btn');
    expect(VERIFY_PAGE_SRC).toContain('onClick={() => void performVerify()}');
  });

  it('main.tsx 加 route /auth/verify-email', () => {
    expect(MAIN_SRC).toMatch(/path="\/auth\/verify-email"/);
    expect(MAIN_SRC).toMatch(/VerifyEmailPage/);
  });
});
