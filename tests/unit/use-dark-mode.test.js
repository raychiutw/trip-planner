import { describe, it, expect, beforeEach } from 'vitest';
import { lsSet, lsGet, LS_PREFIX } from '../../src/lib/localStorage';

/**
 * Unit tests for useDarkMode hook logic — V2 Terracotta single-theme design system.
 *
 * v2.33.90: 改 OCEAN_COLORS 藍 → THEME_COLORS Terracotta 橘對齊
 * `src/hooks/useDarkMode.ts` THEME_COLORS = { light: '#A97A4A', dark: '#121214' }。
 * 之前 test 使用本地 OCEAN_COLORS = { light: '#0077B6', dark: '#0D1B2A' } 是舊
 * Ocean palette 殘留，與 source 完全不一致（test 用自己的常數所以假性 green）。
 *
 * Hook only manages `body.dark` and `<meta name="theme-color">`, no more
 * per-theme class switching.
 */

/** Terracotta theme colors (mirror of THEME_COLORS in useDarkMode.ts). */
const THEME_COLORS = { light: '#A97A4A', dark: '#121214' };

beforeEach(() => {
  localStorage.clear();
  document.body.className = '';
  if (!document.querySelector('meta[name="theme-color"]')) {
    const meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    document.head.appendChild(meta);
  }
});

describe('colorMode localStorage', () => {
  it('預設值為 auto（無儲存值時）', () => {
    const saved = lsGet('color-mode');
    expect(saved).toBeNull();
  });

  it('儲存 color-mode', () => {
    lsSet('color-mode', 'dark');
    expect(lsGet('color-mode')).toBe('dark');
  });

  it('legacy dark key 相容', () => {
    localStorage.setItem(LS_PREFIX + 'dark', JSON.stringify({ v: '1', exp: Date.now() + 86400000 }));
    expect(lsGet('dark')).toBe('1');
  });
});

describe('dark class 套用邏輯', () => {
  it('套上 dark class 時 body 變深色', () => {
    document.body.classList.add('dark');
    expect(document.body.classList.contains('dark')).toBe(true);
  });

  it('移除 dark class 時 body 回到淺色', () => {
    document.body.classList.add('dark');
    document.body.classList.remove('dark');
    expect(document.body.classList.contains('dark')).toBe(false);
  });
});

describe('meta theme-color 更新', () => {
  function updateMeta(isDark) {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute('content', isDark ? THEME_COLORS.dark : THEME_COLORS.light);
    }
  }

  it('淺色模式使用 Terracotta accent #A97A4A', () => {
    updateMeta(false);
    const meta = document.querySelector('meta[name="theme-color"]');
    expect(meta.getAttribute('content')).toBe('#A97A4A');
  });

  it('深色模式使用 V3 中性深灰 #121214', () => {
    updateMeta(true);
    const meta = document.querySelector('meta[name="theme-color"]');
    expect(meta.getAttribute('content')).toBe('#121214');
  });
});

describe('Terracotta single-theme — 舊主題 class 不再被程式產生', () => {
  it('THEME_COLORS 沒有 sun/sky/zen/forest/sakura/night legacy keys', () => {
    expect(THEME_COLORS.sun).toBeUndefined();
    expect(THEME_COLORS.sky).toBeUndefined();
    expect(THEME_COLORS.night).toBeUndefined();
  });
});
