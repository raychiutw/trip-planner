/**
 * segment-submode-sanitize.test.ts — v2.55.45
 *
 * submode 是攻擊者可控自由文字（「其他」方式名），寫入前必經 sanitize。兩條寫入邊界：
 *   - API 層 sanitizeSubmode（segments/_shared.ts，PATCH/POST）
 *   - Import 層 cleanSubmode（trips/_import.ts，攻擊者 JSON）— 刻意自含、不 import API 層
 * 本檔直接鎖 sanitizeSubmode 的剝除規則，並以 parity 測交叉驗證兩條邊界輸出一致
 * （防兩份手同步的實作 silently drift）。危險字元用 fromCodePoint 明確建構。
 */
import { describe, it, expect } from 'vitest';
import { sanitizeSubmode } from '../../functions/api/trips/[id]/segments/_shared';
import { parseAndValidateImport } from '../../functions/api/trips/_import';

const cp = (n: number) => String.fromCodePoint(n);

describe('sanitizeSubmode — 剝除規則', () => {
  it('剝 C0/DEL/C1 控制字元、零寬、bidi override/isolate、方向標記 LRM/RLM/ALM、line-sep', () => {
    const dirty =
      '單' + cp(0x200e) + '軌' + cp(0x202e) + cp(0x200b) + cp(0x07) + cp(0x7f) +
      cp(0x2066) + cp(0x061c) + cp(0x2028) + 'X';
    expect(sanitizeSubmode(dirty, 'transit')).toBe('單軌X');
  });

  it('依 code point（非 UTF-16 code unit）截 20 上限，星平面字元不被切成孤立 surrogate', () => {
    const out = sanitizeSubmode('🚝'.repeat(25), 'transit');
    expect(out).not.toBeNull();
    expect([...out!].length).toBe(20);      // 20 個 code point
    expect(out).toBe('🚝'.repeat(20));       // 無孤立 surrogate
  });

  it('非 transit → null（submode ≠ null ⟺ transit 不變式）', () => {
    expect(sanitizeSubmode('monorail', 'driving')).toBeNull();
    expect(sanitizeSubmode('bus', 'walking')).toBeNull();
  });

  it('非字串 / 空白 → null', () => {
    expect(sanitizeSubmode(123, 'transit')).toBeNull();
    expect(sanitizeSubmode(null, 'transit')).toBeNull();
    expect(sanitizeSubmode('   ', 'transit')).toBeNull();
    expect(sanitizeSubmode(cp(0x200b) + cp(0x202e), 'transit')).toBeNull(); // 全是被剝字元 → 空 → null
  });
});

describe('sanitize parity — API sanitizeSubmode ≡ import cleanSubmode', () => {
  // import 路徑經 parseAndValidateImport → cleanSubmode，取正規化後的 submode。
  const importSubmode = (raw: string): string | null => {
    const r = parseAndValidateImport({
      schemaVersion: 1,
      meta: { name: 'x' },
      days: [{ timeline: [{ sortOrder: 1, title: 'a' }, { sortOrder: 2, title: 'b' }] }],
      segments: [{ fromEntryIdx: 0, toEntryIdx: 1, mode: 'transit', submode: raw }],
    });
    if (!r.ok) throw new Error('expected ok: ' + r.error);
    return r.data.segments[0]!.submode;
  };

  it('同一髒 fixture 兩條邊界輸出完全一致（drift 偵測）', () => {
    const dirty = '水上' + cp(0x202e) + '巴士' + cp(0x200b) + cp(0x200e) + cp(0x061c);
    const viaApi = sanitizeSubmode(dirty, 'transit');
    expect(viaApi).toBe('水上巴士');
    expect(importSubmode(dirty)).toBe(viaApi); // 兩者相同
  });

  it('20 字上限兩邊一致', () => {
    const long = 'あ'.repeat(30);
    expect(sanitizeSubmode(long, 'transit')).toBe('あ'.repeat(20));
    expect(importSubmode(long)).toBe('あ'.repeat(20));
  });
});
