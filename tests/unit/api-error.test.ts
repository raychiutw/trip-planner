/**
 * 前端 ApiError 測試 — 解析新舊格式 + 網路錯誤 + severity mapping
 */
import { describe, it, expect } from 'vitest';
import { ApiError } from '../../src/lib/errors';

describe('ApiError.fromResponse', () => {
  it('新格式：解析 { error: { code, message, detail } }', async () => {
    const res = new Response(JSON.stringify({
      error: { code: 'DATA_NOT_FOUND', message: '找不到', detail: 'trip-abc' },
    }), { status: 404 });
    const err = await ApiError.fromResponse(res);
    expect(err.code).toBe('DATA_NOT_FOUND');
    expect(err.status).toBe(404);
    expect(err.detail).toBe('trip-abc');
    expect(err.severity).toBe('severe');
  });

  it('舊格式：解析 { error: "string" }', async () => {
    const res = new Response(JSON.stringify({ error: '權限不足' }), { status: 403 });
    const err = await ApiError.fromResponse(res);
    expect(err.code).toBe('PERM_DENIED');
    expect(err.status).toBe(403);
  });

  it('舊格式 encoding sniff', async () => {
    const res = new Response(JSON.stringify({ error: '文字 encoding 有誤' }), { status: 400 });
    const err = await ApiError.fromResponse(res);
    expect(err.code).toBe('DATA_ENCODING');
  });

  it('舊格式 admin sniff', async () => {
    const res = new Response(JSON.stringify({ error: '僅管理者可操作' }), { status: 403 });
    const err = await ApiError.fromResponse(res);
    expect(err.code).toBe('PERM_ADMIN_ONLY');
  });

  it('無法解析 body → fallback to status code', async () => {
    const res = new Response('not json', { status: 500 });
    const err = await ApiError.fromResponse(res);
    expect(err.code).toBe('SYS_INTERNAL');
  });

  it('401 → AUTH_REQUIRED', async () => {
    const res = new Response(JSON.stringify({}), { status: 401 });
    const err = await ApiError.fromResponse(res);
    expect(err.code).toBe('AUTH_REQUIRED');
  });

  it('429 → SYS_RATE_LIMIT', async () => {
    const res = new Response(JSON.stringify({}), { status: 429 });
    const err = await ApiError.fromResponse(res);
    expect(err.code).toBe('SYS_RATE_LIMIT');
  });
});

describe('ApiError.fromNetworkError', () => {
  it('AbortError → NET_TIMEOUT', () => {
    const err = ApiError.fromNetworkError(new DOMException('aborted', 'AbortError'));
    expect(err.code).toBe('NET_TIMEOUT');
    expect(err.severity).toBe('background');
  });

  it('TypeError → NET_TIMEOUT (default)', () => {
    const err = ApiError.fromNetworkError(new TypeError('Failed to fetch'));
    expect(err.code).toBe('NET_TIMEOUT');
  });
});

describe('severity mapping', () => {
  it('NET_* → background', async () => {
    expect(new ApiError('NET_OFFLINE', 0).severity).toBe('background');
  });

  it('SYS_* → severe', () => {
    expect(new ApiError('SYS_INTERNAL', 500).severity).toBe('severe');
  });

  it('AUTH_* → moderate', () => {
    expect(new ApiError('AUTH_REQUIRED', 401).severity).toBe('moderate');
  });

  it('DATA_VALIDATION → minor', () => {
    expect(new ApiError('DATA_VALIDATION', 400).severity).toBe('minor');
  });

  it('429 帶 Retry-After：保存等待秒數（新舊格式都要）', async () => {
    const newFmt = new Response(JSON.stringify({ error: { code: 'CHANGE_PASSWORD_RATE_LIMITED' } }), { status: 429, headers: { 'Retry-After': '1800' } });
    expect((await ApiError.fromResponse(newFmt)).retryAfter).toBe(1800);
    const oldFmt = new Response(JSON.stringify({ error: '太頻繁' }), { status: 429, headers: { 'Retry-After': '30' } });
    expect((await ApiError.fromResponse(oldFmt)).retryAfter).toBe(30);
    const notJson = new Response('oops', { status: 429, headers: { 'Retry-After': '60' } });
    expect((await ApiError.fromResponse(notJson)).retryAfter).toBe(60);
  });

  it('沒有 Retry-After 或不是正整數秒：retryAfter 為 undefined', async () => {
    for (const headers of [{}, { 'Retry-After': 'abc' }, { 'Retry-After': '0' }, { 'Retry-After': '-5' }] as Record<string, string>[]) {
      const err = await ApiError.fromResponse(new Response('{}', { status: 429, headers }));
      expect(err.retryAfter).toBeUndefined();
    }
  });

  it('DATA_NOT_FOUND → severe', () => {
    expect(new ApiError('DATA_NOT_FOUND', 404).severity).toBe('severe');
  });
});
