import { test, expect } from '@playwright/test';

async function setup(page, history = []) {
  const state = { rows: history, sends: [], stops: [], listFails: false, consent: null, decisions: [], consentFailures: 0, consentLostResponse: false, rejectNextSend: false, decisionBarrier: null };
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
    if (path === '/api/account/ai-data-consent') {
      if (request.method() === 'POST' || request.method() === 'DELETE') {
        const decision = request.postDataJSON(); state.decisions.push(decision);
        if (state.decisionBarrier) await state.decisionBarrier;
        if (state.consentFailures > 0) { state.consentFailures--; return reply({ error: { code: 'SYS_DB_ERROR' } }, 503); }
        state.consent = { ...state.consent, status: decision.decision === 'accept' ? 'current' : decision.decision === 'revoke' ? 'revoked' : 'declined',
          acceptedVersion: decision.decision === 'accept' ? decision.version : null };
        if (state.consentLostResponse) { state.consentLostResponse = false; return reply({ error: { code: 'SYS_DB_ERROR' } }, 503); }
      }
      return reply(state.consent ?? { disclosure: null, status: 'unconfigured', acceptedVersion: null, acceptedAt: null, decidedAt: null });
    }
    if (path === '/api/requests') {
      if (request.method() === 'POST') {
        if (state.rejectNextSend) { state.rejectNextSend = false; return reply({ error: { code: 'AI_DATA_CONSENT_REQUIRED' } }, 403); }
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
  const hiddenNav = page.getByTestId('global-bottom-nav-trips');
  await expect(hiddenNav).not.toBeVisible();
  await hiddenNav.evaluate(el => el.focus());
  await expect(input).toBeFocused();
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

test('versioned AI data consent keeps the draft and sends only after an explicit choice', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 600 });
  const state = await setup(page);
  state.consent = { disclosure: { version: 'test-v1', title: '測試版說明', processor: '測試處理方',
    dataCategories: ['行程文字'], purpose: '回答測試訊息', revocation: '在帳戶設定撤回' },
    status: 'not_accepted', acceptedVersion: null, acceptedAt: null, decidedAt: null };
  await page.goto('/chat?tripId=a');
  const input = page.getByTestId('chat-input');
  await input.fill('保留這段草稿');
  await input.press('Enter');
  const card = page.getByTestId('ai-data-consent-card');
  await expect(card).toContainText('測試版說明 · 版本 test-v1');
  await expect(input).toHaveValue('保留這段草稿');
  await expect(input).not.toBeFocused();
  const composer = page.locator('.tp-chat-composer');
  await expect.poll(async () => (await composer.boundingBox()).y + (await composer.boundingBox()).height).toBeLessThanOrEqual(600);
  expect(state.sends).toHaveLength(0);
  const accept = card.getByRole('button', { name: '同意並送出' });
  await expect(accept).toBeDisabled();
  await card.getByRole('checkbox').check();
  await accept.click();
  await expect(card).not.toBeVisible();
  await expect.poll(() => state.sends.length).toBe(1);
  expect(state.decisions).toMatchObject([{ version: 'test-v1', decision: 'accept' }]);
  expect(state.sends).toEqual([{ tripId: 'a', message: '保留這段草稿' }]);
});

test('current consent can be withdrawn from chat before another AI request', async ({ page }) => {
  const state = await setup(page);
  state.consent = { disclosure: { version: 'test-v1', title: '測試版說明', processor: '測試處理方',
    dataCategories: ['行程文字'], purpose: '回答測試訊息', revocation: '在聊天頁撤回' },
    status: 'current', acceptedVersion: 'test-v1', acceptedAt: '2026-09-26T00:00:00Z', decidedAt: '2026-09-26T00:00:00Z' };
  await page.goto('/chat?tripId=a');
  await page.getByRole('button', { name: '管理 AI 資料同意' }).click();
  const card = page.getByTestId('ai-data-consent-card');
  await expect(card).toContainText('你已同意目前版本');
  await card.getByRole('button', { name: '撤回 AI 資料同意' }).click();
  await expect(card).not.toBeVisible();
  expect(state.decisions).toMatchObject([{ version: 'test-v1', decision: 'revoke' }]);
  const input = page.getByTestId('chat-input');
  await input.fill('撤回後的草稿'); await input.press('Enter');
  await expect(card).toContainText('撤回後的草稿');
  expect(state.sends).toHaveLength(0);
});

