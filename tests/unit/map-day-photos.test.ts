/**
 * mapDay.toTimelineEntry — pois.photos JSON parsing (v2.12 Wave 3).
 *
 * pois.photos 是 D1 JSON-encoded TEXT column。toTimelineEntry 須安全地 parse
 * 並 surface 為 PoiPhoto[]。malformed input 要 fallback 為 null（不 throw），
 * frontend 才能 graceful 回 placeholder。
 */
import { describe, it, expect } from 'vitest';
import { toTimelineEntry } from '../../src/lib/mapDay';

describe('toTimelineEntry — photos parsing', () => {
  it('valid JSON array → parsed PoiPhoto[]', () => {
    const entry = toTimelineEntry({
      id: 1,
      title: 'X',
      poi: {
        id: 100,
        photos: JSON.stringify([
          { url: 'https://x.com/a.jpg', caption: 'a' },
          { url: 'https://x.com/b.jpg' },
        ]),
      },
    });
    expect(entry.photos).toHaveLength(2);
    expect(entry.photos?.[0]?.url).toBe('https://x.com/a.jpg');
    expect(entry.photos?.[0]?.caption).toBe('a');
  });

  it('NULL → null', () => {
    const entry = toTimelineEntry({ id: 1, title: 'X', poi: { id: 100, photos: null } });
    expect(entry.photos).toBeNull();
  });

  it('undefined poi → null', () => {
    const entry = toTimelineEntry({ id: 1, title: 'X' });
    expect(entry.photos).toBeNull();
  });

  it('empty string → null', () => {
    const entry = toTimelineEntry({ id: 1, title: 'X', poi: { id: 100, photos: '' } });
    expect(entry.photos).toBeNull();
  });

  it('empty array JSON → null（無實際照片視同無）', () => {
    const entry = toTimelineEntry({ id: 1, title: 'X', poi: { id: 100, photos: '[]' } });
    expect(entry.photos).toBeNull();
  });

  it('malformed JSON → null（不 throw）', () => {
    const entry = toTimelineEntry({ id: 1, title: 'X', poi: { id: 100, photos: '{not json' } });
    expect(entry.photos).toBeNull();
  });

  it('JSON object（not array） → null', () => {
    const entry = toTimelineEntry({ id: 1, title: 'X', poi: { id: 100, photos: '{"url":"x"}' } });
    expect(entry.photos).toBeNull();
  });

  it('array with mixed valid/invalid items → only valid kept', () => {
    const entry = toTimelineEntry({
      id: 1, title: 'X',
      poi: {
        id: 100,
        photos: JSON.stringify([
          { url: 'https://valid.com/a.jpg' },
          { caption: 'no url' },         // invalid — no url
          { url: 123 },                   // invalid — url not string
          { url: 'https://valid.com/b.jpg', thumbUrl: 'https://valid.com/b-thumb.jpg' },
        ]),
      },
    });
    expect(entry.photos).toHaveLength(2);
    expect(entry.photos?.map((p) => p.url)).toEqual([
      'https://valid.com/a.jpg',
      'https://valid.com/b.jpg',
    ]);
  });

  it('all-invalid array → null', () => {
    const entry = toTimelineEntry({
      id: 1, title: 'X',
      poi: { id: 100, photos: JSON.stringify([{ caption: 'no url' }, { url: 123 }]) },
    });
    expect(entry.photos).toBeNull();
  });
});
