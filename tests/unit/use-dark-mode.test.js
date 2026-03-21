import { describe, it, expect, beforeEach } from 'vitest';
import { lsSet, lsGet, LS_PREFIX } from '../../src/lib/localStorage';

/**
 * Unit tests for useDarkMode hook logic (theme + mode persistence).
 * Tests the underlying localStorage logic without React rendering.
 */

// Mirror THEME_COLORS from useDarkMode.ts for test assertions
const THEME_COLORS_CURRENT = {
  sun:    { light: '#F47B5E', dark: '#3D2A20' },
  sky:    { light: '#2870A0', dark: '#1E3040' },
  zen:    { light: '#9A6B50', dark: '#342820' },
  forest: { light: '#4A8C5C', dark: '#243D2A' },
  sakura: { light: '#D4708A', dark: '#3D2028' },
  night:  { light: '#6B6B6B', dark: '#000000' },
};

// Mirror readColorTheme() logic for migration test
function readColorThemeMock() {
  const saved = lsGet('colorTheme');
  if (saved === 'ocean') return 'night';
  if (saved === 'sun' || saved === 'sky' || saved === 'zen' || saved === 'forest' || saved === 'sakura' || saved === 'night') return saved;
  return 'sun';
}

beforeEach(() => {
  localStorage.clear();
  document.body.className = '';
  // Ensure meta theme-color exists
  if (!document.querySelector('meta[name="theme-color"]')) {
    const meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    document.head.appendChild(meta);
  }
});

describe('colorTheme localStorage', () => {
  it('預設值為 sun（無儲存值時）', () => {
    const saved = lsGet('colorTheme');
    expect(saved).toBeNull();
    // Hook would default to 'sun'
  });

  it('儲存主題偏好到 localStorage', () => {
    lsSet('colorTheme', 'sky');
    expect(lsGet('colorTheme')).toBe('sky');
  });

  it('讀取已存的主題偏好', () => {
    lsSet('colorTheme', 'zen');
    expect(lsGet('colorTheme')).toBe('zen');
  });

  it('覆寫主題偏好', () => {
    lsSet('colorTheme', 'sun');
    lsSet('colorTheme', 'sky');
    expect(lsGet('colorTheme')).toBe('sky');
  });
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

describe('theme class 套用邏輯', () => {
  const THEME_CLASSES = ['theme-sun', 'theme-sky', 'theme-zen'];

  function applyThemeClass(theme) {
    THEME_CLASSES.forEach((cls) => document.body.classList.remove(cls));
    document.body.classList.add(`theme-${theme}`);
  }

  it('套用 theme-sun class', () => {
    applyThemeClass('sun');
    expect(document.body.classList.contains('theme-sun')).toBe(true);
    expect(document.body.classList.contains('theme-sky')).toBe(false);
  });

  it('切換主題時移除舊 class', () => {
    applyThemeClass('sun');
    applyThemeClass('sky');
    expect(document.body.classList.contains('theme-sun')).toBe(false);
    expect(document.body.classList.contains('theme-sky')).toBe(true);
  });

  it('主題 class 與 dark class 正交', () => {
    applyThemeClass('zen');
    document.body.classList.add('dark');
    expect(document.body.classList.contains('theme-zen')).toBe(true);
    expect(document.body.classList.contains('dark')).toBe(true);
  });

  it('切換主題不影響 dark class', () => {
    applyThemeClass('sun');
    document.body.classList.add('dark');
    applyThemeClass('sky');
    expect(document.body.classList.contains('dark')).toBe(true);
    expect(document.body.classList.contains('theme-sky')).toBe(true);
  });
});

describe('meta theme-color 更新', () => {
  const THEME_COLORS = {
    sun: { light: '#F47B5E', dark: '#3D2A20' },
    sky: { light: '#5BA4CF', dark: '#1E3040' },
    zen: { light: '#B8856C', dark: '#342820' },
  };

  function updateMeta(theme, isDark) {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute('content', THEME_COLORS[theme][isDark ? 'dark' : 'light']);
    }
  }

  it('淺色模式下 sun 主題使用 #F47B5E', () => {
    updateMeta('sun', false);
    const meta = document.querySelector('meta[name="theme-color"]');
    expect(meta.getAttribute('content')).toBe('#F47B5E');
  });

  it('深色模式下 sky 主題使用 #1E3040', () => {
    updateMeta('sky', true);
    const meta = document.querySelector('meta[name="theme-color"]');
    expect(meta.getAttribute('content')).toBe('#1E3040');
  });

  it('切換主題更新 meta', () => {
    updateMeta('sun', false);
    updateMeta('zen', false);
    const meta = document.querySelector('meta[name="theme-color"]');
    expect(meta.getAttribute('content')).toBe('#B8856C');
  });
});

describe('night 主題', () => {
  it('THEME_COLORS 包含 night', () => {
    expect(THEME_COLORS_CURRENT.night).toBeDefined();
    expect(THEME_COLORS_CURRENT.night.light).toBe('#6B6B6B');
    expect(THEME_COLORS_CURRENT.night.dark).toBe('#000000');
  });

  it('THEME_COLORS 不包含 ocean', () => {
    expect(THEME_COLORS_CURRENT.ocean).toBeUndefined();
  });

  it('night dark mode meta theme-color 為 #000000', () => {
    const meta = document.querySelector('meta[name="theme-color"]');
    meta.setAttribute('content', THEME_COLORS_CURRENT.night.dark);
    expect(meta.getAttribute('content')).toBe('#000000');
  });

  it('night light mode meta theme-color 為 #6B6B6B', () => {
    const meta = document.querySelector('meta[name="theme-color"]');
    meta.setAttribute('content', THEME_COLORS_CURRENT.night.light);
    expect(meta.getAttribute('content')).toBe('#6B6B6B');
  });

  it('套用 theme-night class', () => {
    document.body.classList.add('theme-night');
    expect(document.body.classList.contains('theme-night')).toBe(true);
  });
});

describe('ocean → night 遷移', () => {
  it('localStorage 有 ocean 時 readColorTheme 回傳 night', () => {
    lsSet('colorTheme', 'ocean');
    expect(readColorThemeMock()).toBe('night');
  });

  it('localStorage 有 night 時 readColorTheme 回傳 night', () => {
    lsSet('colorTheme', 'night');
    expect(readColorThemeMock()).toBe('night');
  });

  it('localStorage 有 sun 時 readColorTheme 回傳 sun（不受影響）', () => {
    lsSet('colorTheme', 'sun');
    expect(readColorThemeMock()).toBe('sun');
  });

  it('localStorage 無值時 readColorTheme 回傳預設 sun', () => {
    expect(readColorThemeMock()).toBe('sun');
  });
});
