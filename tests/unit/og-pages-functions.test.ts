/**
 * functions/s/[token].ts、functions/trip/[[path]].ts 抽出共用部分後的行為守門（#1627）：
 * 無效 token／不存在的行程不得 500，要回原 shell／404 HTML。
 */
import { describe, expect, it, vi } from 'vitest';
import { onRequestGet as shareGet } from '../../functions/s/[token]';
import { onRequestGet as tripGet } from '../../functions/trip/[[path]]';
import { hashToken, isValidShareToken } from '../../functions/_shared/share';

const SHELL = '<html><head><title>Tripline</title></head></html>';
const assets = { fetch: vi.fn(async () => new Response(SHELL)) };

function dbReturning(first: unknown) {
  const stmt = { bind: vi.fn(() => stmt), first: vi.fn(async () => first), all: vi.fn(async () => ({ results: [] })) };
  return { prepare: vi.fn(() => stmt) };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ctx = (url: string, params: any, db: any): any => ({ request: new Request(url), params, env: { DB: db, ASSETS: assets } });

describe('/s/:token', () => {
  it('格式不合的 token 不查 DB，回原 shell（200）', async () => {
    const db = dbReturning(null);
    const res = await shareGet(ctx('https://x.test/s/bad', { token: 'bad' }, db));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe(SHELL);
    expect(db.prepare).not.toHaveBeenCalled();
  });

  it('格式合法但查無（或撤銷）的 token 回原 shell，不是 500', async () => {
    const token = 'A'.repeat(32);
    const db = dbReturning(null);
    const res = await shareGet(ctx(`https://x.test/s/${token}`, { token }, db));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe(SHELL);
    expect(db.prepare).toHaveBeenCalled();
  });

  it('已撤銷的 share 回原 shell', async () => {
    const token = 'B'.repeat(32);
    const db = dbReturning({ trip_id: 't', revoked_at: '2026-01-01', expires_at: null });
    const res = await shareGet(ctx(`https://x.test/s/${token}`, { token }, db));
    expect(await res.text()).toBe(SHELL);
  });

  it('DB 丟錯也 fall through 回 shell', async () => {
    const token = 'C'.repeat(32);
    const db = { prepare: () => { throw new Error('boom'); } };
    const res = await shareGet(ctx(`https://x.test/s/${token}`, { token }, db));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe(SHELL);
  });
});

describe('/trip/*', () => {
  it('查無行程回 404 HTML', async () => {
    const res = await tripGet(ctx('https://x.test/trip/nope', {}, dbReturning(null)));
    expect(res.status).toBe(404);
    expect(res.headers.get('Content-Type')).toContain('text/html');
  });

  it('沒有 tripId 回 404 HTML（不查 DB）', async () => {
    const db = dbReturning(null);
    const res = await tripGet(ctx('https://x.test/trip/', {}, db));
    expect(res.status).toBe(404);
    expect(db.prepare).not.toHaveBeenCalled();
  });
});

describe('_shared/share', () => {
  it('isValidShareToken 只收 20–64 個 URL-safe 字元', () => {
    expect(isValidShareToken('a'.repeat(19))).toBe(false);
    expect(isValidShareToken('a'.repeat(20))).toBe(true);
    expect(isValidShareToken('a'.repeat(65))).toBe(false);
    expect(isValidShareToken('a'.repeat(19) + '!')).toBe(false);
  });

  it('hashToken 是 SHA-256 hex（與 DB 內存的 token_hash 一致）', async () => {
    expect(await hashToken('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});
