import {
  init,
  browserTracingIntegration,
  type ErrorEvent as SentryErrorEvent,
  type Event as SentryEvent,
  type EventHint,
} from '@sentry/react';

// VITE_SENTRY_DSN is set via Cloudflare Pages environment variable.
// CSP connect-src in all HTML files includes https://*.ingest.us.sentry.io.

const LOCALHOST_URL_RE = /\/\/(?:localhost|127\.0\.0\.1)(?::|\/|$)/i;
const HEADLESS_UA_RE = /HeadlessChrome|Playwright|Lighthouse/i;
// SW 是純 enhancement（vite-plugin-pwa autoUpdate，navigateFallback:null，只 precache
// + runtime cache）。慢速裝置上瀏覽器 register('/sw.js') 會 reject AbortError，冒泡成
// unhandledrejection 進 Sentry（0 user functional impact）。同一 root cause 有兩個 message
// 變體：「Timed out while trying to start the Service Worker」與「Operation has been
// aborted」。main.tsx 已對 getRegistration/update reject 靜默吞；此 reject 來自
// auto-injected register()，無 catch 點，改在這裡 drop。比對 SW-register 前綴避免誤殺
// 其他 AbortError（例如 fetch abort 也叫「Operation has been aborted」）。
const SW_REGISTER_NOISE_RE =
  /Failed to register a ServiceWorker[\s\S]*?(?:Timed out while trying to start the Service Worker|Operation has been aborted)/i;
// 同一 root cause 還有第三個訊息變體：value 就只是通用的「Rejected」，訊息文字比對
// 抓不到。改認 stack frame — vite-plugin-pwa 自動注入的 registerSW.js 呼叫
// navigator.serviceWorker.register() 這個呼叫點穩定不變，比訊息文字更可靠
// （issue 7525493273，Chrome 149 / Windows，0 user 影響）。
// 只在 value 恰好是這個無資訊量的「Rejected」時才用 frame 比對放行 drop —
// 只認 frame、不管 value 會連同一呼叫點上真正有意義的錯誤（CSP 擋、precache
// 壞掉等）一起靜默吞掉，等於做出一個監控死角（codex adversarial review 抓到）。
const SW_REGISTER_FILE_RE = /\/registerSW\.js$/;
const GENERIC_REJECTED_VALUE = 'Rejected';

// Drop events from Playwright / Lighthouse / local preview. They run against
// `localhost` (or 127.0.0.1) with a HeadlessChrome user agent and spam the
// queue with environment-only failures (backend not running, SW blocked,
// react-day-picker hooks mismatch under prod-mode minification) that never
// surface for real users on trip-planner-dby.pages.dev. Real Chrome on the
// live host stays untouched.
//
// Accepts both error and transaction events (base SentryEvent): our synthetic
// monitoring (browse / canary / route-health HeadlessChrome) also emits pageload
// transactions, which pile up into false "Large Render Blocking Asset"
// performance issues (16/17 events were HeadlessChrome). Transaction events carry
// no `exception`, so the SW-noise branch simply no-ops for them — only the
// localhost/UA/browser.name environment checks apply there.
export function isNoiseEvent(event: SentryEvent): boolean {
  const url = event.request?.url ?? '';
  if (url && LOCALHOST_URL_RE.test(url)) return true;
  const ua = event.request?.headers?.['User-Agent'] ?? '';
  if (typeof ua === 'string' && HEADLESS_UA_RE.test(ua)) return true;
  const browserName = event.contexts?.browser?.name;
  if (typeof browserName === 'string' && HEADLESS_UA_RE.test(browserName)) return true;
  const exceptionValues = event.exception?.values ?? [];
  // exceptionValues.length === 1 一起檢查：多值（Error.cause 串接 / AggregateError）
  // 事件裡若有其他 sibling value 帶真正有意義的訊息，不該因為某個 value 恰好是
  // 這個無資訊量的 "Rejected" 就整個 event 一起丟掉。
  const isSwRegisterNoise = exceptionValues.some((v) => {
    if (typeof v?.value !== 'string') return false;
    if (SW_REGISTER_NOISE_RE.test(v.value)) return true;
    return (
      exceptionValues.length === 1 &&
      v.value === GENERIC_REJECTED_VALUE &&
      Boolean(
        v.stacktrace?.frames?.some(
          (f) => typeof f?.filename === 'string' && SW_REGISTER_FILE_RE.test(f.filename),
        ),
      )
    );
  });
  if (isSwRegisterNoise) return true;
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
    // Same noise filter for performance/transaction events — without this,
    // HeadlessChrome pageloads accumulate into false "Large Render Blocking
    // Asset" issues (the vendor bundle is React core, unavoidable at first paint).
    // `event` is contextually typed as TransactionEvent; isNoiseEvent takes the
    // base Event supertype, so `return event` stays a TransactionEvent.
    beforeSendTransaction(event, _hint: EventHint) {
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
