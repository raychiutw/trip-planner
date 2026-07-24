/**
 * W11（owner 2026-07-24：ShareLinkModal 現在就全頁重寫）— 字級 px→rem 守衛。
 *
 * ShareLinkModal 的 inline <style> 原本用 px font-size；px 不隨使用者的瀏覽器字級
 * 偏好縮放（rem 才會），200% reflow / 放大字級時整個分享面板的文字不會變大 = 無障礙
 * 缺口。全部改 rem。此守衛鎖住「不得再有 px font-size」，防未來 regress。
 *
 * 顏色（W4r G9 已 hex→token）、dark（body.dark token 覆寫）本 ticket 一併視為吸收完成。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = readFileSync(
  join(__dirname, '../../src/components/share/ShareLinkModal.tsx'),
  'utf8',
);

describe('W11 ShareLinkModal 字級 px→rem（縮放/字級偏好無障礙）', () => {
  it('inline style 不得再有 px font-size（全 rem）', () => {
    const pxFonts = SRC.match(/font-size:\s*[0-9.]+px/g) ?? [];
    expect(pxFonts, `殘留 px font-size: ${pxFonts.join(', ')}`).toHaveLength(0);
  });

  it('font-size 一律用 rem 單位', () => {
    const fonts = SRC.match(/font-size:\s*[0-9.]+(px|rem|em)/g) ?? [];
    expect(fonts.length).toBeGreaterThan(0);
    for (const f of fonts) {
      expect(f, `${f} 非 rem`).toMatch(/rem$/);
    }
  });

  it('顏色續用語意 token（G9 regression：不得寫死 hex）', () => {
    // W4r G9 已把寫死 hex → token；這裡順帶鎖不回頭（rgba 陰影/backdrop 例外）。
    const hexInStyle = (SRC.match(/#[0-9a-fA-F]{3,6}\b/g) ?? []).filter((h) => h.length === 4 || h.length === 7);
    expect(hexInStyle, `寫死 hex: ${hexInStyle.join(', ')}`).toHaveLength(0);
  });
});
