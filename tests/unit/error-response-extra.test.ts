/**
 * functions/api/_errors.ts 的 AppError.extra（AI 資料同意的 AI_CONSENT_* 用）：4xx 把額外欄位放進 error 物件，
 * 5xx 一律不輸出（5xx 的內容可能含內部資訊）；沒帶 extra 的既有錯誤回應形狀不變。
 *
 * Value: protects=extra 只在 4xx 輸出、既有錯誤回應形狀不變; fails_when=拿掉 status<500 判斷讓 5xx 帶出 extra、或 extra 展開成頂層欄位; why_new=ai-data-consent.test 只經 403/409 驗證; seam=none; no_claim=none beyond protects
 */
import { describe, it, expect } from 'vitest';
import { AppError, errorResponse } from '../../functions/api/_errors';

const body = async (e: AppError) => (await errorResponse(e).json()) as { error: Record<string, unknown> };

describe('errorResponse extra', () => {
  it('4xx：extra 的欄位與 code／message 並列在 error 物件內', async () => {
    const b = await body(new AppError('AI_CONSENT_VERSION_MISMATCH', '目前版本是 v1', { currentVersion: 'v1' }));
    expect(b.error).toMatchObject({ code: 'AI_CONSENT_VERSION_MISMATCH', currentVersion: 'v1' });
  });
  it('5xx：不輸出 extra', async () => {
    const e = new AppError('NOTES_AI_APPLY_FAILED', 'd', { secret: 'x' });
    expect(e.status).toBe(500);
    expect((await body(e)).error).not.toHaveProperty('secret');
  });
  it('沒有 extra 的錯誤：形狀不變（只有 code／message／detail）', async () => {
    const b = await body(new AppError('PERM_DENIED', '無權限'));
    expect(Object.keys(b.error).sort()).toEqual(['code', 'detail', 'message']);
  });
});
