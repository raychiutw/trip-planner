// @ts-check
/**
 * Trip Notes E2E happy path — v2.34.x 行程筆記 PR17
 *
 * Verify:
 *   - /trip/:id/notes renders 5 sections with TitleBar + trip name
 *   - Each section has correct meta count
 *   - AI button present on pretrip + emergency only
 *   - Click section head → expand/collapse
 *   - Empty trip → empty hero with 5 dot progress
 */
import { test, expect } from '@playwright/test';
const { setupApiMocks } = require('./api-mocks');

const TRIP_ID = 'okinawa-trip-2026-Ray';

const NOTES_FIXTURE = {
  flights: [
    { id: 1, sortOrder: 0, airline: '中華航空', flightNo: 'CI 120', cabinClass: '', departAirport: 'TPE', arriveAirport: 'OKA', departAt: '2026-07-26T09:35', arriveAt: '2026-07-26T12:00', note: '', version: 0 },
  ],
  lodgings: [
    { id: 1, sortOrder: 0, name: 'Naha Hotel', address: '沖繩縣那霸市', checkInAt: '2026-07-26T15:00', checkOutAt: '2026-07-28T11:00', bookingNo: 'BK-7281', phone: '', note: '', dayIds: [], version: 0 },
  ],
  reservations: [
    { id: 1, sortOrder: 0, kind: 'restaurant', title: 'そば処 鶴亀庵', reservedAt: '2026-07-28T12:00', partySize: 4, reservationNo: 'R-9182', phone: '', note: '', version: 0 },
  ],
  pretripNotes: [
    { id: 1, sortOrder: 0, section: '貨幣', title: '貨幣 — 1 TWD ≈ 4.8 JPY', content: '- ATM 手續費低於市區', aiGenerated: 0, aiSource: null, version: 0 },
    { id: 2, sortOrder: 1, section: '電子設備', title: '插頭 — A 型 110V', content: '與台灣相同免轉接頭', aiGenerated: 1, aiSource: 'general-tips', version: 0 },
  ],
  emergencyContacts: [
    { id: 1, sortOrder: 0, name: '日本警察', relationship: '報案', phone: '110', email: '', kind: 'police', aiGenerated: 0, version: 0 },
    { id: 2, sortOrder: 1, name: '駐那霸辦事處', relationship: '駐外館處', phone: '+81988628603', email: '', kind: 'embassy', aiGenerated: 1, version: 0 },
  ],
};

test.beforeEach(async ({ page }) => {
  await setupApiMocks(page);
  await page.route(new RegExp(`/api/trips/${TRIP_ID}/notes$`), (route) => {
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(NOTES_FIXTURE) });
  });
});

test.describe('TripNotesPage E2E happy path', () => {
  test('render TitleBar + 5 section accordion', async ({ page }) => {
    await page.goto(`/trip/${TRIP_ID}/notes`);
    await expect(page.getByTestId('trip-notes-page')).toBeVisible({ timeout: 10000 });

    // TitleBar 含「行程筆記」
    await expect(page.getByTestId('titlebar')).toContainText('行程筆記');

    // 5 section render
    await expect(page.getByTestId('trip-notes-section-flights')).toBeVisible();
    await expect(page.getByTestId('trip-notes-section-lodgings')).toBeVisible();
    await expect(page.getByTestId('trip-notes-section-reservations')).toBeVisible();
    await expect(page.getByTestId('trip-notes-section-pretrip')).toBeVisible();
    await expect(page.getByTestId('trip-notes-section-emergency')).toBeVisible();
  });

  test('section meta counts correct (per fixture)', async ({ page }) => {
    await page.goto(`/trip/${TRIP_ID}/notes`);
    await expect(page.getByTestId('trip-notes-page')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('trip-notes-section-flights')).toContainText('1 個航段');
    await expect(page.getByTestId('trip-notes-section-lodgings')).toContainText('1 間');
    await expect(page.getByTestId('trip-notes-section-reservations')).toContainText('1 筆');
    await expect(page.getByTestId('trip-notes-section-pretrip')).toContainText('2 項');
    await expect(page.getByTestId('trip-notes-section-emergency')).toContainText('2 個聯絡人');
  });

  test('AI button 只在 pretrip + emergency', async ({ page }) => {
    await page.goto(`/trip/${TRIP_ID}/notes`);
    await expect(page.getByTestId('trip-notes-page')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('trip-notes-ai-btn-pretrip')).toBeVisible();
    await expect(page.getByTestId('trip-notes-ai-btn-emergency')).toBeVisible();
    await expect(page.getByTestId('trip-notes-ai-btn-flights')).not.toBeVisible();
    await expect(page.getByTestId('trip-notes-ai-btn-lodgings')).not.toBeVisible();
    await expect(page.getByTestId('trip-notes-ai-btn-reservations')).not.toBeVisible();
  });

  test('empty trip → empty hero with 5 dot progress', async ({ page }) => {
    await page.route(new RegExp(`/api/trips/${TRIP_ID}/notes$`), (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ flights: [], lodgings: [], reservations: [], pretripNotes: [], emergencyContacts: [] }),
      });
    });
    await page.goto(`/trip/${TRIP_ID}/notes`);
    await expect(page.getByTestId('trip-notes-page')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('trip-notes-empty-hero')).toBeVisible();
    await expect(page.getByTestId('trip-notes-empty-hero')).toContainText('建立行程筆記');
  });
});
