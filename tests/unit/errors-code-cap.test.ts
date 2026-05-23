/**
 * errors-code-cap.test.ts — v2.33.38 round 3 LOW finding
 *
 * `ApiError.code` 同樣需 cap 在合理長度，防 malicious server 回 giant code
 * 串字。Also verify sniffErrorCode 改 anchored pattern 不再 false-positive
 * 「已系統管理員處理過」這類非權限訊息。
 */
import { describe, it, expect } from 'vitest';
import { ApiError } from '../../src/lib/errors';

describe('ApiError — code length cap (v2.33.38 round 3)', () => {
  it('cap code > 64 chars', () => {
    const huge = 'AUTH_'.repeat(100);
    // @ts-expect-error - intentionally bypass ErrorCodeType to test runtime cap
    const err = new ApiError(huge, 401);
    expect(err.code.length).toBeLessThanOrEqual(64);
  });

  it('preserves short canonical code', () => {
    const err = new ApiError('AUTH_REQUIRED', 401);
    expect(err.code).toBe('AUTH_REQUIRED');
  });
});

describe('sniffErrorCode — anchored pattern (v2.33.38 round 3)', () => {
  // sniffErrorCode 不 export，透過 fromResponse legacy path 觸發。
  async function makeErr(status: number, body: string): Promise<ApiError> {
    const res = new Response(JSON.stringify({ error: body }), { status });
    return ApiError.fromResponse(res);
  }

  it('「僅限管理員」→ PERM_ADMIN_ONLY', async () => {
    const e = await makeErr(403, '僅限管理員存取');
    expect(e.code).toBe('PERM_ADMIN_ONLY');
  });

  it('「administered by」NOT a false-positive (was hit by old includes("admin"))', async () => {
    const e = await makeErr(400, 'managed and administered by user X');
    expect(e.code).not.toBe('PERM_ADMIN_ONLY');
  });

  it('「權限不足」→ PERM_DENIED', async () => {
    const e = await makeErr(403, '權限不足');
    expect(e.code).toBe('PERM_DENIED');
  });

  it('「forbidden」→ PERM_DENIED', async () => {
    const e = await makeErr(403, 'Forbidden access');
    expect(e.code).toBe('PERM_DENIED');
  });

  it('「已存在」→ DATA_CONFLICT', async () => {
    const e = await makeErr(409, '行程已存在');
    expect(e.code).toBe('DATA_CONFLICT');
  });

  it('「encoding」→ DATA_ENCODING', async () => {
    const e = await makeErr(400, 'UTF-8 encoding error');
    expect(e.code).toBe('DATA_ENCODING');
  });

  it('「亂碼」→ DATA_ENCODING', async () => {
    const e = await makeErr(400, '檔名亂碼無法處理');
    expect(e.code).toBe('DATA_ENCODING');
  });

  it('unmatched message falls back to statusToCode', async () => {
    const e = await makeErr(500, '一般錯誤');
    expect(e.code).toBe('SYS_INTERNAL');
  });
});
