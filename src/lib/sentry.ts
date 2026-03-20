import * as Sentry from '@sentry/react';
import { browserTracingIntegration } from '@sentry/react';

// VITE_SENTRY_DSN will be set when the Sentry project is created.
// Example: https://<key>@<org>.ingest.sentry.io/<project-id>
// const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;
//
// TODO: When enabling Sentry DSN, add `https://*.ingest.us.sentry.io` to
// the CSP `connect-src` in all HTML files (index.html, setting.html,
// admin/index.html, manage/index.html).

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

  Sentry.init({
    dsn,
    integrations: [browserTracingIntegration()],
    // Sample 10 % of transactions to stay within the free quota.
    tracesSampleRate: 0.1,
    // Session Replay is intentionally disabled to conserve free quota.
  });
}
