/**
 * W11（part 2）— 表單 & picker 字級 px→rem 守衛。
 *
 * 承 part1（ShareLinkModal）：把 W11 最相關的表單/選擇器與帳號/AI 面 UI 文字從 px 改 rem
 * （px 不隨使用者瀏覽器字級偏好縮放、200% reflow 不放大；rem 才會）。鎖住這些檔的 CSS
 * font-size 不得再有 px，防 regress。
 *
 * 排除範圍（刻意不掃）：email-templates（email client 不吃 rem）、tripPrintStyles（列印用
 * 物理單位）、LandingPage 的 SVG `fontSize=`（幾何座標非可讀文字）、tokens.css 的
 * display/chrome 標題（hero/titlebar，被 mockup-parity 測試鎖、大文字 rem 價值低）。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const FILES = [
  'src/components/TripSelect.styles.ts',
  'src/components/TripDatePicker.styles.ts',
  'src/components/TripTimePicker.styles.ts',
  'src/components/shell/AccountCircle.tsx',
  'src/components/shell/AccountSheet.tsx',
  'src/components/AiAuthorizeCard.tsx',
  'src/components/AiConsentSheet.tsx',
];

describe('W11 表單/picker/帳號 字級 px→rem', () => {
  for (const rel of FILES) {
    it(`${rel} 無 CSS px font-size（全 rem）`, () => {
      const src = readFileSync(join(__dirname, '../..', rel), 'utf8');
      const pxFonts = src.match(/font-size:\s*[0-9]+px/g) ?? [];
      expect(pxFonts, `殘留 px font-size: ${pxFonts.join(', ')}`).toHaveLength(0);
    });
  }
});
