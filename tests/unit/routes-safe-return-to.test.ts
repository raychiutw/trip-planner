/**
 * routes-safe-return-to.test.ts — v2.33.38 round 3 LOW finding
 *
 * `safeReturnTo` 集中 redirect target 驗證，避免 open-redirect 攻擊。
 * future callers (`?returnTo=` / `?next=` 等) 應全部走這個 helper。
 */
import { describe, it, expect } from 'vitest';
import { safeReturnTo } from '../../src/lib/routes';

describe('safeReturnTo', () => {
  it('accepts same-origin absolute path', () => {
    expect(safeReturnTo('/trip/abc')).toBe('/trip/abc');
    expect(safeReturnTo('/favorites?q=x')).toBe('/favorites?q=x');
    expect(safeReturnTo('/chat#msg')).toBe('/chat#msg');
  });

  it('rejects protocol-relative `//evil.com`', () => {
    expect(safeReturnTo('//evil.com')).toBe('/trips');
    expect(safeReturnTo('//evil.com/path')).toBe('/trips');
  });

  it('rejects absolute URL', () => {
    expect(safeReturnTo('https://evil.com')).toBe('/trips');
    expect(safeReturnTo('http://x.y')).toBe('/trips');
    expect(safeReturnTo('javascript:alert(1)')).toBe('/trips');
  });

  it('rejects backslash variants (Safari open-redirect history)', () => {
    expect(safeReturnTo('/\\\\evil.com')).toBe('/trips');
    expect(safeReturnTo('/path\\backslash')).toBe('/trips');
  });

  it('rejects relative path (must start with /)', () => {
    expect(safeReturnTo('trip/abc')).toBe('/trips');
    expect(safeReturnTo('./x')).toBe('/trips');
    expect(safeReturnTo('../etc')).toBe('/trips');
  });

  it('rejects empty / non-string / null / undefined', () => {
    expect(safeReturnTo('')).toBe('/trips');
    expect(safeReturnTo(null)).toBe('/trips');
    expect(safeReturnTo(undefined)).toBe('/trips');
    expect(safeReturnTo(42)).toBe('/trips');
    expect(safeReturnTo({})).toBe('/trips');
  });

  it('respects custom fallback', () => {
    expect(safeReturnTo('//evil', '/login')).toBe('/login');
    expect(safeReturnTo(null, '/explore')).toBe('/explore');
  });
});
