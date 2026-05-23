/**
 * errors-detail-cap.test.ts — v2.33.36 security audit round 1
 *
 * ApiError.detail 應 cap 在 200 char 且 strip newline，避免 backend 意外 leak
 * SQL fragment / stack trace / 其他 user 的 email 等長文 propagate 到 Toast UI。
 */
import { describe, it, expect } from 'vitest';
import { ApiError } from '../../src/lib/errors';

describe('ApiError — v2.33.36 detail length cap', () => {
  it('truncates detail > 200 chars', () => {
    const long = 'x'.repeat(500);
    const err = new ApiError('SYS_INTERNAL', 500, long);
    expect(err.detail?.length).toBe(200);
  });

  it('keeps detail ≤ 200 chars unchanged', () => {
    const short = 'short';
    const err = new ApiError('SYS_INTERNAL', 500, short);
    expect(err.detail).toBe('short');
  });

  it('strips newlines (CR / LF) in detail', () => {
    const err = new ApiError('SYS_INTERNAL', 500, 'line1\nline2\r\nline3');
    expect(err.detail).toBe('line1 line2 line3');
  });

  it('preserves undefined detail', () => {
    const err = new ApiError('AUTH_REQUIRED', 401);
    expect(err.detail).toBeUndefined();
  });
});
