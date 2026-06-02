/**
 * mapDay.toTimelineEntry — note 來源（migration 0078 cutover）。
 *
 * 「整體備註」的 source of truth 從 entry-level `trip_entries.note`（raw.note）
 * 改成 primary stopPoi（master, sortOrder=1）的 per-POI `trip_entry_pois.note`。
 * timeline entry 顯示的 note 應一律取 master poi 的 note；alternate（sortOrder>1）
 * 的 note 不可被誤抓為 entry 顯示 note。
 */
import { describe, it, expect } from 'vitest';
import { toTimelineEntry } from '../../src/lib/mapDay';

describe('toTimelineEntry — note 來源（master stopPoi）', () => {
  it('master stopPoi 有 note → entry.note 等於 master note', () => {
    const entry = toTimelineEntry({
      id: 1,
      title: 'X',
      stopPois: [{ poiId: 100, sortOrder: 1, name: 'X', note: '必點山苦瓜炒麵' }],
    });
    expect(entry.note).toBe('必點山苦瓜炒麵');
  });

  it('無 stopPois → entry.note 為 null', () => {
    const entry = toTimelineEntry({ id: 1, title: 'X' });
    expect(entry.note).toBeNull();
  });

  it('master note 為 null 但 alternate 有 note → entry.note 為 null（不可誤抓 alternate）', () => {
    const entry = toTimelineEntry({
      id: 1,
      title: 'X',
      stopPois: [
        { poiId: 100, sortOrder: 1, name: 'Master', note: null },
        { poiId: 200, sortOrder: 2, name: 'Alt', note: '週三休息' },
      ],
    });
    expect(entry.note).toBeNull();
  });

  it('來源已切換：raw.note 有值但 master note 為 null → entry.note 為 null', () => {
    const entry = toTimelineEntry({
      id: 1,
      title: 'X',
      // 舊 entry-level note，cutover 後不再是 note 來源
      note: '舊的整體備註',
      stopPois: [{ poiId: 100, sortOrder: 1, name: 'Master', note: null }],
    });
    expect(entry.note).toBeNull();
  });
});
