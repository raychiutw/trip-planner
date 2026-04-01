import { init, browserTracingIntegration } from '@sentry/react';

// VITE_SENTRY_DSN is set via Cloudflare Pages environment variable.
// CSP connect-src in all HTML files includes https://*.ingest.us.sentry.io.

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
  });
}
