import { test, expect, type Page } from '@playwright/test';

/**
 * V1 vs V2 完整 computed styles 比對。
 * 每個元素比對 7 個屬性：fontSize, padding, margin, color, backgroundColor, transition, opacity。
 *
 * 已知差異（V2 是正確行為，V1 被 style.css 意外覆蓋）：
 * - Nav bar padding: V1 12px (style.css) → V2 8px (shared.css)
 * - Nav bar bg alpha: V1 92% (style.css) → V2 72% (shared.css)
 * 這些差異用 skipProps 排除。
 */

type StyleObj = Record<string, string>;

const PROPS = ['fontSize', 'padding', 'margin', 'color', 'backgroundColor', 'transition', 'opacity'] as const;

/** 取得元素的 7 個 computed styles */
async function getStylesById(page: Page, id: string): Promise<StyleObj | null> {
  return page.evaluate((elId) => {
    const el = document.getElementById(elId);
    if (!el) return null;
    const s = getComputedStyle(el);
    return { fontSize: s.fontSize, padding: s.padding, margin: s.margin, color: s.color, backgroundColor: s.backgroundColor, transition: s.transition, opacity: s.opacity };
  }, id);
}

async function getStylesBySel(page: Page, selector: string): Promise<StyleObj | null> {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const s = getComputedStyle(el);
    return { fontSize: s.fontSize, padding: s.padding, margin: s.margin, color: s.color, backgroundColor: s.backgroundColor, transition: s.transition, opacity: s.opacity };
  }, selector);
}

async function getStylesByText(page: Page, text: string, extraFilter?: string): Promise<StyleObj | null> {
  return page.evaluate(([txt, filter]) => {
    const all = Array.from(document.querySelectorAll('div, span, button, select, input'));
    const el = all.find(e => {
      if (e.textContent?.trim() !== txt) return false;
      if (filter && !e.className.includes(filter)) return false;
      return true;
    });
    if (!el) return null;
    const s = getComputedStyle(el);
    return { fontSize: s.fontSize, padding: s.padding, margin: s.margin, color: s.color, backgroundColor: s.backgroundColor, transition: s.transition, opacity: s.opacity };
  }, [text, extraFilter || '']);
}

/** 比對 7 個 props，skipProps 跳過已知差異 */
function compareStyles(v1: StyleObj, v2: StyleObj, label: string, skipProps: string[] = []) {
  for (const prop of PROPS) {
    if (skipProps.includes(prop)) continue;

    const a = v1[prop];
    const b = v2[prop];

    if (prop === 'padding' || prop === 'margin') {
      // 允許 2px 差異（逐值比較）
      const aParts = a.split(/\s+/).map(v => parseFloat(v) || 0);
      const bParts = b.split(/\s+/).map(v => parseFloat(v) || 0);
      const maxLen = Math.max(aParts.length, bParts.length);
      for (let i = 0; i < maxLen; i++) {
        const diff = Math.abs((aParts[i] || 0) - (bParts[i] || 0));
        expect(diff, `${label}.${prop}[${i}] V1=${a} V2=${b}`).toBeLessThanOrEqual(2);
      }
    } else if (prop === 'transition') {
      // transition：只檢查「都有或都沒有」，具體值因 Tailwind 寫法不同不要求一致
      const aHas = a !== 'none' && a !== '' && a !== 'all 0s ease 0s';
      const bHas = b !== 'none' && b !== '' && b !== 'all 0s ease 0s';
      expect(bHas, `${label}.transition presence (V1=${aHas}, V2=${bHas})`).toBe(aHas);
    } else {
      // fontSize, color, backgroundColor, opacity: 精確比對
      expect(b, `${label}.${prop}`).toBe(a);
    }
  }
}

