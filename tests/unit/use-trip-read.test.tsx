/**
 * 行程讀取 hooks（src/hooks/useTripRead.ts）：useTripMeta、useTripDays。
 *
 * 以前 5 個頁面各抄一份「let cancelled = false → apiFetch → setState → catch 退成空值」，
 * /trips/:id 讀 5 份、/days 讀 4 份。競態（換行程時舊回應晚到）與失敗退回空值的政策現在只寫在這裡。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const apiFetch = vi.fn();
vi.mock('../../src/lib/apiClient', () => ({ apiFetch: (...a: unknown[]) => apiFetch(...a) }));

import { useTripMeta, useTripDays } from '../../src/hooks/useTripRead';

beforeEach(() => { apiFetch.mockReset(); });

function deferred<T>() {
  let resolve!: (v: T) => void; let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

describe('useTripMeta', () => {
  it('載入中 → ready，帶回 meta；URL 會 encode', async () => {
    apiFetch.mockResolvedValue({ name: 'n', destinations: [{ name: 'Tokyo' }] });
    const { result } = renderHook(() => useTripMeta('a b'));
    expect(result.current).toMatchObject({ status: 'loading', data: null });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.data).toMatchObject({ name: 'n' });
    expect(apiFetch).toHaveBeenCalledWith('/trips/a%20b');
  });

  it('失敗 → status error、data null（呼叫端自己決定退回什麼空值），不丟錯', async () => {
    apiFetch.mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => useTripMeta('t'));
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.data).toBeNull();
  });

  it('enabled=false 或沒有 tripId → 不發請求，status idle', () => {
    const { result: a } = renderHook(() => useTripMeta('t', false));
    const { result: b } = renderHook(() => useTripMeta(undefined));
    expect(apiFetch).not.toHaveBeenCalled();
    expect(a.current.status).toBe('idle');
    expect(b.current.status).toBe('idle');
  });

  it('換行程時舊行程晚到的回應不會蓋掉新行程，且換行程當下不殘留舊資料', async () => {
    const first = deferred<{ name: string }>();
    const second = deferred<{ name: string }>();
    apiFetch.mockImplementation((path: string) => (path === '/trips/A' ? first.promise : second.promise));
    const { result, rerender } = renderHook(({ id }) => useTripMeta(id), { initialProps: { id: 'A' } });
    rerender({ id: 'B' });
    expect(result.current).toMatchObject({ status: 'loading', data: null });
    await act(async () => { second.resolve({ name: 'B-trip' }); });
    await waitFor(() => expect(result.current.data).toMatchObject({ name: 'B-trip' }));
    await act(async () => { first.resolve({ name: 'A-trip (stale)' }); });
    expect(result.current.data).toMatchObject({ name: 'B-trip' });
  });

  it('卸載後回應才到，不再更新狀態（不報 act 警告）', async () => {
    const d = deferred<{ name: string }>();
    apiFetch.mockReturnValue(d.promise);
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { unmount } = renderHook(() => useTripMeta('t'));
    unmount();
    await act(async () => { d.resolve({ name: 'x' }); });
    expect(err).not.toHaveBeenCalled();
    err.mockRestore();
  });
});

describe('useTripDays', () => {
  it('回傳 days 陣列；query 會接在路徑後面', async () => {
    apiFetch.mockResolvedValue([{ id: 1, dayNum: 1 }]);
    const { result } = renderHook(() => useTripDays('t', { all: true }));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.data).toEqual([{ id: 1, dayNum: 1 }]);
    expect(apiFetch).toHaveBeenCalledWith('/trips/t/days?all=1');
  });

  it('回應不是陣列 → 視為 error（不把壞資料交給畫面）', async () => {
    apiFetch.mockResolvedValue({ unexpected: true });
    const { result } = renderHook(() => useTripDays('t'));
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.data).toBeNull();
  });
});

describe('結構：頁面不再自己裸讀 /trips/:id 與 /days', () => {
  const ROOT = join(__dirname, '../..');
  function walk(dir: string, out: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p, out);
      else if (/\.(ts|tsx)$/.test(name)) out.push(p);
    }
    return out;
  }
  // 暫時允許（有各自的語意，尚未併入 useTripRead）：
  //  - hooks/useAddToTripTarget.ts：自帶 retry／選天狀態
  //  - pages/EntryActionPage.tsx：與 entry 端點同一個 Promise.all 載入
  //  - pages/EditEntryPage.tsx：refreshEntryPois 的命令式重抓（非 mount 讀取）
  const ALLOW = ['src/hooks/useAddToTripTarget.ts', 'src/pages/EntryActionPage.tsx', 'src/pages/EditEntryPage.tsx'];
  const BARE = /apiFetch(<[^>]*>)?\(\s*`\/trips\/\$\{encodeURIComponent\([a-zA-Z]+\)\}(\/days(\?all=1)?)?`\s*[,)]/;

  it('新增的讀取請走 useTripMeta／useTripDays（或明確加入允許清單並寫理由）', () => {
    const offenders = walk(join(ROOT, 'src'))
      .map((p) => p.slice(ROOT.length + 1))
      .filter((p) => p !== 'src/hooks/useTripRead.ts' && !ALLOW.includes(p))
      .filter((p) => BARE.test(readFileSync(join(ROOT, p), 'utf8')));
    expect(offenders).toEqual([]);
  });
});
