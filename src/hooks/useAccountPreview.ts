/**
 * useAccountPreview — GET /api/account 的帳號預覽（單一請求、共用）。
 *
 * 同一份資料有三個使用者：帳號頁的「刪除帳號」確認（影響範圍數字）、帳號頁的「變更密碼」入口
 * （hasPassword）、變更密碼頁的進入守衛（hasPassword）。不要各打各的。
 *
 * - `reload()`：發一次請求（永不 throw，失敗回 null）；已有進行中的請求就回同一個 promise（去重）。
 *   失敗時保留既有 preview（status=error），暫時性的重試失敗不該讓已知的 hasPassword 消失。
 * - `autoLoad`：掛載時就取一次（呼叫端傳 `!!user`，登入還原前不打請求）。
 * - 刪除確認要自己判斷預覽是否「剛取到」（status==='ready'）；`patch()` 就地改已載入的預覽。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { typedApi, unwrap } from '../lib/api/typed';
import { isAccountPreview, type AccountPreview } from '../types/account';

export type AccountPreviewStatus = 'idle' | 'loading' | 'ready' | 'error';

export function useAccountPreview(autoLoad: boolean) {
  const [state, setState] = useState<{ status: AccountPreviewStatus; preview: AccountPreview | null }>(
    { status: 'idle', preview: null },
  );
  const inflight = useRef<Promise<AccountPreview | null> | null>(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const reload = useCallback((): Promise<AccountPreview | null> => {
    if (inflight.current) return inflight.current;
    setState((s) => ({ status: 'loading', preview: s.preview }));
    const p = (async () => {
      try {
        const data = unwrap(await typedApi.get('/api/account')) as unknown;
        if (!isAccountPreview(data)) throw new Error('Invalid account preview');
        if (mounted.current) setState({ status: 'ready', preview: data });
        return data;
      } catch {
        if (mounted.current) setState((s) => ({ status: 'error', preview: s.preview }));
        return null;
      } finally {
        inflight.current = null;
      }
    })();
    inflight.current = p;
    return p;
  }, []);

  const patch = useCallback((fn: (p: AccountPreview) => AccountPreview) => {
    setState((s) => (s.preview ? { ...s, preview: fn(s.preview) } : s));
  }, []);

  useEffect(() => { if (autoLoad) void reload(); }, [autoLoad, reload]);

  return { ...state, reload, patch };
}
