import { test, expect, type Page } from '@playwright/test';

/**
 * ManagePage V1 vs V2 完整 computed styles 比對。
 * V1: /manage?v1=1
 * V2: /v2.html#/manage
 *
 * Mock API 讓兩版都渲染完整 chat UI。
 * 桌機 (1280x720) + 手機 (375x812) 各跑一輪。
 */

const MOCK_MY_TRIPS = [{ tripId: 'okinawa-trip-2026-Ray' }];
const MOCK_ALL_TRIPS = [{ tripId: 'okinawa-trip-2026-Ray', name: 'Ray 的沖繩之旅', published: 1 }];
const MOCK_REQUESTS = [
  {
    id: 1, trip_id: 'okinawa-trip-2026-Ray', mode: 'trip-edit',
    message: 'Day 3 午餐換成通堂拉麵', submitted_by: 'Ray',
    reply: '已更新 Day 3 午餐為通堂拉麵（小祿本店）。\n\n| 項目 | 內容 |\n|------|------|\n| 餐廳 | 通堂拉麵 |\n| 時間 | 12:00-13:00 |',
    status: 'completed' as const, created_at: '2026-03-25T10:00:00',
  },
  {
    id: 2, trip_id: 'okinawa-trip-2026-Ray', mode: 'trip-plan',
    message: '推薦 Day 5 下午的購物地點', submitted_by: null, reply: null,
    status: 'processing' as const, created_at: '2026-03-25T12:00:00',
  },
];

async function setupMock(page: Page) {
  await page.route('**/api/my-trips', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_MY_TRIPS) }));
  await page.route('**/api/trips?all=1', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_ALL_TRIPS) }));
  await page.route('**/api/requests*', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_REQUESTS) }));
}

/* ===== Style extraction helpers ===== */

type S = Record<string, string>;
const PROPS = ['fontSize', 'fontWeight', 'lineHeight', 'padding', 'margin', 'color', 'backgroundColor', 'borderRadius', 'opacity'] as const;

async function stylesBy(page: Page, method: 'css' | 'text' | 'aria' | 'id', key: string, filter?: string): Promise<S | null> {
  return page.evaluate(([m, k, f]) => {
    let el: Element | null = null;
    if (m === 'css') el = document.querySelector(k);
    else if (m === 'id') el = document.getElementById(k);
    else if (m === 'aria') el = document.querySelector(`[aria-label="${k}"]`);
    else {
      const all = Array.from(document.querySelectorAll('div,span,button,select,textarea,main'));
      el = all.find(e => {
        if (e.textContent?.trim() !== k) return false;
        if (f && !e.className.includes(f)) return false;
        // pick the deepest match (most specific)
        return e.children.length === 0 || e.childElementCount === 0 || e.innerHTML.trim() === k;
      }) || null;
    }
    if (!el) return null;
    const s = getComputedStyle(el);
    return {
      fontSize: s.fontSize, fontWeight: s.fontWeight, lineHeight: s.lineHeight,
      padding: s.padding, margin: s.margin, color: s.color,
      backgroundColor: s.backgroundColor, borderRadius: s.borderRadius, opacity: s.opacity,
    };
  }, [method, key, filter || '']);
}

function compare(v1: S, v2: S, label: string, skip: string[] = []) {
  for (const prop of PROPS) {
    if (skip.includes(prop)) continue;
    const a = v1[prop], b = v2[prop];
    if (prop === 'padding' || prop === 'margin') {
      const ap = a.split(/\s+/).map(v => parseFloat(v) || 0);
      const bp = b.split(/\s+/).map(v => parseFloat(v) || 0);
      for (let i = 0; i < Math.max(ap.length, bp.length); i++) {
        expect(Math.abs((ap[i] || 0) - (bp[i] || 0)), `${label}.${prop}[${i}] V1=${a} V2=${b}`).toBeLessThanOrEqual(2);
      }
    } else if (prop === 'fontWeight') {
      // normalize: "bold" = "700", "600" = "600"
      const normalize = (w: string) => w === 'bold' ? '700' : w === 'normal' ? '400' : w;
      expect(normalize(b), `${label}.${prop} V1=${a} V2=${b}`).toBe(normalize(a));
    } else if (prop === 'lineHeight') {
      // allow 1px diff
      const av = parseFloat(a) || 0, bv = parseFloat(b) || 0;
      if (av > 0 && bv > 0) {
        expect(Math.abs(av - bv), `${label}.${prop} V1=${a} V2=${b}`).toBeLessThanOrEqual(1.5);
      }
    } else if (prop === 'borderRadius') {
      // allow 1px diff per corner
      const ap = a.split(/\s+/).map(v => parseFloat(v) || 0);
      const bp = b.split(/\s+/).map(v => parseFloat(v) || 0);
      for (let i = 0; i < Math.max(ap.length, bp.length); i++) {
        expect(Math.abs((ap[i] || 0) - (bp[i] || 0)), `${label}.${prop}[${i}]`).toBeLessThanOrEqual(1);
      }
    } else {
      expect(b, `${label}.${prop}`).toBe(a);
    }
  }
}

