/**
 * useAccountPreview — GET /api/account 的帳號預覽（單一請求、共用）。
 *
 * 同一份資料有三個使用者：帳號頁的「刪除帳號」確認（影響範圍數字）、帳號頁的「變更密碼」入口
 * （hasPassword）、變更密碼頁的進入守衛（hasPassword）。不要各打各的。
 *
 * - `reload()`：發一次請求（永不 throw，失敗回 null）；用於失敗後的「重試」與刪除確認按需取。
 *   世代遞增，舊請求晚回來也不會覆蓋新的結果（刪除確認取消後重開就是靠這點丟掉舊回應）。
 * - `autoLoad`：掛載時就取一次（旗標關閉的舊入口不需要，由刪除流程 `reload()` 按需取）。
 * - 已載入的預覽由使用者直接讀 `preview`，不重打；`patch()` 就地改它。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '../lib/apiClient';

export interface AccountPreview {
  /** 有 local 密碼身分 → 用密碼確認；純 OAuth → 先完成 Google 重新驗證，再輸入確認字串 */
  hasPassword: boolean;
  reauthProvider: 'google' | null;
  reauthenticated: boolean;
  tripsOwned: number;
  collaboratorsAffected: number;
}

export function isAccountPreview(value: unknown): value is AccountPreview {
  if (!value || typeof value !== 'object') return false;
  const preview = value as Record<string, unknown>;
  return typeof preview.hasPassword === 'boolean'
    && (preview.hasPassword || ((preview.reauthProvider === 'google' || preview.reauthProvider === null)
      && typeof preview.reauthenticated === 'boolean'))
    && typeof preview.tripsOwned === 'number' && Number.isSafeInteger(preview.tripsOwned) && preview.tripsOwned >= 0
    && typeof preview.collaboratorsAffected === 'number' && Number.isSafeInteger(preview.collaboratorsAffected)
    && preview.collaboratorsAffected >= 0;
}

export type AccountPreviewStatus = 'idle' | 'loading' | 'ready' | 'error';

export function useAccountPreview(autoLoad: boolean) {
  const [state, setState] = useState<{ status: AccountPreviewStatus; preview: AccountPreview | null }>(
    { status: 'idle', preview: null },
  );
  const generation = useRef(0);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const reload = useCallback(async (): Promise<AccountPreview | null> => {
    const mine = ++generation.current;
    const current = () => mounted.current && generation.current === mine;
    setState((s) => ({ status: 'loading', preview: s.preview }));
    try {
      const data = await apiFetch<unknown>('/account');
      if (!isAccountPreview(data)) throw new Error('Invalid account preview');
      if (current()) setState({ status: 'ready', preview: data });
      return data;
    } catch {
      if (current()) setState({ status: 'error', preview: null });
      return null;
    }
  }, []);

  const patch = useCallback((fn: (p: AccountPreview) => AccountPreview) => {
    setState((s) => (s.preview ? { ...s, preview: fn(s.preview) } : s));
  }, []);

  useEffect(() => { if (autoLoad) void reload(); }, [autoLoad, reload]);

  return { ...state, reload, patch };
}
