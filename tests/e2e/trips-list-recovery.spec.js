import { test, expect } from '@playwright/test';

async function setup(page) {
  const state = {
    summaries: Array.from({ length: 30 }, (_, i) => ({ tripId: `t${i + 1}`, name: `旅程 ${i + 1}`, title: `旅程 ${i + 1} ${'很長的行程名稱'.repeat(4)}`,
      owner: i % 2 ? 'friend@example.com' : 'reader@example.com', countries: 'JP', published: 1, totalDays: 2, archivedAt: null })),
    reads: [],
  };
  const days = [1, 2].map(day => ({ id: day, dayNum: day, date: `2026-10-0${day}`, timeline: Array.from({ length: 18 }, (_, i) => {
    const id = day * 100 + i; const master = { poiId: id, name: `景點 ${id}`, type: 'attraction' };
    return { id, dayId: day, sortOrder: i, startTime: '09:00', endTime: '10:00', master, stopPois: [master], alternates: [] };
  }) }));
  await page.route(/maps\.googleapis\.com/, route => route.abort());
  await page.route('**/api/**', route => {
    const url = new URL(route.request().url()); const path = url.pathname;
    state.reads.push(path); const reply = json => route.fulfill({ json });
    if (path === '/api/oauth/userinfo') return reply({ id: 'reader', email: 'reader@example.com', displayName: 'Reader' });
    if (path === '/api/my-trips') return reply(state.summaries);
    if (/^\/api\/trips\/t\d+$/.test(path)) return reply({ id: path.split('/').at(-1), name: '完整行程', published: 1, countries: 'JP' });
    if (path.endsWith('/days')) return reply(days);
    if (/\/days\/\d+$/.test(path)) return reply(days.find(day => day.dayNum === Number(path.split('/').at(-1))));
    return reply([]);
  });
  return state;
}

async function refreshSummaries(page) {
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('tp-trips-updated')));
}

test('mobile back/forward preserves the list reading position and returns focus to its card', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); const state = await setup(page);
  await page.goto('/trips');
  const list = page.getByTestId('trips-list-page'); const card = page.getByTestId('trips-list-card-t21');
  await card.scrollIntoViewIfNeeded(); const top = await list.evaluate(el => el.scrollTop);
  expect(top).toBeGreaterThan(500);
  await card.click(); await expect(page).toHaveURL(/selected=t21/); await expect(page.getByTestId('timeline-rail-toggle-101')).toBeAttached();
  await page.goBack(); await expect(list).toBeVisible();
  await expect.poll(() => list.evaluate((el, saved) => Math.abs(el.scrollTop - saved), top)).toBeLessThan(3);
  await expect(card).toBeFocused();
  await page.goForward(); await expect(page).toHaveURL(/selected=t21/);
  await expect(page.getByTestId('timeline-rail-toggle-101')).toBeAttached();
  await page.getByRole('button', { name: '返回行程列表' }).click();
  await expect.poll(() => list.evaluate((el, saved) => Math.abs(el.scrollTop - saved), top)).toBeLessThan(3);
  await expect(card).toBeFocused();
  expect(state.reads.filter(path => path === '/api/my-trips')).toHaveLength(1);
});

for (const width of [390, 1280]) {
  test(`summary/archive refresh preserves selected detail and nonzero scroll at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 }); const state = await setup(page);
    await page.goto('/trips?selected=t21');
    await expect(page.getByTestId('timeline-rail-toggle-101')).toBeAttached();
    const main = page.locator('.app-shell-main').first();
    await main.evaluate(el => { el.scrollTop = 700; });
    await expect.poll(() => main.evaluate(el => el.scrollTop)).toBeGreaterThan(500);
    const top = await main.evaluate(el => el.scrollTop);
    const tripReads = state.reads.filter(path => path === '/api/trips/t21').length;
    state.summaries = state.summaries.map(trip => trip.tripId === 't21' ? { ...trip, title: '摘要更新後的封存行程', archivedAt: '2026-09-25T00:00:00Z' } : trip);
    await refreshSummaries(page);
    await expect(page.getByTestId('trips-trip-title')).toContainText('摘要更新後的封存行程');
    await expect(page).toHaveURL(/selected=t21/);
    await expect.poll(() => main.evaluate((el, saved) => Math.abs(el.scrollTop - saved), top)).toBeLessThan(3);
    expect(state.reads.filter(path => path === '/api/trips/t21')).toHaveLength(tripReads);
    await page.reload();
    await expect(page).toHaveURL(/selected=t21/); await expect(page.getByTestId('timeline-rail-toggle-101')).toBeAttached();
    await expect(page.getByTestId('trips-trip-title')).toContainText('摘要更新後的封存行程');
  });
}
