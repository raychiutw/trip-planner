/**
 * AiAuthorizeCard — 「開啟新 trip」流程的就地 AI 授權卡（Phase 2 V1，mockup:
 * docs/design-sessions/2026-07-11-tp-request-consent-trigger.html）。
 *
 * owner 就地授權 Tripline AI（tp-request）以自己身分排行程 —— Approach B 直接授權：
 * 按鈕 → POST /api/account/ai-authorization 建立 Consent grant，不離開建立流程、不跑 OAuth
 * redirect dance。撤銷走「帳號設定 → 已連結應用」（DELETE connected-apps/tripline-tp-request）。
 *
 * 狀態：載入中（null，只顯 header）→ 未授權（顯「授權 AI」鈕）→ 已授權（顯綠色確認）。
 * 讀取失敗當未授權處理（顯授權鈕、不卡建立流程）。
 */
import { useEffect, useState } from 'react';
import { apiFetch } from '../lib/apiClient';

// 對應 mockup V1 的 .ai-card；mockup 的 --accent/--sage/--radius 映射到 tokens.css 真值：
// --accent→--color-accent、--sage-subtle/-deep→--color-accent-2-subtle/-deep、--radius→--radius-xl。
const SCOPED_STYLES = `
.tp-ai-card { border-radius: var(--radius-xl); padding: 16px; background: var(--color-accent-subtle); }
.tp-ai-card__row { display: flex; gap: 12px; align-items: flex-start; }
.tp-ai-card__badge {
  flex: none; width: 38px; height: 38px; border-radius: var(--radius-lg);
  background: var(--color-accent); color: var(--color-accent-foreground);
  display: flex; align-items: center; justify-content: center;
}
.tp-ai-card__title { font-size: 15px; font-weight: 700; color: var(--color-foreground); }
.tp-ai-card__desc { font-size: 13px; color: var(--color-muted); margin-top: 3px; }
.tp-ai-card__on {
  display: flex; align-items: center; gap: 8px; margin-top: 12px;
  background: var(--color-accent-2-subtle); color: var(--color-accent-2-deep);
  border-radius: var(--radius-lg); padding: 10px 12px; font-size: 13px; font-weight: 600;
}
.tp-ai-card__btn {
  margin-top: 12px; width: 100%; min-height: 44px; border: none; border-radius: var(--radius-lg);
  background: var(--color-accent); color: var(--color-accent-foreground);
  font-size: 14px; font-weight: 600; cursor: pointer;
}
.tp-ai-card__btn:disabled { opacity: 0.6; cursor: default; }
.tp-ai-card__err { margin-top: 8px; font-size: 12px; color: var(--color-accent-3-deep); }
`;

export default function AiAuthorizeCard() {
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch<{ authorized: boolean }>('/account/ai-authorization')
      .then((r) => {
        if (!cancelled) setAuthorized(r.authorized);
      })
      .catch(() => {
        // 讀狀態失敗 → 當未授權（顯授權鈕），不卡建立行程流程。
        if (!cancelled) setAuthorized(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function authorize() {
    setBusy(true);
    setError(null);
    try {
      const r = await apiFetch<{ authorized: boolean }>('/account/ai-authorization', { method: 'POST' });
      setAuthorized(r.authorized);
    } catch {
      setError('授權失敗，請稍後再試。');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="tp-ai-card" data-testid="ai-authorize-card">
      <style>{SCOPED_STYLES}</style>
      <div className="tp-ai-card__row">
        <div className="tp-ai-card__badge" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2l1.9 4.6L18.5 8l-4.6 1.9L12 14l-1.9-4.1L5.5 8l4.6-1.4L12 2z" />
            <circle cx="18" cy="17" r="2.4" />
          </svg>
        </div>
        <div>
          <h4 className="tp-ai-card__title">讓 AI 幫你把行程填滿</h4>
          <p className="tp-ai-card__desc">授權一次，AI 就能以你的身分安排景點、餐廳、交通。</p>
        </div>
      </div>

      {authorized === true && (
        <div className="tp-ai-card__on" data-testid="ai-authorize-on">
          <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.7-9.3a1 1 0 00-1.4-1.4L9 10.6 7.7 9.3a1 1 0 10-1.4 1.4l2 2a1 1 0 001.4 0l4-4z"
            />
          </svg>
          已授權 · 可隨時在「已連結應用」撤銷
        </div>
      )}

      {authorized === false && (
        <button
          type="button"
          className="tp-ai-card__btn"
          onClick={authorize}
          disabled={busy}
          data-testid="ai-authorize-btn"
        >
          {busy ? '授權中⋯' : '授權 AI'}
        </button>
      )}

      {error && (
        <p className="tp-ai-card__err" data-testid="ai-authorize-error">
          {error}
        </p>
      )}
    </div>
  );
}
