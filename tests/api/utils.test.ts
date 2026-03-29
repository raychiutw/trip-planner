/**
 * 純函式測試 — _utils.ts
 */
import { describe, it, expect } from 'vitest';
import { json, parseIntParam, buildUpdateClause, getAuth, ANONYMOUS_USER } from '../../functions/api/_utils';

describe('json', () => {
  it('回傳 JSON Response', async () => {
    const resp = json({ ok: true });
    expect(resp.status).toBe(200);
    expect(resp.headers.get('Content-Type')).toBe('application/json');
    expect(await resp.json()).toEqual({ ok: true });
  });

  it('自訂 status', async () => {
    const resp = json({ error: 'bad' }, 400);
    expect(resp.status).toBe(400);
  });
});

describe('parseIntParam', () => {
  it('正整數', () => expect(parseIntParam('42')).toBe(42));
  it('0 → null', () => expect(parseIntParam('0')).toBeNull());
  it('負數 → null', () => expect(parseIntParam('-1')).toBeNull());
  it('小數 → null', () => expect(parseIntParam('1.5')).toBeNull());
  it('字串 → null', () => expect(parseIntParam('abc')).toBeNull());
  it('空字串 → null', () => expect(parseIntParam('')).toBeNull());
});

describe('buildUpdateClause', () => {
  const allowed = ['title', 'description', 'note'] as const;

  it('建立 UPDATE clause', () => {
    const result = buildUpdateClause({ title: 'new', note: 'hi' }, allowed);
    expect(result).not.toBeNull();
    expect(result!.fields).toEqual(['title', 'note']);
    expect(result!.setClauses).toContain('title = ?');
    expect(result!.setClauses).toContain('note = ?');
    expect(result!.setClauses).toContain('updated_at = CURRENT_TIMESTAMP');
    expect(result!.values).toEqual(['new', 'hi']);
  });

  it('忽略不在白名單的欄位', () => {
    const result = buildUpdateClause({ title: 'new', evil: 'inject' }, allowed);
    expect(result!.fields).toEqual(['title']);
  });

  it('全部欄位都不在白名單 → null', () => {
    expect(buildUpdateClause({ evil: 'inject' }, allowed)).toBeNull();
  });

  it('空 body → null', () => {
    expect(buildUpdateClause({}, allowed)).toBeNull();
  });
});

describe('getAuth', () => {
  it('有 auth → 回傳', () => {
    const auth = { email: 'a@b.com', isAdmin: false, isServiceToken: false };
    expect(getAuth({ data: { auth } })).toEqual(auth);
  });

  it('無 auth → null', () => {
    expect(getAuth({ data: {} })).toBeNull();
  });

  it('data 為 null → null', () => {
    expect(getAuth({ data: null })).toBeNull();
  });
});

describe('ANONYMOUS_USER', () => {
  it('值為 anonymous', () => {
    expect(ANONYMOUS_USER).toBe('anonymous');
  });
});
