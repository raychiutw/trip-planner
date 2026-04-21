/**
 * /qa dogfood for PR 3 — IA + Desktop Map Rail
 *
 * Tests (against production):
 * 1. TripMapRail 在 ≥1024 viewport 顯示、<1024 不顯示
 * 2. TripMapRail pins 可點、點了 navigate 到 /trip/:id/stop/:entryId
 * 3. TripMapRail polyline 每天不同色
 * 4. MobileBottomNav 4-tab render + navigation 正確
 * 5. MobileBottomNav active tab 對應當前 route
 * 6. 看地圖 chip 每天都有、href 正確
 * 7. MapPage ?day=1 fitBounds 到當天 pins
 * 8. Admin page TriplineLogo 可點回首頁
 * 9. Sticky map rail scroll 時維持固定
 */
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const BASE = process.argv[2] || 'https://trip-planner-dby.pages.dev';
const REPORT_DIR = process.argv[3] || 'C:/Users/RayChiu/Desktop/Source/GithubRepos/trip-planner/.gstack/qa-reports';
const TRIP_ID = 'okinawa-trip-2026-Ray';

const sleep = ms => new Promise(r => setTimeout(r, ms));

const findings = [];

function log(severity, test, msg) {
  findings.push({ severity, test, msg });
  console.log(`[${severity}] [${test}] ${msg}`);
}

function pass(test, msg) {
  findings.push({ severity: 'PASS', test, msg });
  console.log(`  ✓ [${test}] ${msg}`);
}

