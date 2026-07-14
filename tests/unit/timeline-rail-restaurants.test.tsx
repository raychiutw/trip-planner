/**
 * TimelineRail — entry POI rendering in expanded detail (v2.30.14 redesign).
 *
 * v2.30.14：master POI 欄位（rating/hours/price/MapLinks/description）整合進
 * 「景點說明」section，不再渲染獨立「正選」卡片。「景點選擇」section 改名
 * 「備選景點」，只在備選存在時 (stopPois.length >= 2) 渲染，且只列備選
 * (sortOrder >= 2)。Section 順序：景點說明 → 備註 → 備選景點。
 *
 * Sort 仍 stable：null/undefined sortOrder 落尾（視為 99）。
 */
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TimelineRail from '../../src/components/trip/TimelineRail';
import type { TimelineEntryData } from '../../src/components/trip/TimelineEvent';
import { TripIdContext } from '../../src/contexts/TripIdContext';

function makeEntry(overrides: Partial<TimelineEntryData> = {}): TimelineEntryData {
  return {
    id: 437,
    time: '13:05-14:35',
    title: '本部午餐',
    description: '本部町在地美食',
    note: null,
    googleRating: 4.1,
    ...overrides,
  };
}

function renderWithEntry(entry: TimelineEntryData) {
  return render(
    <MemoryRouter>
      <TripIdContext.Provider value="okinawa-2026">
        <TimelineRail events={[entry]} />
      </TripIdContext.Provider>
    </MemoryRouter>,
  );
}

describe('TimelineRail — 備選景點 section (v2.30.14)', () => {
  it('entry without stopPois → no 備選景點 section after expand', () => {
    renderWithEntry(makeEntry());
    fireEvent.click(screen.getByTestId('timeline-rail-row-437'));
    expect(screen.queryByTestId('timeline-rail-alternates-437')).toBeNull();
  });

  it('entry with empty stopPois → no 備選景點 section', () => {
    const entry = makeEntry({ stopPois: [] });
    renderWithEntry(entry);
    fireEvent.click(screen.getByTestId('timeline-rail-row-437'));
    expect(screen.queryByTestId('timeline-rail-alternates-437')).toBeNull();
  });

  it('1 stop POI (master only) → no 備選景點 section（master 欄位升格到景點說明）', () => {
    const entry = makeEntry({
      stopPois: [{ name: '山原そば', sortOrder: 1, category: '沖繩麵' }],
    });
    renderWithEntry(entry);
    fireEvent.click(screen.getByTestId('timeline-rail-row-437'));
    expect(screen.queryByTestId('timeline-rail-alternates-437')).toBeNull();
  });

  it('≥2 stop POIs → 備選景點 section 只列備選 (sortOrder >= 2)，無「正選」card', () => {
    const entry = makeEntry({
      stopPois: [
        { name: '海人食堂', sortOrder: 2, category: '生魚片' },
        { name: 'きしもと食堂', sortOrder: 1, category: '拉麵' },
        { name: '焼肉もとぶ牧場', sortOrder: 3, category: '燒肉' },
      ],
    });
    renderWithEntry(entry);
    fireEvent.click(screen.getByTestId('timeline-rail-row-437'));
    const list = screen.getByTestId('timeline-rail-alternates-437');

    // master (sortOrder=1) 不該以「正選 card」形式出現在備選 section
    expect(list.querySelector('[data-variant="primary"]')).toBeNull();
    expect(list.textContent).not.toContain('正選');

    // 「備選」divider 已移除（整段 section 名稱就是備選景點）
    expect(list.querySelector('.tp-rail-poi-alt-heading')).toBeNull();

    // 只列備選 2 個（sortOrder 2 + 3），不含 master「きしもと食堂」
    const altCards = list.querySelectorAll('.tp-rail-poi-card');
    expect(altCards).toHaveLength(2);
    expect(list.textContent).not.toContain('きしもと食堂');

    // 順序：sortOrder 2 → 3
    const html = list.innerHTML;
    const idxAlt1 = html.indexOf('海人食堂');
    const idxAlt2 = html.indexOf('焼肉もとぶ牧場');
    expect(idxAlt1).toBeGreaterThan(-1);
    expect(idxAlt1).toBeLessThan(idxAlt2);
  });

  it('null/undefined sortOrder 在備選中落尾（視為 99）', () => {
    const entry = makeEntry({
      stopPois: [
        { name: 'Master', sortOrder: 1, category: 'misc' },
        { name: 'NoOrder', sortOrder: null, category: 'misc' },
        { name: 'Second', sortOrder: 2, category: 'misc' },
      ],
    });
    renderWithEntry(entry);
    fireEvent.click(screen.getByTestId('timeline-rail-row-437'));
    const list = screen.getByTestId('timeline-rail-alternates-437');
    const idxSecond = list.innerHTML.indexOf('Second');
    const idxNoOrder = list.innerHTML.indexOf('NoOrder');
    expect(idxSecond).toBeLessThan(idxNoOrder);
    expect(list.innerHTML).not.toContain('Master');
  });
});