test('failed consent save keeps the draft and reuses the decision key on retry', async ({ page }) => {
  const state = await setup(page);
  state.consent = { disclosure: { version: 'test-v1', title: '測試版說明', processor: '測試處理方',
    dataCategories: ['行程文字'], purpose: '回答測試訊息', revocation: '在聊天頁撤回' },
    status: 'not_accepted', acceptedVersion: null, acceptedAt: null, decidedAt: null };
  state.consentFailures = 1;
  await page.goto('/chat?tripId=a');
  const input = page.getByTestId('chat-input'); await input.fill('失敗後仍要送出的草稿'); await input.press('Enter');
  const card = page.getByTestId('ai-data-consent-card');
  await card.getByRole('checkbox').check();
  await card.getByRole('button', { name: '同意並送出' }).click();
  await expect(card.getByRole('alert')).toContainText('訊息仍保留');
  await expect(input).toHaveValue('失敗後仍要送出的草稿');
  expect(state.sends).toHaveLength(0);
  await card.getByRole('button', { name: '同意並送出' }).click();
  await expect.poll(() => state.sends.length).toBe(1);
  expect(state.decisions).toHaveLength(2);
  expect(state.decisions[1].requestId).toBe(state.decisions[0].requestId);
});

test('a lost accept response resumes the pending send after status confirms acceptance', async ({ page }) => {
  const state = await setup(page);
  state.consent = { disclosure: { version: 'test-v1', title: '測試版說明', processor: '測試處理方',
    dataCategories: ['行程文字'], purpose: '回答測試訊息', revocation: '在聊天頁撤回' },
    status: 'not_accepted', acceptedVersion: null, acceptedAt: null, decidedAt: null };
  state.consentLostResponse = true;
  await page.goto('/chat?tripId=a');
  const input = page.getByTestId('chat-input'); await input.fill('回應遺失後續送'); await input.press('Enter');
  const card = page.getByTestId('ai-data-consent-card');
  await card.getByRole('checkbox').check();
  await card.getByRole('button', { name: '同意並送出' }).click();
  await expect.poll(() => state.sends.length).toBe(1);
  expect(state.decisions).toHaveLength(1);
  await expect(card).toHaveCount(0);
});

test('server consent rejection refreshes a changed version and preserves the attempted message', async ({ page }) => {
  const state = await setup(page);
  const disclosure = { version: 'test-v1', title: '測試版說明', processor: '測試處理方',
    dataCategories: ['行程文字'], purpose: '回答測試訊息', revocation: '在聊天頁撤回' };
  state.consent = { disclosure, status: 'current', acceptedVersion: 'test-v1', acceptedAt: null, decidedAt: null };
  await page.goto('/chat?tripId=a');
  const input = page.getByTestId('chat-input');
  await expect(page.getByRole('button', { name: '管理 AI 資料同意' })).toBeVisible();
  state.consent = { ...state.consent, disclosure: { ...disclosure, version: 'test-v2' }, status: 'outdated' };
  state.rejectNextSend = true;
  await input.fill('跨裝置更新後的草稿'); await input.press('Enter');
  const card = page.getByTestId('ai-data-consent-card');
  await expect(card).toContainText('版本 test-v2');
  await expect(input).toHaveValue('跨裝置更新後的草稿');
  await card.getByRole('checkbox').check();
  await card.getByRole('button', { name: '同意並送出' }).click();
  await expect.poll(() => state.sends.length).toBe(1);
  expect(state.sends[0].message).toBe('跨裝置更新後的草稿');
});

test('a delayed consent decision cannot send into another trip', async ({ page }) => {
  const state = await setup(page);
  state.consent = { disclosure: { version: 'test-v1', title: '測試版說明', processor: '測試處理方',
    dataCategories: ['行程文字'], purpose: '回答測試訊息', revocation: '在聊天頁撤回' },
    status: 'not_accepted', acceptedVersion: null, acceptedAt: null, decidedAt: null };
  let release;
  state.decisionBarrier = new Promise(resolve => { release = resolve; });
  await page.goto('/chat?tripId=a');
  const input = page.getByTestId('chat-input'); await input.fill('A 的待送訊息'); await input.press('Enter');
  const card = page.getByTestId('ai-data-consent-card');
  await card.getByRole('checkbox').check();
  await card.getByRole('button', { name: '同意並送出' }).click();
  await expect.poll(() => state.decisions.length).toBe(1);
  await pick(page, 'b');
  await input.fill('B 的草稿');
  release();
  await expect(input).toHaveValue('B 的草稿');
  await expect(card).toHaveCount(0);
  expect(state.sends).toHaveLength(0);
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