test.describe('AdminPage V1 vs V2 — 完整 7 屬性 computed styles 比對', () => {

  test('section title（選擇行程）', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    const v1 = await getStylesBySel(page, '.admin-section-title');

    await page.goto('/v2.html#/admin');
    await page.waitForLoadState('networkidle');
    const v2 = await getStylesByText(page, '選擇行程', 'uppercase');

    expect(v1).not.toBeNull();
    expect(v2).not.toBeNull();
    compareStyles(v1!, v2!, 'section-title');
  });

  test('section card（第一個卡片）', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    const v1 = await getStylesBySel(page, '.admin-section-card');

    await page.goto('/v2.html#/admin');
    await page.waitForLoadState('networkidle');
    const v2 = await page.evaluate(() => {
      const el = Array.from(document.querySelectorAll('div')).find(
        e => e.className.includes('rounded-[var(--radius-lg)]') && e.className.includes('bg-[var(--color-secondary)]')
      );
      if (!el) return null;
      const s = getComputedStyle(el);
      return { fontSize: s.fontSize, padding: s.padding, margin: s.margin, color: s.color, backgroundColor: s.backgroundColor, transition: s.transition, opacity: s.opacity };
    });

    expect(v1).not.toBeNull();
    expect(v2).not.toBeNull();
    compareStyles(v1!, v2!, 'section-card');
  });

  test('trip select', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    const v1 = await getStylesBySel(page, '.admin-trip-select');

    await page.goto('/v2.html#/admin');
    await page.waitForLoadState('networkidle');
    const v2 = await getStylesBySel(page, '[aria-label="選擇行程"]');

    expect(v1).not.toBeNull();
    expect(v2).not.toBeNull();
    compareStyles(v1!, v2!, 'trip-select');
  });

  test('email input', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    const v1 = await getStylesBySel(page, '.admin-email-input');

    await page.goto('/v2.html#/admin');
    await page.waitForLoadState('networkidle');
    const v2 = await getStylesBySel(page, '[placeholder="email@example.com"]');

    expect(v1).not.toBeNull();
    expect(v2).not.toBeNull();
    compareStyles(v1!, v2!, 'email-input');
  });

  test('新增按鈕', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    const v1 = await getStylesBySel(page, '.admin-add-btn');

    await page.goto('/v2.html#/admin');
    await page.waitForLoadState('networkidle');
    const v2 = await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.trim() === '新增');
      if (!btn) return null;
      const s = getComputedStyle(btn);
      return { fontSize: s.fontSize, padding: s.padding, margin: s.margin, color: s.color, backgroundColor: s.backgroundColor, transition: s.transition, opacity: s.opacity };
    });

    expect(v1).not.toBeNull();
    expect(v2).not.toBeNull();
    compareStyles(v1!, v2!, 'add-btn');
  });

  test('empty state（請先選擇行程）', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    const v1 = await getStylesBySel(page, '.admin-empty');

    await page.goto('/v2.html#/admin');
    await page.waitForLoadState('networkidle');
    const v2 = await getStylesByText(page, '請先選擇行程', 'text-center');

    expect(v1).not.toBeNull();
    expect(v2).not.toBeNull();
    compareStyles(v1!, v2!, 'empty-state');
  });

  test('close button', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    const v1 = await getStylesBySel(page, '.nav-close-btn');

    await page.goto('/v2.html#/admin');
    await page.waitForLoadState('networkidle');
    const v2 = await getStylesBySel(page, '[aria-label="關閉"]');

    expect(v1).not.toBeNull();
    expect(v2).not.toBeNull();
    // close button fontSize 有已知差異（V1 被 style.css 影響為 13.3px，V2 繼承 body 17px）
    compareStyles(v1!, v2!, 'close-btn', ['fontSize']);
  });

  test('nav title（權限管理）', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    const v1 = await getStylesBySel(page, '.nav-title');

    await page.goto('/v2.html#/admin');
    await page.waitForLoadState('networkidle');
    const v2 = await page.evaluate(() => {
      const el = Array.from(document.querySelectorAll('span')).find(e => e.textContent === '權限管理');
      if (!el) return null;
      const s = getComputedStyle(el);
      return { fontSize: s.fontSize, padding: s.padding, margin: s.margin, color: s.color, backgroundColor: s.backgroundColor, transition: s.transition, opacity: s.opacity };
    });

    expect(v1).not.toBeNull();
    expect(v2).not.toBeNull();
    compareStyles(v1!, v2!, 'nav-title');
  });

  test('nav bar（已知差異：padding + bg alpha）', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    const v1 = await getStylesById(page, 'stickyNav');

    await page.goto('/v2.html#/admin');
    await page.waitForLoadState('networkidle');
    const v2 = await getStylesById(page, 'stickyNav');

    expect(v1).not.toBeNull();
    expect(v2).not.toBeNull();
    // Nav bar 的 padding 和 backgroundColor 有已知差異（style.css 意外覆蓋）
    compareStyles(v1!, v2!, 'nav-bar', ['padding', 'backgroundColor']);
  });
});

test.describe('AdminPage V2 深色模式 + 6 主題', () => {

  test('深色模式', async ({ page }) => {
    await page.goto('/v2.html#/admin');
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => { document.body.classList.add('dark'); if (!document.body.classList.contains('theme-sun')) document.body.classList.add('theme-sun'); });
    await page.waitForTimeout(300);

    const bg = await page.evaluate(() => getComputedStyle(document.body).getPropertyValue('--color-background').trim());
    expect(bg.toLowerCase()).toBe('#1e1a16');
    await page.screenshot({ path: '/tmp/admin-v2-dark.png', fullPage: true });
  });

  const themes = [
    { name: 'Sky', class: 'theme-sky', accent: '#2870a0' },
    { name: 'Forest', class: 'theme-forest', accent: '#4a8c5c' },
    { name: 'Sakura', class: 'theme-sakura', accent: '#d4708a' },
    { name: 'Night', class: 'theme-night', accent: '#6b6b6b' },
    { name: 'Zen', class: 'theme-zen', accent: '#9a6b50' },
  ];

  for (const t of themes) {
    test(`${t.name} 主題`, async ({ page }) => {
      await page.goto('/v2.html#/admin');
      await page.waitForLoadState('networkidle');
      await page.evaluate((cls) => { document.body.className = cls; }, t.class);
      await page.waitForTimeout(300);

      const accent = await page.evaluate(() => getComputedStyle(document.body).getPropertyValue('--color-accent').trim());
      expect(accent.toLowerCase()).toBe(t.accent);
      await page.screenshot({ path: `/tmp/admin-v2-${t.name.toLowerCase()}.png`, fullPage: true });
    });
  }
});
