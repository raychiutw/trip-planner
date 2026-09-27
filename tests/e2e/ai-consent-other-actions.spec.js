import { test, expect } from '@playwright/test';
const { setupApiMocks, MOCK_TRIPS_LIST } = require('./api-mocks');

const disclosure = { version: 'test-v1', title: '測試版說明', processor: '測試處理方',
  dataCategories: ['行程資料'], purpose: '產生測試建議', revocation: '在聊天頁撤回' };

async function consent(page) {
  const state = { accepted: false, declined: false, readFails: 0, decisions: [] };
  await page.route('**/api/account/ai-data-consent', route => {
    if (route.request().method() === 'GET' && state.readFails > 0) {
      state.readFails--; return route.fulfill({ status: 503, json: { error: { code: 'SYS_DB_ERROR' } } });
    }
    if (route.request().method() === 'POST') {
      const decision = route.request().postDataJSON(); state.decisions.push(decision);
      state.accepted = decision.decision === 'accept'; state.declined = decision.decision === 'decline';
    }
    return route.fulfill({ json: { disclosure, status: state.accepted ? 'current' : state.declined ? 'declined' : 'not_accepted',
      acceptedVersion: state.accepted ? disclosure.version : null, acceptedAt: null, decidedAt: null } });
  });
  return state;
}

test('health check resumes only after C card acceptance', async ({ page }) => {
  await setupApiMocks(page);
  const tripId = MOCK_TRIPS_LIST[0].tripId;
  const approval = await consent(page);
  let posts = 0;
  await page.route(`**/api/trips/${tripId}/health-check`, route => {
    if (route.request().method() === 'POST') {
      posts++;
      if (!approval.accepted) return route.fulfill({ status: 403, json: { error: { code: 'AI_DATA_CONSENT_REQUIRED' } } });
      return route.fulfill({ json: { report: { tripId, status: 'pending', requestId: 1, findings: [], createdAt: '2026-09-25 03:00:00' } } });
    }
    return route.fulfill({ json: { report: null } });
  });
  await page.goto(`/trip/${tripId}/health`);
  await page.getByTestId('ai-health-start-btn').click();
  const card = page.getByTestId('ai-data-consent-card');
  await expect(card).toContainText('待執行：開始 AI 行程健檢');
  expect(posts).toBe(1);
  await card.getByRole('checkbox').check();
  await card.getByRole('button', { name: '同意並繼續' }).click();
  await expect.poll(() => posts).toBe(2);
  await expect(card).toHaveCount(0);
  expect(approval.decisions[0]).toMatchObject({ version: 'test-v1', decision: 'accept' });
});

test('note generation keeps the selected kind through C card acceptance', async ({ page }) => {
  await setupApiMocks(page);
  const tripId = MOCK_TRIPS_LIST[0].tripId;
  const approval = await consent(page);
  let posts = 0;
  await page.route(`**/api/trips/${tripId}/notes`, route => route.fulfill({ json: {
    flights: [], lodgings: [], reservations: [], pretripNotes: [], emergencyContacts: [],
  } }));
  await page.route(`**/api/trips/${tripId}/notes/ai-state`, route => route.fulfill({ json: { jobs: [] } }));
  await page.route(`**/api/trips/${tripId}/notes/tips/generate`, route => {
    posts++;
    if (!approval.accepted) return route.fulfill({ status: 403, json: { error: { code: 'AI_DATA_CONSENT_REQUIRED' } } });
    return route.fulfill({ json: { jobId: 1, requestId: 1, status: 'pending', generation: 1 } });
  });
  await page.goto(`/trip/${tripId}/notes`);
  const pretrip = page.getByTestId('trip-notes-section-head-pretrip');
  await expect(pretrip).toBeVisible();
  if (await pretrip.getAttribute('aria-expanded') !== 'true') await pretrip.click();
  await page.getByTestId('trip-notes-ai-btn-pretrip').click();
  const card = page.getByTestId('ai-data-consent-card');
  await expect(card).toContainText('待執行：AI 生成一般行前須知');
  expect(posts).toBe(1);
  await card.getByRole('checkbox').check();
  await card.getByRole('button', { name: '同意並繼續' }).click();
  await expect.poll(() => posts).toBe(2);
  await expect(card).toHaveCount(0);
});

test('declining the health disclosure leaves the report untouched and does not retry', async ({ page }) => {
  await setupApiMocks(page);
  const tripId = MOCK_TRIPS_LIST[0].tripId;
  const approval = await consent(page);
  let posts = 0;
  await page.route(`**/api/trips/${tripId}/health-check`, route => {
    if (route.request().method() === 'POST') {
      posts++; return route.fulfill({ status: 403, json: { error: { code: 'AI_DATA_CONSENT_REQUIRED' } } });
    }
    return route.fulfill({ json: { report: null } });
  });
  await page.goto(`/trip/${tripId}/health`);
  await page.getByTestId('ai-health-start-btn').click();
  const card = page.getByTestId('ai-data-consent-card');
  await expect(card).toBeVisible();
  await expect(card.getByRole('heading')).toBeFocused();
  await card.getByRole('button', { name: '拒絕，保留原內容' }).click();
  await expect(card).toHaveCount(0);
  await expect(page.getByTestId('ai-health-start-btn')).toBeFocused();
  expect(posts).toBe(1);
  expect(approval.decisions).toMatchObject([{ decision: 'decline', version: 'test-v1' }]);
  await expect(page.getByTestId('ai-health-empty')).toBeVisible();
});

test('a failed disclosure read resumes the pending health check after another device accepts', async ({ page }) => {
  await setupApiMocks(page);
  const tripId = MOCK_TRIPS_LIST[0].tripId;
  const approval = await consent(page);
  approval.readFails = 1;
  let posts = 0;
  await page.route(`**/api/trips/${tripId}/health-check`, route => {
    if (route.request().method() === 'POST') {
      posts++;
      if (!approval.accepted) return route.fulfill({ status: 403, json: { error: { code: 'AI_DATA_CONSENT_REQUIRED' } } });
      return route.fulfill({ json: { report: { tripId, status: 'pending', requestId: 3, findings: [], createdAt: '2026-09-25 03:00:00' } } });
    }
    return route.fulfill({ json: { report: null } });
  });
  await page.goto(`/trip/${tripId}/health`);
  await page.getByTestId('ai-health-start-btn').click();
  const card = page.getByTestId('ai-data-consent-card');
  await expect(card).toContainText('目前無法取得資料處理說明');
  approval.accepted = true;
  await card.getByRole('button', { name: '重新載入' }).click();
  await expect.poll(() => posts).toBe(2);
  await expect(card).toHaveCount(0);
  expect(approval.decisions).toHaveLength(0);
});