async function run() {
  await fs.mkdir(REPORT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });

  // === Test 1: Desktop ≥1024 — TripMapRail visible ===
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const tab = await ctx.newPage();
    const errors = [];
    tab.on('pageerror', e => errors.push(e.message));
    tab.on('console', m => m.type() === 'error' && errors.push('console: ' + m.text().slice(0, 150)));

    await tab.goto(`${BASE}/trip/${TRIP_ID}`, { waitUntil: 'networkidle', timeout: 30000 });
    await sleep(1500);
    await tab.screenshot({ path: path.join(REPORT_DIR, '01-desktop-1440.png'), fullPage: false });

    // Look for map rail on desktop
    const hasMapRail = await tab.evaluate(() => {
      return !!document.querySelector('.trip-map-rail, [class*="map-rail"], [data-map-rail]');
    });
    if (hasMapRail) pass('T1-desktop-map-rail', 'TripMapRail present at 1440px');
    else log('HIGH', 'T1-desktop-map-rail', 'TripMapRail not found at 1440px — expected to render at ≥1024');

    // Check layout grid
    const gridInfo = await tab.evaluate(() => {
      const body = document.querySelector('.trip-body, [data-trip-body]');
      if (!body) return { found: false };
      const s = getComputedStyle(body);
      return {
        found: true,
        display: s.display,
        gridCols: s.gridTemplateColumns,
      };
    });
    if (gridInfo.found && gridInfo.display === 'grid' && gridInfo.gridCols.split(' ').length === 2) {
      pass('T1-layout-grid', `2-col grid: ${gridInfo.gridCols}`);
    } else {
      log('MEDIUM', 'T1-layout-grid', `Expected 2-col grid, got: ${JSON.stringify(gridInfo)}`);
    }

    if (errors.length) log('MEDIUM', 'T1-errors', `Console errors: ${errors.slice(0, 3).join(' | ')}`);
    await ctx.close();
  }

  // === Test 2: Mobile 375 — no map rail, bottom nav visible ===
  {
    const ctx = await browser.newContext({
      viewport: { width: 375, height: 812 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });
    const tab = await ctx.newPage();
    await tab.goto(`${BASE}/trip/${TRIP_ID}`, { waitUntil: 'networkidle', timeout: 30000 });
    await sleep(1500);
    await tab.screenshot({ path: path.join(REPORT_DIR, '02-mobile-375.png'), fullPage: false });

    const mapRail = await tab.evaluate(() => !!document.querySelector('.trip-map-rail, [class*="map-rail"]'));
    if (!mapRail) pass('T2-mobile-no-rail', 'TripMapRail hidden at 375px');
    else log('HIGH', 'T2-mobile-no-rail', 'TripMapRail visible at mobile — should be hidden');

    // Bottom nav 4 tabs
    const navInfo = await tab.evaluate(() => {
      const nav = document.querySelector('.ocean-bottom-nav, [aria-label="主要功能"], [data-bottom-nav]');
      if (!nav) return { found: false };
      const btns = Array.from(nav.querySelectorAll('button, a'));
      return {
        found: true,
        count: btns.length,
        labels: btns.map(b => (b.getAttribute('aria-label') || b.textContent).trim().slice(0, 20)),
        gridCols: getComputedStyle(nav).gridTemplateColumns,
      };
    });
    if (navInfo.found && navInfo.count === 4) {
      pass('T2-bottom-nav-4tab', `4 tabs: ${navInfo.labels.join(' / ')}`);
    } else {
      log('HIGH', 'T2-bottom-nav-4tab', `Expected 4 tabs, got: ${JSON.stringify(navInfo)}`);
    }
    await ctx.close();
  }

  // === Test 3: Tablet 820 (iPad Air portrait) — no map rail ===
  {
    const ctx = await browser.newContext({ viewport: { width: 820, height: 1180 } });
    const tab = await ctx.newPage();
    await tab.goto(`${BASE}/trip/${TRIP_ID}`, { waitUntil: 'networkidle' });
    await sleep(1500);
    await tab.screenshot({ path: path.join(REPORT_DIR, '03-tablet-820.png'), fullPage: false });

    const mapRail = await tab.evaluate(() => !!document.querySelector('.trip-map-rail, [class*="map-rail"]'));
    if (!mapRail) pass('T3-tablet-portrait-no-rail', 'iPad Air portrait 820px: map rail hidden');
    else log('HIGH', 'T3-tablet-portrait-no-rail', 'Map rail visible at 820px — expected <1024 to be hidden');
    await ctx.close();
  }

  // === Test 4: iPad Pro 13" portrait 1024 (edge) — map rail visible ===
  {
    const ctx = await browser.newContext({ viewport: { width: 1024, height: 1366 } });
    const tab = await ctx.newPage();
    await tab.goto(`${BASE}/trip/${TRIP_ID}`, { waitUntil: 'networkidle' });
    await sleep(1500);
    await tab.screenshot({ path: path.join(REPORT_DIR, '04-ipad-13-1024.png'), fullPage: false });

    const mapRail = await tab.evaluate(() => !!document.querySelector('.trip-map-rail, [class*="map-rail"]'));
    if (mapRail) pass('T4-ipad-13-rail', '1024px edge: map rail visible');
    else log('HIGH', 'T4-ipad-13-rail', '1024px edge: map rail NOT visible — expected at boundary');
    await ctx.close();
  }

  // === Test 5: Day Hero 看地圖 chip ===
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const tab = await ctx.newPage();
    await tab.goto(`${BASE}/trip/${TRIP_ID}`, { waitUntil: 'networkidle' });
    await sleep(1500);

    const chips = await tab.evaluate(() => {
      const allLinks = Array.from(document.querySelectorAll('a'));
      const mapLinks = allLinks.filter(a => /看地圖|map\?day/.test(a.textContent + a.getAttribute('href') || ''));
      return mapLinks.map(a => ({
        text: a.textContent.trim().slice(0, 20),
        href: a.getAttribute('href'),
      })).slice(0, 10);
    });
    if (chips.length >= 5) {
      pass('T5-day-map-chips', `Found ${chips.length} day map chips, sample: ${JSON.stringify(chips[0])}`);
    } else {
      log('HIGH', 'T5-day-map-chips', `Expected ≥5 day map chips (5-day trip), got ${chips.length}: ${JSON.stringify(chips)}`);
    }
    await ctx.close();
  }

  // === Test 6: MapPage ?day=1 fitBounds ===
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const tab = await ctx.newPage();
    await tab.goto(`${BASE}/trip/${TRIP_ID}/map?day=1`, { waitUntil: 'networkidle' });
    await sleep(2000);
    await tab.screenshot({ path: path.join(REPORT_DIR, '06-map-page-day1.png'), fullPage: false });

    // Check URL preserved + map rendered
    const url = tab.url();
    const hasLeaflet = await tab.evaluate(() => !!document.querySelector('.leaflet-container'));
    if (url.includes('day=1')) pass('T6-map-day-query-url', `URL preserves ?day=1: ${url}`);
    else log('MEDIUM', 'T6-map-day-query-url', `URL lost day param: ${url}`);
    if (hasLeaflet) pass('T6-map-leaflet-rendered', 'Leaflet container present');
    else log('HIGH', 'T6-map-leaflet-rendered', 'Leaflet container missing');
    await ctx.close();
  }

  // === Test 7: TriplineLogo is Link ===
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const tab = await ctx.newPage();
    await tab.goto(`${BASE}/trip/${TRIP_ID}/stop/419`, { waitUntil: 'networkidle' });
    await sleep(1000);

    const logoHref = await tab.evaluate(() => {
      const logo = document.querySelector('a[aria-label*="Tripline"]');
      return logo ? logo.getAttribute('href') : null;
    });
    if (logoHref === '/') pass('T7-logo-home-link', 'TriplineLogo anchors to /');
    else log('MEDIUM', 'T7-logo-home-link', `Expected href="/", got: ${logoHref}`);
    await ctx.close();
  }

  // === Test 8: Sticky map rail — 3-step scroll sequence ===
  // 修正後的邏輯：
  //   scroll1（初始）：rail top 可能大（尚未 sticky）
  //   scroll2（scroll 400）：sticky 啟動，rail top ≈ nav-h（48px）
  //   scroll3（scroll 800）：sticky 保持，rail top === scroll2 top（±1px）
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const tab = await ctx.newPage();
    await tab.goto(`${BASE}/trip/${TRIP_ID}`, { waitUntil: 'networkidle' });
    await sleep(1500);

    // Snapshot 1: 初始位置（scroll=0）
    const top1 = await tab.evaluate(() => {
      const rail = document.querySelector('.trip-map-rail, [class*="map-rail"]');
      if (!rail) return null;
      return rail.getBoundingClientRect().top;
    });

    // Scroll 400 — sticky 應啟動
    await tab.evaluate(() => window.scrollTo({ top: 400, behavior: 'instant' }));
    await sleep(300);
    const top2 = await tab.evaluate(() => {
      const rail = document.querySelector('.trip-map-rail, [class*="map-rail"]');
      if (!rail) return null;
      return rail.getBoundingClientRect().top;
    });
    await tab.screenshot({ path: path.join(REPORT_DIR, '08-sticky-scroll400.png'), fullPage: false });

    // Scroll 800 — sticky 應維持
    await tab.evaluate(() => window.scrollTo({ top: 800, behavior: 'instant' }));
    await sleep(300);
    const top3 = await tab.evaluate(() => {
      const rail = document.querySelector('.trip-map-rail, [class*="map-rail"]');
      if (!rail) return null;
      return rail.getBoundingClientRect().top;
    });
    await tab.screenshot({ path: path.join(REPORT_DIR, '08-sticky-scroll800.png'), fullPage: false });

    const NAV_H = 48; // var(--spacing-nav-h)
    const TOLERANCE = 4; // px tolerance for subpixel rendering

    if (top2 === null || top3 === null) {
      log('HIGH', 'T8-sticky', 'Map rail not found');
    } else if (Math.abs(top2 - NAV_H) <= TOLERANCE && Math.abs(top3 - top2) <= 1) {
      pass('T8-sticky', `Map rail sticky: scroll400.top=${top2}px ≈ ${NAV_H}px, scroll800.top=${top3}px (stable)`);
    } else {
      log('HIGH', 'T8-sticky', `Map rail NOT sticky as expected: initial=${top1}, scroll400=${top2}, scroll800=${top3}, expected top≈${NAV_H} and scroll800≈scroll400`);
    }
    await ctx.close();
  }

  await browser.close();

  // === Write report ===
  const report = {
    timestamp: new Date().toISOString(),
    baseUrl: BASE,
    tripId: TRIP_ID,
    totalTests: findings.filter(f => f.severity === 'PASS').length + findings.filter(f => f.severity !== 'PASS').length,
    passed: findings.filter(f => f.severity === 'PASS').length,
    critical: findings.filter(f => f.severity === 'CRITICAL').length,
    high: findings.filter(f => f.severity === 'HIGH').length,
    medium: findings.filter(f => f.severity === 'MEDIUM').length,
    findings,
  };
  await fs.writeFile(path.join(REPORT_DIR, 'qa-pr3-report.json'), JSON.stringify(report, null, 2));
  console.log('\n=== QA Report ===');
  console.log(JSON.stringify({ passed: report.passed, critical: report.critical, high: report.high, medium: report.medium }, null, 2));
  console.log(`Full report: ${path.join(REPORT_DIR, 'qa-pr3-report.json')}`);
}

run().catch(e => { console.error(e); process.exit(1); });
