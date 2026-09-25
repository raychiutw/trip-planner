import { test, expect } from '@playwright/test';

async function setup(page) {
  const makeEntry = (id, dayId) => {
    const master = { poiId: id + 100, sortOrder: 1, name: `景點 ${id}`, type: 'attraction', lat: 25 + id / 100, lng: 127 };
    return { id, dayId, sortOrder: id, startTime: '09:00', endTime: '10:00', master, stopPois: [master], alternates: [] };
  };
  const days = [1, 2].map(n => ({ id: n, dayNum: n, date: `2026-09-2${n}`, timeline: n === 1 ? [11, 12, 13].map(id => makeEntry(id, n)) : [makeEntry(21, n)] }));
  const state = { denied: false, failTravel: false, writes: [], traffic: [] };
  await page.route('**/api/**', async route => {
    const request = route.request(); const url = new URL(request.url()); const path = url.pathname;
    const reply = (json, status = 200) => route.fulfill({ json, status });
    if (path === '/api/oauth/userinfo') return reply({ id: 'reader', email: 'reader@example.com' });
    if (path === '/api/my-trips') return reply([{ tripId: 't1', name: '排序測試', role: 'member' }]);
    if (path === '/api/trips/t1') return reply({ id: 't1', name: '排序測試', published: 1, countries: 'JP' });
    if (path === '/api/trips/t1/days') return reply(days);
    if (/\/days\/\d+$/.test(path)) return reply(days.find(d => d.dayNum === Number(path.split('/').at(-1))));
    if (path.endsWith('/segments')) return reply(days.flatMap(day => day.timeline.slice(1).map((entry, i) => ({
      id: entry.id, tripId: 't1', fromEntryId: day.timeline[i].id, toEntryId: entry.id,
      mode: 'driving', min: 10, distanceM: 2000, computedAt: 1,
    }))));
    if (path.endsWith('/recompute-travel')) { state.traffic.push(url.searchParams.get('day')); return reply({}, state.failTravel ? 503 : 200); }
    if (path.includes('/entries/')) {
      const id = Number(path.split('/').at(-1));
      const source = days.find(day => day.timeline.some(entry => entry.id === id));
      if (request.method() === 'GET') return reply(source?.timeline.find(entry => entry.id === id));
      state.writes.push(request.postDataJSON());
      if (state.denied) return reply({ error: { message: '沒有編輯權限' } }, 403);
      const updates = path.endsWith('/batch') ? request.postDataJSON().updates : [{ id, ...request.postDataJSON() }];
      for (const update of updates) {
        const from = days.find(day => day.timeline.some(entry => entry.id === update.id));
        const entry = from.timeline.find(entry => entry.id === update.id);
        if (update.day_id) {
          from.timeline = from.timeline.filter(item => item !== entry);
          days.find(day => day.id === update.day_id).timeline.push(entry); entry.dayId = update.day_id;
        }
        if (update.sort_order != null) entry.sortOrder = update.sort_order;
      }
      days.forEach(day => day.timeline.sort((a, b) => a.sortOrder - b.sortOrder));
      return reply({ ok: true });
    }
    return reply([]);
  });
  return state;
}

async function selectMenuByKeyboard(page, id, label) {
  await page.getByTestId(`timeline-rail-menu-${id}`).focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('menuitem').first()).toBeFocused();
  const item = page.getByRole('menuitem', { name: label, exact: true });
  for (let i = 0; i < 14; i++) {
    if (await item.evaluate(el => el === document.activeElement)) break;
    await page.keyboard.press('ArrowDown');
  }
  await expect(item).toBeFocused(); await page.keyboard.press('Enter');
}

test('keyboard ordering survives date switching and retries traffic without repeating the write', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); const state = await setup(page); state.failTravel = true;
  await page.goto('/trips?selected=t1');
  await selectMenuByKeyboard(page, 11, '下移一格');
  const day = page.locator('section[data-day="1"]');
  await expect(day.getByRole('alert')).toContainText('順序已儲存，交通待更新');
  expect(await day.locator('[data-scroll-anchor^="entry-"]').evaluateAll(els => els.map(el => el.getAttribute('data-scroll-anchor')))).toEqual(['entry-12', 'entry-11', 'entry-13']);
  await expect(page.getByTestId('timeline-rail-menu-11')).toBeFocused();
  await page.getByTestId('dn-day-2').click(); await page.getByTestId('dn-day-1').click();
  await expect(day.getByRole('alert')).toContainText('順序已儲存，交通待更新');
  state.failTravel = false; await day.getByRole('button', { name: '重試交通更新' }).click();
  await expect(day.getByRole('status')).toContainText('順序及交通已更新');
  await expect(page.getByTestId('timeline-rail-menu-11')).toBeFocused();
  expect(state.writes).toHaveLength(1); expect(state.traffic).toEqual(['1', '1']);
});

test('move without dragging returns to the moved entry in the destination day', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 }); const state = await setup(page);
  await page.goto('/trips?selected=t1');
  await page.getByTestId('timeline-rail-menu-11').click(); await page.getByRole('menuitem', { name: '移到其他天' }).click();
  await page.getByTestId('entry-action-day-2').click(); await page.getByTestId('entry-action-confirm').click();
  await expect(page).toHaveURL(/selected=t1&focus=11&focusDay=2/);
  const target = page.locator('section[data-day="2"]').getByTestId('timeline-rail-toggle-11');
  await expect(target).toHaveAttribute('aria-expanded', 'true'); await expect(target).toBeFocused(); await expect(target).toBeInViewport();
  expect(state.writes).toHaveLength(1); expect(state.traffic.sort()).toEqual(['1', '2']);
});

test('a viewer rejection leaves the original order and an explicit error', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); const state = await setup(page); state.denied = true;
  await page.goto('/trips?selected=t1');
  await page.getByTestId('timeline-rail-menu-11').click(); await page.getByRole('menuitem', { name: '下移一格' }).click();
  const day = page.locator('section[data-day="1"]'); await expect(day.getByRole('alert')).toContainText('沒有編輯權限');
  expect(await day.locator('[data-scroll-anchor^="entry-"]').evaluateAll(els => els.map(el => el.getAttribute('data-scroll-anchor')))).toEqual(['entry-11', 'entry-12', 'entry-13']);
  await expect(page.getByTestId('timeline-rail-menu-11')).toBeFocused(); expect(state.traffic).toEqual([]);
});
