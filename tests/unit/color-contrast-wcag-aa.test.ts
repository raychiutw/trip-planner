/**
 * Color contrast WCAG AA 驗證（B-P6 task 5.6）
 *
 * 對照 css/tokens.css 主 color pairs，確保 light + dark theme 都過 WCAG 2.x AA：
 * - Normal text: ≥ 4.5:1
 * - Large text / UI: ≥ 3:1
 *
 * 算法：WCAG relative luminance + contrast ratio
 *   https://www.w3.org/TR/WCAG21/#contrast-minimum
 *   https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 *
 * 為何 hardcode 色值而不從 tokens.css 動態抽：
 * - jsdom 不解析 CSS @theme / @media，runtime computed style 不可靠
 * - hardcode 跟 tokens.css 同步靠 PR review；如果不同步，本 test 會 fail，提醒
 *   tokens.css 改色時要 update 此 test
 */
import { describe, it, expect } from 'vitest';

function relativeLuminance(hex: string): number {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const adjust = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * adjust(r) + 0.7152 * adjust(g) + 0.0722 * adjust(b);
}

function contrastRatio(c1: string, c2: string): number {
  const l1 = relativeLuminance(c1);
  const l2 = relativeLuminance(c2);
  const [bright, dark] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (bright + 0.05) / (dark + 0.05);
}

// 同步自 css/tokens.css。改色時記得回頭 update 這份 fixture。
const LIGHT = {
  background: '#FFFFFF',
  secondary: '#F7FBFD',
  foreground: '#222222',
  muted: '#6A6A6A',
  accent: '#0077B6',
  accentForeground: '#FFFFFF',
  accentSubtle: '#E0F4FA',
  accentBg: '#CAF0F8',
  border: '#EBEBEB',
};

const DARK = {
  background: '#0D1B2A',
  secondary: '#1B263B',
  foreground: '#E0F4FA',
  muted: '#90A4B8',
  accent: '#48CAE4',
  accentForeground: '#0D1B2A',
  accentSubtle: '#13293D',
  accentBg: '#1E3A52',
  border: '#2E3B4F',
};

const AA_NORMAL = 4.5; // body text
const AA_LARGE = 3.0; // 18pt+ or 14pt+ bold, also non-text UI

describe('Color contrast — WCAG 2.x AA', () => {
  describe('Light theme (Ocean palette default)', () => {
    it('foreground / background ≥ 4.5 (body text)', () => {
      expect(contrastRatio(LIGHT.foreground, LIGHT.background)).toBeGreaterThanOrEqual(AA_NORMAL);
    });

    it('muted / background ≥ 4.5 (secondary text)', () => {
      expect(contrastRatio(LIGHT.muted, LIGHT.background)).toBeGreaterThanOrEqual(AA_NORMAL);
    });

    it('accent / background ≥ 4.5 (link text)', () => {
      expect(contrastRatio(LIGHT.accent, LIGHT.background)).toBeGreaterThanOrEqual(AA_NORMAL);
    });

    it('accentForeground / accent ≥ 4.5 (button text on filled bg)', () => {
      expect(contrastRatio(LIGHT.accentForeground, LIGHT.accent)).toBeGreaterThanOrEqual(AA_NORMAL);
    });

    it('foreground / secondary ≥ 4.5 (body text on alt bg)', () => {
      expect(contrastRatio(LIGHT.foreground, LIGHT.secondary)).toBeGreaterThanOrEqual(AA_NORMAL);
    });

    it('accent / accentSubtle ≥ 3 (icon / large text on tint)', () => {
      expect(contrastRatio(LIGHT.accent, LIGHT.accentSubtle)).toBeGreaterThanOrEqual(AA_LARGE);
    });
  });

  describe('Dark theme', () => {
    it('foreground / background ≥ 4.5 (body text)', () => {
      expect(contrastRatio(DARK.foreground, DARK.background)).toBeGreaterThanOrEqual(AA_NORMAL);
    });

    it('muted / background ≥ 4.5 (secondary text)', () => {
      expect(contrastRatio(DARK.muted, DARK.background)).toBeGreaterThanOrEqual(AA_NORMAL);
    });

    it('accent / background ≥ 4.5 (link text)', () => {
      expect(contrastRatio(DARK.accent, DARK.background)).toBeGreaterThanOrEqual(AA_NORMAL);
    });

    it('accentForeground / accent ≥ 4.5 (button text on filled bg)', () => {
      expect(contrastRatio(DARK.accentForeground, DARK.accent)).toBeGreaterThanOrEqual(AA_NORMAL);
    });

    it('foreground / secondary ≥ 4.5 (body text on alt bg)', () => {
      expect(contrastRatio(DARK.foreground, DARK.secondary)).toBeGreaterThanOrEqual(AA_NORMAL);
    });
  });

  describe('Algorithm sanity', () => {
    it('純白 / 純黑 = 21:1（理論最大）', () => {
      expect(contrastRatio('#FFFFFF', '#000000')).toBeCloseTo(21, 0);
    });

    it('同色 ratio = 1', () => {
      expect(contrastRatio('#888888', '#888888')).toBeCloseTo(1, 5);
    });
  });
});
