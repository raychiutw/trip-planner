/**
 * NewTripModal multidest sortable — Section 4.2 (terracotta-mockup-parity-v2)
 *
 * 驗 mockup section 03 改寫：
 *   - title「新增行程」(舊「想去哪裡？」已換)
 *   - destination label 含「（可加多筆，拖拉排序）」
 *   - sub-headline「先說目的地跟想做什麼...」已拿掉
 *   - 多 dest 顯示 helper 行「行程跨 N 個目的地 · 順序決定地圖 polyline 串接方向」
 *   - sortable rows render with grip + 編號 + name + region + remove (testid pattern)
 *   - date mode tabs label 改「固定日期 / 大概時間」(舊「選日期 / 彈性日期」已換)
 *   - row remove button 點擊清除該 dest
 *
 * Drag/drop 流程因 jsdom 不支援 @dnd-kit pointer event simulation，純驗 reorder
 * callback 透過 SortableDestinationList 內 useSortable id 連線即可（render 結構正確）。
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import NewTripModal from '../../src/components/trip/NewTripModal';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-04-26T12:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function renderModal() {
  return render(
    <NewTripModal
      open
      ownerEmail="u@example.com"
      onClose={vi.fn()}
      onCreated={vi.fn()}
    />,
  );
}

function mockSearch() {
  return vi.fn().mockImplementation(async (url: RequestInfo | URL) => {
    const u = typeof url === 'string' ? url : url.toString();
    if (u.includes('/api/poi-search')) {
      const decoded = decodeURIComponent(u);
      const isKyoto = decoded.includes('京都');
      const isOsaka = decoded.includes('大阪');
      return {
        ok: true,
        json: async () => ({
          results: [
            {
              osm_id: isKyoto ? 67890 : isOsaka ? 99999 : 12345,
              name: isKyoto ? '京都' : isOsaka ? '大阪' : '沖繩',
              address: '日本',
              lat: 35,
              lng: 135,
              category: 'tourism',
              country: 'JP',
              country_name: '日本',
            },
          ],
        }),
      };
    }
    return { ok: true, json: async () => ({ tripId: 'multi-test' }) };
  });
}

async function addDest(testQuery: string, expectedOsmId: number) {
  fireEvent.change(screen.getByTestId('new-trip-destination-input'), { target: { value: testQuery } });
  const result = await screen.findByTestId(`new-trip-dest-result-${expectedOsmId}`, undefined, { timeout: 1000 });
  fireEvent.click(result);
}

describe('NewTripModal — Section 4.2 multidest sortable', () => {
  it('title 為「新增行程」 (舊「想去哪裡？」已換)', () => {
    renderModal();
    expect(screen.getByRole('heading', { name: '新增行程' })).toBeTruthy();
    expect(screen.queryByText('想去哪裡？')).toBeNull();
  });

  it('destination label 含「（可加多筆，拖拉排序）」', () => {
    renderModal();
    const labels = Array.from(document.querySelectorAll('label')).map((l) => l.textContent ?? '');
    expect(labels.some((l) => l.includes('可加多筆，拖拉排序'))).toBe(true);
  });

  it('sub-headline「先說目的地跟想做什麼...」 已拿掉', () => {
    renderModal();
    expect(screen.queryByText(/先說目的地跟想做什麼/)).toBeNull();
  });

  it('date mode tabs 顯示「固定日期 / 大概時間」 (mockup 對齊)', () => {
    renderModal();
    expect(screen.getByText('固定日期')).toBeTruthy();
    expect(screen.getByText('大概時間')).toBeTruthy();
    expect(screen.queryByText('選日期')).toBeNull();
    expect(screen.queryByText('彈性日期')).toBeNull();
  });

  it('單 dest → 不顯示 helper 行；2+ dest → helper 行顯示 N 個目的地', async () => {
    vi.stubGlobal('fetch', mockSearch());
    renderModal();
    await addDest('沖繩', 12345);
    expect(screen.queryByTestId('new-trip-destination-helper')).toBeNull();
    await addDest('京都', 67890);
    const helper = screen.getByTestId('new-trip-destination-helper');
    expect(helper.textContent).toMatch(/2 個目的地/);
    expect(helper.textContent).toContain('polyline');
  });

  it('helper 行 N 個目的地隨 dest count 動態變化', async () => {
    vi.stubGlobal('fetch', mockSearch());
    renderModal();
    await addDest('沖繩', 12345);
    await addDest('京都', 67890);
    await addDest('大阪', 99999);
    expect(screen.getByTestId('new-trip-destination-helper').textContent).toMatch(/3 個目的地/);
  });

  it('每 dest row 有 grip button + 編號 + remove button', async () => {
    vi.stubGlobal('fetch', mockSearch());
    renderModal();
    await addDest('沖繩', 12345);
    await addDest('京都', 67890);

    const row1 = screen.getByTestId('new-trip-destination-row-12345');
    const row2 = screen.getByTestId('new-trip-destination-row-67890');
    expect(row1).toBeTruthy();
    expect(row2).toBeTruthy();
    // 編號 1, 2 (DOM 順序)
    expect(row1.querySelector('.tp-new-dest-num')?.textContent).toBe('1');
    expect(row2.querySelector('.tp-new-dest-num')?.textContent).toBe('2');
    // grip button
    expect(row1.querySelector('.tp-new-dest-grip')).toBeTruthy();
    // remove button (aria-label「移除目的地」)
    expect(row1.querySelector('button[aria-label*="移除目的地"]')).toBeTruthy();
  });

  it('remove button click → 該 dest row 消失', async () => {
    vi.stubGlobal('fetch', mockSearch());
    renderModal();
    await addDest('沖繩', 12345);
    await addDest('京都', 67890);
    expect(screen.getByTestId('new-trip-destination-row-12345')).toBeTruthy();

    const removeBtn = screen.getByTestId('new-trip-destination-row-12345')
      .querySelector('button[aria-label="移除目的地：沖繩"]') as HTMLButtonElement;
    fireEvent.click(removeBtn);
    expect(screen.queryByTestId('new-trip-destination-row-12345')).toBeNull();
    expect(screen.getByTestId('new-trip-destination-row-67890')).toBeTruthy();
  });

  it('rows container data-testid 為 new-trip-destination-rows (sortable list)', async () => {
    vi.stubGlobal('fetch', mockSearch());
    renderModal();
    await addDest('沖繩', 12345);
    expect(screen.getByTestId('new-trip-destination-rows')).toBeTruthy();
  });

  it('region 顯示在 row 內 (e.g. JP)', async () => {
    vi.stubGlobal('fetch', mockSearch());
    renderModal();
    await addDest('沖繩', 12345);
    const row = screen.getByTestId('new-trip-destination-row-12345');
    expect(row.querySelector('.tp-new-dest-region')?.textContent).toContain('JP');
  });
});
