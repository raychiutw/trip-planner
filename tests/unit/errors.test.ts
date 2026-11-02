/**
 * 純函式測試 — _errors.ts AppError + errorResponse
 */
import { describe, it, expect } from 'vitest';
import { AppError, errorResponse } from '../../functions/api/_errors';

describe('AppError', () => {
  it('AUTH_REQUIRED → 401', () => {
    const err = new AppError('AUTH_REQUIRED');
    expect(err.code).toBe('AUTH_REQUIRED');
    expect(err.status).toBe(401);
    expect(err.message).toBe('請先登入');
  });

  it('PERM_DENIED → 403', () => {
    const err = new AppError('PERM_DENIED');
    expect(err.status).toBe(403);
  });

  it('DATA_NOT_FOUND → 404', () => {
    const err = new AppError('DATA_NOT_FOUND');
    expect(err.status).toBe(404);
  });

  it('DATA_VALIDATION → 400 + detail', () => {
    const err = new AppError('DATA_VALIDATION', '缺少 title');
    expect(err.status).toBe(400);
    expect(err.detail).toBe('缺少 title');
  });

  it('DATA_CONFLICT → 409', () => {
    expect(new AppError('DATA_CONFLICT').status).toBe(409);
  });

  it('SYS_INTERNAL → 500', () => {
    expect(new AppError('SYS_INTERNAL').status).toBe(500);
  });

  it('SYS_DB_ERROR → 503', () => {
    expect(new AppError('SYS_DB_ERROR').status).toBe(503);
  });

  it('SYS_RATE_LIMIT → 429', () => {
    expect(new AppError('SYS_RATE_LIMIT').status).toBe(429);
  });

  it('instanceof Error', () => {
    expect(new AppError('SYS_INTERNAL')).toBeInstanceOf(Error);
  });
});

describe('errorResponse', () => {
  it('回傳結構化 JSON Response', async () => {
    const err = new AppError('DATA_NOT_FOUND', '行程不存在');
    const resp = errorResponse(err);
    expect(resp.status).toBe(404);
    expect(resp.headers.get('Content-Type')).toBe('application/json');
    const body = await resp.json() as { error: { code: string; message: string; detail: string } };
    expect(body.error.code).toBe('DATA_NOT_FOUND');
    expect(body.error.message).toBe('找不到這筆資料');
    expect(body.error.detail).toBe('行程不存在');
  });

  it('無 detail 時不含 detail 欄位', async () => {
    const resp = errorResponse(new AppError('AUTH_REQUIRED'));
    const body = await resp.json() as { error: Record<string, unknown> };
    expect(body.error.detail).toBeUndefined();
  });
});
