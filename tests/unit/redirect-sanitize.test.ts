/**
 * redirect-sanitize.test.ts — v2.33.39 round 4 security audit
 *
 * sanitizeRedirectAfter 集中守 OAuth `?redirect_after=` 變形 open-redirect。
 * 對齊 `safeReturnTo` in `routes.ts`（後者較寬，本檔嚴格用於 OAuth flow）。
 */
import { describe, it, expect } from 'vitest';
import { sanitizeRedirectAfter } from '../../src/lib/redirect';

describe('sanitizeRedirectAfter — safe same-origin paths', () => {
  it('accepts simple absolute path', () => {
    expect(sanitizeRedirectAfter('/trips')).toBe('/trips');
  });

  it('accepts path with query string', () => {
    expect(sanitizeRedirectAfter('/trips?selected=abc')).toBe('/trips?selected=abc');
  });

  it('accepts path with hash', () => {
    expect(sanitizeRedirectAfter('/trip/abc#day3')).toBe('/trip/abc#day3');
  });
});

describe('sanitizeRedirectAfter — open-redirect rejection', () => {
  it('rejects protocol-relative `//evil`', () => {
    expect(sanitizeRedirectAfter('//evil.com')).toBeNull();
    expect(sanitizeRedirectAfter('//evil.com/path')).toBeNull();
  });

  it('rejects absolute URL', () => {
    expect(sanitizeRedirectAfter('https://evil.com')).toBeNull();
    expect(sanitizeRedirectAfter('http://x.y')).toBeNull();
    expect(sanitizeRedirectAfter('javascript:alert(1)')).toBeNull();
  });

  it('rejects backslash variants (Safari open-redirect history)', () => {
    expect(sanitizeRedirectAfter('/\\evil.com')).toBeNull();
    expect(sanitizeRedirectAfter('/path\\backslash')).toBeNull();
  });

  it('rejects URL-encoded slash bypass `/%2f%2fevil`', () => {
    expect(sanitizeRedirectAfter('/%2f%2fevil.com')).toBeNull();
    expect(sanitizeRedirectAfter('/%2F%2Fevil.com')).toBeNull();
  });

  it('rejects URL-encoded backslash `/%5cevil`', () => {
    expect(sanitizeRedirectAfter('/%5cevil.com')).toBeNull();
  });

  it('rejects whitespace-prefixed `  //evil` (browser strips before nav)', () => {
    expect(sanitizeRedirectAfter('  //evil.com')).toBeNull();
    expect(sanitizeRedirectAfter('\t//evil.com')).toBeNull();
    expect(sanitizeRedirectAfter(' /trips')).toBeNull();
  });

  it('rejects relative path (must start with /)', () => {
    expect(sanitizeRedirectAfter('trip/abc')).toBeNull();
    expect(sanitizeRedirectAfter('./x')).toBeNull();
    expect(sanitizeRedirectAfter('../etc')).toBeNull();
  });

  it('rejects empty / non-string / null / undefined', () => {
    expect(sanitizeRedirectAfter('')).toBeNull();
    expect(sanitizeRedirectAfter(null)).toBeNull();
    expect(sanitizeRedirectAfter(undefined)).toBeNull();
    expect(sanitizeRedirectAfter(42)).toBeNull();
    expect(sanitizeRedirectAfter({})).toBeNull();
  });
});
