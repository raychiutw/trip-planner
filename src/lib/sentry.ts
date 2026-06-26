import { init, browserTracingIntegration, type ErrorEvent as SentryErrorEvent, type EventHint } from '@sentry/react';

// VITE_SENTRY_DSN is set via Cloudflare Pages environment variable.
// CSP connect-src in all HTML files includes https://*.ingest.us.sentry.io.

const LOCALHOST_URL_RE = /\/\/(?:localhost|127\.0\.0\.1)(?::|\/|$)/i;
const HEADLESS_UA_RE = /HeadlessChrome|Playwright|Lighthouse/i;
// SW 是純 enhancement（vite-plugin-pwa autoUpdate，navigateFallback:null，只 precache
// + runtime cache）。慢速裝置上瀏覽器 register('/sw.js') 會 reject AbortError
// "Timed out while trying to start the Service Worker"，冒泡成 unhandledrejection 進
// Sentry（93 次 / 0 user functional impact）。main.tsx 已對 getRegistration/update
// reject 靜默吞；此 timeout 來自 auto-injected register()，無 catch 點，改在這裡 drop。
const SW_REGISTER_TIMEOUT_RE = /Timed out while trying to start the Service Worker/i;

// Drop events from Playwright / Lighthouse / local preview. They run against
// `localhost` (or 127.0.0.1) with a HeadlessChrome user agent and spam the
// queue with environment-only failures (backend not running, SW blocked,
// react-day-picker hooks mismatch under prod-mode minification) that never
// surface for real users on trip-planner-dby.pages.dev. Real Chrome on the
// live host stays untouched.
export function isNoiseEvent(event: SentryErrorEvent): boolean {
  const url = event.request?.url ?? '';
  if (url && LOCALHOST_URL_RE.test(url)) return true;
  const ua = event.request?.headers?.['User-Agent'] ?? '';
  if (typeof ua === 'string' && HEADLESS_UA_RE.test(ua)) return true;
  const browserName = event.contexts?.browser?.name;
  if (typeof browserName === 'string' && HEADLESS_UA_RE.test(browserName)) return true;
  const exceptionValues = event.exception?.values ?? [];
  if (exceptionValues.some((v) => typeof v?.value === 'string' && SW_REGISTER_TIMEOUT_RE.test(v.value))) {
    return true;
  }
  return false;
}

export function initSentry(): void {
  if (!import.meta.env.PROD) {
    // Dev mode: Sentry is intentionally not initialised.
    // Errors will only appear in the browser console.
    // Still install explicit global listeners so dev console出明顯 trace（之前
    // unhandled rejection 在 dev mode 完全靜默）。
    installExplicitGlobalErrorListeners({ logOnly: true });
    return;
  }

  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn) {
    // DSN not yet configured — skip silently.
    installExplicitGlobalErrorListeners({ logOnly: true });
    return;
  }

  init({
    dsn,
    integrations: [browserTracingIntegration()],
    // Sample 10 % of transactions to stay within the free quota.
    tracesSampleRate: 0.1,
    // Session Replay is intentionally disabled to conserve free quota.
    beforeSend(event: SentryErrorEvent, _hint: EventHint) {
      return isNoiseEvent(event) ? null : event;
    },
  });

  // v2.33.125: 防禦性 explicit listener — Sentry 7+ globalHandlersIntegration
  // 預設已啟用會 capture window.onerror / unhandledrejection，但仍加 explicit
  // listener 保證 1) Sentry init fail 時仍有 console.error trace；2) 將來若
  // integrations option 被覆寫，我們不會 silently 失去 global capture。
  installExplicitGlobalErrorListeners({ logOnly: false });
}

let _globalListenersInstalled = false;

function installExplicitGlobalErrorListeners(opts: { logOnly: boolean }): void {
  if (_globalListenersInstalled || typeof window === 'undefined') return;
  _globalListenersInstalled = true;

  window.addEventListener('error', (event: ErrorEvent) => {
    const err = event.error ?? new Error(event.message || 'window.onerror (no error object)');
    console.error('[global window.onerror]', err);
    if (!opts.logOnly) {
      void import('@sentry/react').then(({ captureException }) => {
        captureException(err, {
          tags: { source: 'window.onerror' },
          extra: { filename: event.filename, lineno: event.lineno, colno: event.colno },
        });
      });
    }
  });

  window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    const reason = event.reason instanceof Error ? event.reason : new Error(String(event.reason));
    console.error('[global unhandledrejection]', reason);
    if (!opts.logOnly) {
      void import('@sentry/react').then(({ captureException }) => {
        captureException(reason, { tags: { source: 'unhandledrejection' } });
      });
    }
  });
}