/* ===== Element definitions to compare ===== */

interface ElementDef {
  name: string;
  v1: { method: 'css' | 'text' | 'aria' | 'id'; key: string; filter?: string };
  v2: { method: 'css' | 'text' | 'aria' | 'id'; key: string; filter?: string };
  skip?: string[];
}

const ELEMENTS: ElementDef[] = [
  {
    name: 'nav-bar',
    v1: { method: 'id', key: 'stickyNav' },
    v2: { method: 'id', key: 'stickyNav' },
    skip: ['padding', 'backgroundColor'], // V1 style.css 意外覆蓋，已知差異
  },
  {
    name: 'close-button',
    v1: { method: 'aria', key: '關閉' },
    v2: { method: 'aria', key: '關閉' },
    skip: ['fontSize', 'margin'], // V1 fontSize + margin 被 style.css 意外覆蓋
  },
  {
    name: 'trip-select',
    v1: { method: 'aria', key: '選擇行程' },
    v2: { method: 'aria', key: '選擇行程' },
  },
  {
    name: 'request-message',
    v1: { method: 'css', key: '.request-item-message' },
    v2: { method: 'text', key: 'Day 3 午餐換成通堂拉麵' },
  },
  {
    name: 'mode-badge-edit',
    v1: { method: 'css', key: '.request-mode-badge.mode-edit' },
    v2: { method: 'text', key: '改行程', filter: 'rounded-full' },
  },
  {
    name: 'request-meta-time',
    v1: { method: 'css', key: '.request-item-meta' },
    v2: { method: 'text', key: '3/25 下午06:00' },
  },
  {
    name: 'submitted-by',
    v1: { method: 'css', key: '.request-item-submitter' },
    v2: { method: 'text', key: 'Ray' },
  },
  {
    name: 'textarea',
    v1: { method: 'id', key: 'manageText' },
    v2: { method: 'id', key: 'manageText' },
  },
  {
    name: 'send-button',
    v1: { method: 'aria', key: '送出' },
    v2: { method: 'aria', key: '送出' },
    skip: ['fontSize', 'borderRadius'], // V1 fontSize 被 style.css 縮小；borderRadius 50% vs 9999px 都是圓形
  },
  {
    name: 'empty-state-card',
    v1: { method: 'css', key: '.request-item' },
    v2: { method: 'css', key: '[class*="bg-[var(--color-secondary)]"][class*="rounded-[var(--radius-md)]"]' },
    skip: ['margin'], // wrapper structure differs
  },
];

/* ===== Tests ===== */

for (const viewport of [
  { name: 'desktop', width: 1280, height: 720 },
  { name: 'mobile', width: 375, height: 812 },
]) {
  test.describe(`ManagePage V1 vs V2 — ${viewport.name} (${viewport.width}x${viewport.height})`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test('截圖比對', async ({ page }) => {
      await setupMock(page);

      await page.goto('/manage?v1=1');
      await page.waitForLoadState('networkidle');
      await page.waitForSelector('[aria-label="送出"]', { timeout: 5000 });
      await page.screenshot({ path: `.gstack/qa-reports/screenshots/manage-v1-${viewport.name}.png`, fullPage: true });

      await page.goto('/v2.html#/manage');
      await page.waitForLoadState('networkidle');
      await page.waitForSelector('[aria-label="送出"]', { timeout: 5000 });
      await page.screenshot({ path: `.gstack/qa-reports/screenshots/manage-v2-${viewport.name}.png`, fullPage: true });
    });

    for (const elem of ELEMENTS) {
      test(`${elem.name} styles 一致`, async ({ page }) => {
        await setupMock(page);

        // V1
        await page.goto('/manage?v1=1');
        await page.waitForLoadState('networkidle');
        await page.waitForSelector('[aria-label="送出"]', { timeout: 5000 });
        const v1 = await stylesBy(page, elem.v1.method, elem.v1.key, elem.v1.filter);

        // V2
        await page.goto('/v2.html#/manage');
        await page.waitForLoadState('networkidle');
        await page.waitForSelector('[aria-label="送出"]', { timeout: 5000 });
        const v2 = await stylesBy(page, elem.v2.method, elem.v2.key, elem.v2.filter);

        expect(v1, `V1 ${elem.name} not found`).not.toBeNull();
        expect(v2, `V2 ${elem.name} not found`).not.toBeNull();
        if (v1 && v2) compare(v1, v2, `${viewport.name}/${elem.name}`, elem.skip);
      });
    }

    test('V2 無 V1 CSS class', async ({ page }) => {
      await setupMock(page);
      await page.goto('/v2.html#/manage');
      await page.waitForLoadState('networkidle');
      const html = await page.evaluate(() => document.body.innerHTML);
      expect(html).not.toContain('class="manage-');
      expect(html).not.toContain('class="chat-');
      expect(html).not.toContain('class="request-item"');
      expect(html).not.toContain('class="request-mode-badge');
      expect(html).not.toContain('class="page-layout"');
    });
  });
}
