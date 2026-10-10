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

import { useTripMeta, useTripDays, useTripDestinations, NO_DESTINATIONS } from '../../src/hooks/useTripRead';

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

  it('換行程時舊行程晚到的回應不會蓋掉新行程', async () => {
    const first = deferred<{ name: string }>();
    const second = deferred<{ name: string }>();
    apiFetch.mockImplementation((path: string) => (path === '/trips/A' ? first.promise : second.promise));
    const { result, rerender } = renderHook(({ id }) => useTripMeta(id), { initialProps: { id: 'A' } });
    rerender({ id: 'B' });
    await act(async () => { second.resolve({ name: 'B-trip' }); });
    await waitFor(() => expect(result.current.data).toMatchObject({ name: 'B-trip' }));
    await act(async () => { first.resolve({ name: 'A-trip (stale)' }); });
    expect(result.current.data).toMatchObject({ name: 'B-trip' });
  });

  it('A 已載入完成後換成 B：B 還沒回來的當下是 loading／null，不顯示 A 的資料（結果綁定 path）', async () => {
    const second = deferred<{ name: string }>();
    apiFetch.mockImplementation((path: string) => (path === '/trips/A' ? Promise.resolve({ name: 'A-trip' }) : second.promise));
    const { result, rerender } = renderHook(({ id }) => useTripMeta(id), { initialProps: { id: 'A' } });
    await waitFor(() => expect(result.current.data).toMatchObject({ name: 'A-trip' }));
    rerender({ id: 'B' });
    expect(result.current).toMatchObject({ status: 'loading', data: null });
    await act(async () => { second.resolve({ name: 'B-trip' }); });
    await waitFor(() => expect(result.current.data).toMatchObject({ name: 'B-trip' }));
  });

  it('停用後再啟用同一個行程：先回 loading 而不是上一輪的資料（例如 auth.user 閃一下）', async () => {
    const again = deferred<{ name: string }>();
    apiFetch.mockResolvedValueOnce({ name: 'first-load' }).mockReturnValueOnce(again.promise);
    const { result, rerender } = renderHook(({ on }) => useTripMeta('t', on), { initialProps: { on: true } });
    await waitFor(() => expect(result.current.data).toMatchObject({ name: 'first-load' }));
    rerender({ on: false });
    await waitFor(() => expect(result.current.status).toBe('idle'));
    rerender({ on: true });
    expect(result.current).toMatchObject({ status: 'loading', data: null });
    await act(async () => { again.resolve({ name: 'second-load' }); });
    await waitFor(() => expect(result.current.data).toMatchObject({ name: 'second-load' }));
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

  it('enabled=false 不發請求；換行程時舊回應晚到不蓋掉新的；all 切換會換 path', async () => {
    const { result: off } = renderHook(() => useTripDays('t', { enabled: false }));
    expect(off.current.status).toBe('idle');
    expect(apiFetch).not.toHaveBeenCalled();

    const first = deferred<unknown[]>();
    apiFetch.mockImplementation((path: string) => (path === '/trips/A/days' ? first.promise : Promise.resolve([{ id: 2, dayNum: 1 }])));
    const { result, rerender } = renderHook(({ id, all }) => useTripDays(id, { all }), { initialProps: { id: 'A', all: false } });
    rerender({ id: 'B', all: false });
    await waitFor(() => expect(result.current.data).toEqual([{ id: 2, dayNum: 1 }]));
    await act(async () => { first.resolve([{ id: 99, dayNum: 9 }]); });
    expect(result.current.data).toEqual([{ id: 2, dayNum: 1 }]);
    rerender({ id: 'B', all: true });
    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith('/trips/B/days?all=1'));
  });

  it('回應不是陣列 → 視為 error（不把壞資料交給畫面）', async () => {
    apiFetch.mockResolvedValue({ unexpected: true });
    const { result } = renderHook(() => useTripDays('t'));
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.data).toBeNull();
  });
});

describe('useTripDestinations（地圖預設中心的 null／[]／清單三態）', () => {
  it('載入中 null；成功回清單；回應沒有 destinations 回穩定的空陣列', async () => {
    apiFetch.mockResolvedValue({ destinations: [{ name: 'Naha' }] });
    const { result } = renderHook(() => useTripDestinations('t'));
    expect(result.current).toBeNull();
    await waitFor(() => expect(result.current).toEqual([{ name: 'Naha' }]));
    apiFetch.mockResolvedValue({});
    const { result: r2 } = renderHook(() => useTripDestinations('u'));
    await waitFor(() => expect(r2.current).toBe(NO_DESTINATIONS));
  });

  it('讀取失敗 → 穩定的空陣列（不是 null：null 會讓 picker 永遠卡在載入中）', async () => {
    apiFetch.mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => useTripDestinations('t'));
    await waitFor(() => expect(result.current).toBe(NO_DESTINATIONS));
  });

  it('enabled=false → 一直是 null、不發請求', () => {
    const { result } = renderHook(() => useTripDestinations('t', false));
    expect(result.current).toBeNull();
    expect(apiFetch).not.toHaveBeenCalled();
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
  const ALLOW = ['src/hooks/useAddToTripTarget.ts', 'src/pages/EntryActionPage.tsx'];
  // EditEntryPage 不整檔豁免，只允許那一處命令式重抓（再多一個 mount 讀取就會超過 1）。
  const EXACT: Record<string, number> = { 'src/pages/EditEntryPage.tsx': 1 };
  // `<.*?>` 才吃得到巢狀泛型（apiFetch<Array<{ ... }>>(...)）。
  const BARE = /apiFetch(<.*?>)?\(\s*`\/trips\/\$\{encodeURIComponent\([a-zA-Z]+\)\}(\/days(\?all=1)?)?`\s*[,)]/g;
  const count = (p: string) => (readFileSync(join(ROOT, p), 'utf8').match(BARE) ?? []).length;

  it('新增的讀取請走 useTripMeta／useTripDays（或明確加入允許清單並寫理由）', () => {
    const offenders = walk(join(ROOT, 'src'))
      .map((p) => p.slice(ROOT.length + 1))
      .filter((p) => p !== 'src/hooks/useTripRead.ts' && !ALLOW.includes(p))
      .filter((p) => count(p) > (EXACT[p] ?? 0));
    expect(offenders).toEqual([]);
    for (const [p, n] of Object.entries(EXACT)) expect(count(p), `${p} 應恰好 ${n} 處`).toBe(n);
  });
});