describe('TimelineRail — 景點說明 section 整合 master POI 欄位 (v2.30.14)', () => {
  it('master POI 有 rating / price / hours / location → 顯示在景點說明 meta + MapLinks', () => {
    const entry = makeEntry({
      stopPois: [{
        name: 'きしもと食堂',
        sortOrder: 1,
        rating: 4.5,
        price: '¥¥',
        hours: '11:00–14:30',
        location: {
          name: 'きしもと食堂',
          googleQuery: 'https://maps.google.com/?q=test',
          appleQuery: 'https://maps.apple.com/?q=test',
        },
      }],
    });
    renderWithEntry(entry);
    fireEvent.click(screen.getByTestId('timeline-rail-row-437'));

    const desc = screen.getByTestId('timeline-rail-description-437');
    expect(desc.textContent).toContain('4.5');
    expect(desc.textContent).toContain('¥¥');
    expect(desc.textContent).toContain('11:00–14:30');
    // MapLinks 渲染在 description section 內
    expect(desc.querySelector('a[href*="maps.google.com"]')).not.toBeNull();
    expect(desc.querySelector('a[href*="maps.apple.com"]')).not.toBeNull();
  });

  // v2.55.x：master POI 細類 label 補進景點說明（對齊 v2.55.73 ExplorePage/備選卡的
  // poiCategoryLabel(category) 細類顯示）。v2.30.14 把 master 升格到景點說明時漏掉細類，
  // 導致「每日行程頁看不到新分類」——正選只剩 collapsed row 的粗類 badge。
  // 只顯示細類（不 fallback 粗類 type）：正選已有相鄰粗類 badge，fallback 會產生回聲。
  it('master POI 細類 (Google primaryType) 顯示在景點說明 — ramen_restaurant → 拉麵（非粗類）', () => {
    const entry = makeEntry({
      stopPois: [{
        name: 'きしもと食堂', sortOrder: 1, type: 'restaurant', category: 'ramen_restaurant',
      }],
    });
    renderWithEntry(entry);
    fireEvent.click(screen.getByTestId('timeline-rail-row-437'));

    const desc = screen.getByTestId('timeline-rail-description-437');
    // poiCategoryLabel('ramen_restaurant') → '拉麵'（細類），不是粗類「用餐/餐廳」
    expect(desc.querySelector('.tp-rail-poi-type')?.textContent).toBe('拉麵');
    expect(desc.textContent).not.toContain('用餐');
  });

  it('master 只有粗類 type、無 category → 景點說明不冒細類 pill（避免與 collapsed badge 重複）', () => {
    const entry = makeEntry({
      // 「本部逛街」避免預設 description 關鍵字污染；type=shopping 粗類已在 collapsed badge
      description: '本部逛街',
      stopPois: [{ name: 'AEON MALL', sortOrder: 1, type: 'shopping' }],
    });
    renderWithEntry(entry);
    fireEvent.click(screen.getByTestId('timeline-rail-row-437'));

    const desc = screen.getByTestId('timeline-rail-description-437');
    // 無 Google primaryType category → 不顯示細類 pill（粗類 badge 已表達，不重複回聲）
    expect(desc.querySelector('.tp-rail-poi-type')).toBeNull();
    expect(desc.textContent).not.toContain('購物');
  });

  it('master POI description 整合到 entry.description 下方', () => {
    const entry = makeEntry({
      description: '沖繩 No.1 潛水景點',
      stopPois: [{
        name: '青潛',
        sortOrder: 1,
        description: '自有停車場+接駁車',
      }],
    });
    renderWithEntry(entry);
    fireEvent.click(screen.getByTestId('timeline-rail-row-437'));

    const desc = screen.getByTestId('timeline-rail-description-437');
    expect(desc.textContent).toContain('沖繩 No.1 潛水景點');
    expect(desc.textContent).toContain('自有停車場+接駁車');
    // entry.description 在 master.description 前
    const idxEntry = desc.textContent!.indexOf('沖繩 No.1');
    const idxMaster = desc.textContent!.indexOf('自有停車場');
    expect(idxEntry).toBeLessThan(idxMaster);
  });

  it('section 順序：景點說明 → 備註 → 備選景點', () => {
    const entry = makeEntry({
      description: 'desc',
      note: 'my note',
      stopPois: [
        { name: 'Master', sortOrder: 1 },
        { name: 'Alt', sortOrder: 2 },
      ],
    });
    renderWithEntry(entry);
    fireEvent.click(screen.getByTestId('timeline-rail-row-437'));

    const detail = screen.getByTestId('timeline-rail-detail-437');
    const sections = Array.from(detail.querySelectorAll('h4')).map((h) => h.textContent);
    const idxDesc = sections.indexOf('景點說明');
    const idxNote = sections.indexOf('備註');
    const idxAlts = sections.indexOf('備選景點');
    expect(idxDesc).toBeGreaterThan(-1);
    expect(idxNote).toBeGreaterThan(idxDesc);
    expect(idxAlts).toBeGreaterThan(idxNote);
  });
});
