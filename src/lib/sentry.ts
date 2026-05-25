import { init, browserTracingIntegration, type ErrorEvent, type EventHint } from '@sentry/react';

// VITE_SENTRY_DSN is set via Cloudflare Pages environment variable.
// CSP connect-src in all HTML files includes https://*.ingest.us.sentry.io.

const LOCALHOST_URL_RE = /\/\/(?:localhost|127\.0\.0\.1)(?::|\/|$)/i;
const HEADLESS_UA_RE = /HeadlessChrome|Playwright|Lighthouse/i;

// Drop events from Playwright / Lighthouse / local preview. They run against
// `localhost` (or 127.0.0.1) with a HeadlessChrome user agent and spam the
// queue with environment-only failures (backend not running, SW blocked,
// react-day-picker hooks mismatch under prod-mode minification) that never
// surface for real users on trip-planner-dby.pages.dev. Real Chrome on the
// live host stays untouched.
export function isNoiseEvent(event: ErrorEvent): boolean {
  const url = event.request?.url ?? '';
  if (url && LOCALHOST_URL_RE.test(url)) return true;
  const ua = event.request?.headers?.['User-Agent'] ?? '';
  if (typeof ua === 'string' && HEADLESS_UA_RE.test(ua)) return true;
  const browserName = event.contexts?.browser?.name;
  if (typeof browserName === 'string' && HEADLESS_UA_RE.test(browserName)) return true;
  return false;
}

export function initSentry(): void {
  if (!import.meta.env.PROD) {
    // Dev mode: Sentry is intentionally not initialised.
    // Errors will only appear in the browser console.
    return;
  }

  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn) {
    // DSN not yet configured — skip silently.
    return;
  }

  init({
    dsn,
    integrations: [browserTracingIntegration()],
    // Sample 10 % of transactions to stay within the free quota.
    tracesSampleRate: 0.1,
    // Session Replay is intentionally disabled to conserve free quota.
    beforeSend(event: ErrorEvent, _hint: EventHint) {
      return isNoiseEvent(event) ? null : event;
    },
  });
}
