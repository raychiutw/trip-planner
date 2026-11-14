/**
 * 清單讀取失敗時，「失敗 → 掛載重試 → loading（頁面把用到清單的子樹卸載）→ 失敗 → 重新掛載 → 又重試…」
 * 不可變成無限的請求迴圈（GlobalMapPage 在 loading 時 return null，會把側邊欄卸載再掛載）。
 * master 就有這個迴圈（#1303 的 e2e 實測 11 秒 1892 次 my-trips）；#1691 讓重新掛載不再需要打 userinfo，迴圈因此空轉得更快。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';

const get = vi.hoisted(() => vi.fn());
vi.mock('../../src/lib/api/typed', () => ({ typedApi: { get }, unwrap: (r: unknown) => r }));

import { __clearMyTripsCache, refreshMyTrips, useMyTrips } from '../../src/hooks/useMyTrips';

function Consumer() { useMyTrips('u1'); return null; }
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 40)); });

beforeEach(() => { __clearMyTripsCache(); get.mockReset(); get.mockRejectedValue(new Error('503')); });
afterEach(() => cleanup());

describe('useMyTrips 失敗後的掛載重試', () => {
  it('同一次失敗之後，反覆卸載／重新掛載只會重試一次（不是每次掛載都重打）', async () => {
    render(<Consumer />);
    await settle();
    expect(get).toHaveBeenCalledTimes(1); // 初次載入，失敗
    for (let i = 0; i < 4; i++) {
      const again = render(<Consumer />); // 例如頁面在 loading 時卸載側邊欄、失敗後又掛載
      await settle();
      again.unmount();
    }
    expect(get.mock.calls.length).toBeLessThanOrEqual(2); // 初次 + 一次掛載重試
  });

  it('手動重試（refreshMyTrips）永遠有效', async () => {
    render(<Consumer />);
    await settle();
    for (let i = 0; i < 3; i++) { const r = render(<Consumer />); await settle(); r.unmount(); }
    const before = get.mock.calls.length;
    get.mockResolvedValue([{ tripId: 't1', name: 'A' }]);
    await act(async () => { refreshMyTrips(); await new Promise((r) => setTimeout(r, 40)); });
    expect(get.mock.calls.length).toBe(before + 1);
  });
});
