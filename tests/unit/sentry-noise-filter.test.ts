/**
 * src/lib/sentry.ts — beforeSend noise filter
 *
 * Daily-check 抓到 Sentry 兩個 issue 都是 Playwright/Lighthouse 噪音：
 *   - 7464853493 localhost:3001/login HeadlessChrome 502 backend down
 *   - 7504308794 localhost:3000/trip/.../edit HeadlessChrome React error #310
 *     (react-day-picker hooks mismatch under prod-mode minification)
 * userCount=0、1-min burst → 從未影響真實 user。
 *
 * filter 規則：URL match /\/\/(localhost|127\.0\.0\.1)(:|\/|$)/ 或
 * user-agent / browser.name match HeadlessChrome|Playwright|Lighthouse → drop。
 */
import { describe, it, expect } from 'vitest';
import type { ErrorEvent } from '@sentry/react';
import { isNoiseEvent } from '../../src/lib/sentry';

const baseEvent = (overrides: Partial<ErrorEvent>): ErrorEvent => ({
  ...overrides,
}) as ErrorEvent;

describe('isNoiseEvent', () => {
  it('drops localhost:3000 URL', () => {
    expect(isNoiseEvent(baseEvent({
      request: { url: 'http://localhost:3000/trip/x/edit' },
    }))).toBe(true);
  });

  it('drops localhost:3001 URL', () => {
    expect(isNoiseEvent(baseEvent({
      request: { url: 'http://localhost:3001/login' },
    }))).toBe(true);
  });

  it('drops 127.0.0.1 URL', () => {
    expect(isNoiseEvent(baseEvent({
      request: { url: 'http://127.0.0.1:8080/' },
    }))).toBe(true);
  });

  it('drops HeadlessChrome user-agent header', () => {
    expect(isNoiseEvent(baseEvent({
      request: { url: 'https://trip-planner-dby.pages.dev/', headers: { 'User-Agent': 'HeadlessChrome 145.0' } },
    }))).toBe(true);
  });

  it('drops Playwright UA header', () => {
    expect(isNoiseEvent(baseEvent({
      request: { url: 'https://trip-planner-dby.pages.dev/', headers: { 'User-Agent': 'Playwright/1.0' } },
    }))).toBe(true);
  });

  it('drops Lighthouse UA header', () => {
    expect(isNoiseEvent(baseEvent({
      request: { url: 'https://trip-planner-dby.pages.dev/', headers: { 'User-Agent': 'Chrome-Lighthouse' } },
    }))).toBe(true);
  });

  it('drops events where browser context name is HeadlessChrome', () => {
    expect(isNoiseEvent(baseEvent({
      request: { url: 'https://trip-planner-dby.pages.dev/' },
      contexts: { browser: { name: 'HeadlessChrome' } },
    }))).toBe(true);
  });

  it('drops SW register timeout AbortError (browser-side, 0 functional impact)', () => {
    expect(isNoiseEvent(baseEvent({
      request: { url: 'https://trip-planner-dby.pages.dev/' },
      exception: {
        values: [{
          type: 'AbortError',
          value: "Failed to register a ServiceWorker for scope ('https://trip-planner-dby.pages.dev/') with script ('https://trip-planner-dby.pages.dev/sw.js'): Timed out while trying to start the Service Worker.",
        }],
      },
    }))).toBe(true);
  });

  it('keeps a real ServiceWorker error that is not the startup timeout', () => {
    expect(isNoiseEvent(baseEvent({
      request: { url: 'https://trip-planner-dby.pages.dev/' },
      exception: {
        values: [{ type: 'TypeError', value: 'sw.js precache failed: bad-precache-response' }],
      },
    }))).toBe(false);
  });

  it('keeps real Chrome on production host', () => {
    expect(isNoiseEvent(baseEvent({
      request: {
        url: 'https://trip-planner-dby.pages.dev/trip/okinawa-trip-2026-Ray/edit',
        headers: { 'User-Agent': 'Mozilla/5.0 Chrome/120.0' },
      },
      contexts: { browser: { name: 'Chrome' } },
    }))).toBe(false);
  });

  it('keeps event with no url/UA/browser (defaults to ship)', () => {
    expect(isNoiseEvent(baseEvent({}))).toBe(false);
  });

  it('keeps event whose URL only mentions localhost in path (not host)', () => {
    expect(isNoiseEvent(baseEvent({
      request: { url: 'https://trip-planner-dby.pages.dev/docs/setup#localhost' },
    }))).toBe(false);
  });
});
