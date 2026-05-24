/**
 * validate-redirect-uris.test.ts — OAuth client redirect_uri allowlist validator
 * v2.33.58 round 12b: HIGH ZERO_COVERAGE fill — 之前只在 dev-apps endpoint
 * test 內 indirect 測 1 個 case，本檔覆蓋 scheme bypass / boundary / 新增
 * fragment/userinfo/query 拒。
 */
import { describe, it, expect } from 'vitest';
import {
  validateRedirectUris,
  REDIRECT_URIS_MAX,
} from '../../src/server/oauth-server/validate-redirect-uris';
import { AppError } from '../../functions/api/_errors';

/**
 * AppError.message 是 user-friendly localized 字串（'資料格式不正確'）。
 * 詳細原因在 `detail`。helper 包 try/catch 抽 detail 比對。
 */
function expectThrowWithDetail(fn: () => unknown, pattern: RegExp): void {
  let err: unknown;
  try { fn(); } catch (e) { err = e; }
  expect(err).toBeInstanceOf(AppError);
  const detail = (err as AppError).detail ?? '';
  expect(detail).toMatch(pattern);
}

describe('validateRedirectUris — happy path', () => {
  it('接受 https URL', () => {
    expect(validateRedirectUris(['https://example.com/callback'])).toEqual([
      'https://example.com/callback',
    ]);
  });

  it('接受 http://localhost (dev)', () => {
    expect(validateRedirectUris(['http://localhost:3000/callback'])).toEqual([
      'http://localhost:3000/callback',
    ]);
  });

  it('接受 http://127.0.0.1 (dev)', () => {
    expect(validateRedirectUris(['http://127.0.0.1:8080/cb'])).toEqual([
      'http://127.0.0.1:8080/cb',
    ]);
  });

  it('接受多個 URL', () => {
    const input = ['https://a.com/cb', 'https://b.com/cb'];
    expect(validateRedirectUris(input)).toEqual(input);
  });
});

describe('validateRedirectUris — scheme bypass defense', () => {
  it('拒 javascript: URI', () => {
    expectThrowWithDetail(() => validateRedirectUris(['javascript:alert(1)']), /HTTPS/);
  });

  it('拒 data: URI', () => {
    expectThrowWithDetail(() => validateRedirectUris(['data:text/html,<script>alert(1)</script>']), /HTTPS/);
  });

  it('拒 file: URI', () => {
    expectThrowWithDetail(() => validateRedirectUris(['file:///etc/passwd']), /HTTPS/);
  });

  it('拒 ftp: URI', () => {
    expectThrowWithDetail(() => validateRedirectUris(['ftp://example.com/']), /HTTPS/);
  });

  it('拒非 localhost 的 http://', () => {
    expectThrowWithDetail(() => validateRedirectUris(['http://attacker.com/cb']), /HTTPS/);
  });
});

describe('validateRedirectUris — v2.33.58 H1 component bypass', () => {
  it('拒 #fragment (open-redirect via fragment-handling clients)', () => {
    expectThrowWithDetail(() => validateRedirectUris(['https://example.com/cb#evil']), /fragment/);
  });

  it('拒 userinfo (parser confusion bypass)', () => {
    expectThrowWithDetail(() => validateRedirectUris(['https://user:pass@example.com/cb']), /userinfo/);
  });

  it('拒 ?query (OAuth 2.1 baseline)', () => {
    expectThrowWithDetail(() => validateRedirectUris(['https://example.com/cb?param=x']), /query/);
  });
});

describe('validateRedirectUris — boundary + format', () => {
  it('拒空 array', () => {
    expectThrowWithDetail(() => validateRedirectUris([]), /至少 1 個/);
  });

  it('拒 non-array', () => {
    expectThrowWithDetail(() => validateRedirectUris(null), /至少 1 個/);
    expectThrowWithDetail(() => validateRedirectUris('string-not-array'), /至少 1 個/);
  });

  it(`拒 > ${REDIRECT_URIS_MAX} entries`, () => {
    const tooMany = Array.from({ length: REDIRECT_URIS_MAX + 1 }, (_, i) =>
      `https://example.com/cb${i}`,
    );
    expectThrowWithDetail(() => validateRedirectUris(tooMany), /最多/);
  });

  it(`接受剛好 ${REDIRECT_URIS_MAX} entries (邊界值)`, () => {
    const max = Array.from({ length: REDIRECT_URIS_MAX }, (_, i) =>
      `https://example.com/cb${i}`,
    );
    expect(validateRedirectUris(max)).toEqual(max);
  });

  it('拒空字串 entry', () => {
    expectThrowWithDetail(() => validateRedirectUris(['']), /格式無效/);
  });

  it('拒非字串 entry', () => {
    expectThrowWithDetail(() => validateRedirectUris([123]), /格式無效/);
    expectThrowWithDetail(() => validateRedirectUris([null]), /格式無效/);
  });

  it('拒無法 parse 的 URL', () => {
    expectThrowWithDetail(() => validateRedirectUris(['not a url']), /不是合法 URL/);
  });
});
