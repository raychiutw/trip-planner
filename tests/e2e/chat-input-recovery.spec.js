import { test, expect } from '@playwright/test';

async function setup(page, history = []) {
  const state = { rows: history, sends: [], stops: [], listFails: false };
  await page.addInitScript(() => {
    window.chatEvents = [];
    window.EventSource = class {
      constructor(url) { this.url = url; window.chatEvents.push(this); }
      close() { this.closed = true; }
    };
    const viewport = new EventTarget();
    Object.assign(viewport, { height: innerHeight, width: innerWidth, offsetTop: 0, offsetLeft: 0, scale: 1, pageTop: 0, pageLeft: 0 });
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport });
    window.setChatViewport = (height, offsetTop = 0) => {
      Object.assign(viewport, { height, offsetTop }); viewport.dispatchEvent(new Event('resize'));
    };
  });
  await page.route('**/api/**', async route => {
    const request = route.request(); const url = new URL(request.url()); const path = url.pathname;
    const reply = (json, status = 200) => route.fulfill({ json, status });
    if (path === '/api/oauth/userinfo') return reply({ id: 'reader', email: 'reader@example.com', displayName: 'Reader' });
    if (path === '/api/my-trips') return reply([{ tripId: 'a', name: 'A 行程' }, { tripId: 'b', name: 'B 行程' }], state.listFails ? 503 : 200);
    if (path === '/api/trips/a') return reply({ id: 'a', name: 'A 行程', published: 1, countries: 'JP' });
    if (path === '/api/trips/a/days') return reply([{ id: 1, dayNum: 1, date: '2026-09-21', timeline: [] }]);
    if (path === '/api/account/ai-authorization') return reply({ authorized: true });
    if (path === '/api/requests') {
      if (request.method() === 'POST') {
        const body = request.postDataJSON(); state.sends.push(body);
        const row = { ...body, id: 42, status: 'processing', createdAt: '2026-09-21T01:00:00Z' };
        state.rows.push(row); return reply(row);
      }
      return reply({ items: state.rows.filter(row => row.tripId === url.searchParams.get('tripId')), hasMore: false });
    }
    if (path === '/api/requests/42') {
      const row = state.rows.find(row => row.id === 42);
      if (request.method() === 'PATCH') { state.stops.push(request.postDataJSON()); Object.assign(row, request.postDataJSON()); }
      return reply(row);
    }
    return reply([]);
  });
  return state;
}

async function pick(page, trip) {
  await page.getByTestId('chat-trip-title').click();
  await page.getByTestId(`chat-trip-pick-${trip}`).click();
}

test('mobile keyboard keeps composer and reading area within the visual viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page, [{ id: 1, tripId: 'a', message: '歷史問題', status: 'completed', reply: '完整回覆\n'.repeat(50), createdAt: '2026-09-21T01:00:00Z' }]);
  await page.goto('/chat?tripId=a');
  const input = page.getByTestId('chat-input'); await input.fill('尚未送出的草稿');
  await page.evaluate(() => window.setChatViewport(500));
  await expect(page.locator('html')).toHaveAttribute('data-kb-open', '1');
  const composer = page.locator('.tp-chat-composer'); const body = page.getByTestId('chat-body');
  await expect.poll(async () => (await composer.boundingBox()).y + (await composer.boundingBox()).height).toBeLessThanOrEqual(500);
  await expect.poll(async () => (await body.boundingBox()).y + (await body.boundingBox()).height - (await composer.boundingBox()).y).toBeLessThanOrEqual(1);
  await expect(input).toBeFocused();
  const send = page.getByTestId('chat-send');
  expect((await send.boundingBox()).width).toBeGreaterThanOrEqual(44);
  await send.click({ trial: true });
  await page.evaluate(() => window.setChatViewport(innerHeight));
  await expect(page.locator('html')).not.toHaveAttribute('data-kb-open', '1');
  await expect(input).toHaveValue('尚未送出的草稿');
});

test('drafts stay with each trip and stopping returns keyboard focus without claiming AI was aborted', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); const state = await setup(page);
  await page.goto('/chat?tripId=a'); const input = page.getByTestId('chat-input');
  await input.fill('A 草稿'); await pick(page, 'b'); await expect(input).toHaveValue('');
  await input.fill('B 草稿'); await pick(page, 'a'); await expect(input).toHaveValue('A 草稿');
  await input.press('Enter');
  await expect(page.getByTestId('chat-stop-waiting')).toBeEnabled();
  await page.getByTestId('chat-stop-waiting').focus(); await page.keyboard.press('Enter');
  await expect(input).toBeEnabled(); await expect(input).toBeFocused();
  await expect(page.getByTestId('chat-msg-assistant')).toContainText('AI 若仍在處理');
  await expect(page.getByRole('status', { name: '聊天狀態' })).toContainText('已停止等待');
  expect(state.sends).toEqual([{ tripId: 'a', message: 'A 草稿' }]);
  expect(state.stops).toEqual([{ status: 'failed', terminalReason: 'cancelled' }]);
  state.rows[0].reply = '稍後收到的處理回報';
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByTestId('chat-msg-assistant')).toContainText('稍後收到的處理回報');
  await expect(page.getByRole('status', { name: '聊天狀態' })).toContainText('收到後續回報');
  await expect(page.getByTestId('chat-msg-assistant')).toHaveCount(1);
  await pick(page, 'b'); await expect(input).toHaveValue('B 草稿');
});

test('a failed trip list can be retried in mobile chat without becoming an empty account', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); const state = await setup(page); state.listFails = true;
  await page.goto('/chat');
  await expect(page.getByTestId('chat-retry-trips')).toBeVisible();
  await expect(page.getByText('還沒有行程可以聊')).toHaveCount(0);
  state.listFails = false; await page.getByTestId('chat-retry-trips').click();
  await expect(page.getByTestId('chat-input')).toBeEnabled();
  await expect(page.getByTestId('chat-trip-title')).toContainText('A 行程');
});


test('embedded desktop chat keeps its composer inside the sheet and sends to its locked trip', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 }); const state = await setup(page);
  await page.goto('/trips?selected=a&sheet=chat');
  const chat = page.locator('[data-testid="chat-page"][data-embedded="true"]');
  await expect(chat).toBeVisible();
  const input = chat.getByTestId('chat-input'); await input.fill('嵌入 A 的訊息');
  const composer = chat.locator('.tp-chat-composer');
  const sheet = page.getByTestId('tab-chat');
  expect((await composer.boundingBox()).y + (await composer.boundingBox()).height).toBeLessThanOrEqual((await sheet.boundingBox()).y + (await sheet.boundingBox()).height + 1);
  await chat.getByTestId('chat-send').click();
  await expect(chat.getByTestId('chat-stop-waiting')).toBeEnabled();
  expect(state.sends).toEqual([{ tripId: 'a', message: '嵌入 A 的訊息' }]);
});
