/**
 * Sentry global error listeners — v2.33.125 PR2
 *
 * 防禦性 explicit window.onerror / unhandledrejection capture：Sentry 7+
 * globalHandlersIntegration 預設已啟用，但 explicit listener 保 Sentry init
 * fail / dev mode 也有 console.error trace。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SENTRY = readFileSync(join(__dirname, '../../src/lib/sentry.ts'), 'utf8');

describe('sentry.ts global listeners', () => {
  it('installExplicitGlobalErrorListeners 在 dev mode 走 log-only path', () => {
    expect(SENTRY).toMatch(/import\.meta\.env\.PROD/);
    expect(SENTRY).toMatch(/installExplicitGlobalErrorListeners\(\{ logOnly: true \}\)/);
  });

  it('prod 有 DSN 時 installExplicitGlobalErrorListeners logOnly:false', () => {
    expect(SENTRY).toMatch(/installExplicitGlobalErrorListeners\(\{ logOnly: false \}\)/);
  });

  it('prod 無 DSN 時也安裝 log-only listener（避免靜默）', () => {
    expect(SENTRY).toMatch(/DSN not yet configured.*\n\s*installExplicitGlobalErrorListeners\(\{ logOnly: true \}\)/);
  });

  it('window.error listener tag source=window.onerror + 附 filename/lineno/colno', () => {
    expect(SENTRY).toMatch(/window\.addEventListener\('error'/);
    expect(SENTRY).toMatch(/tags: \{ source: 'window\.onerror' \}/);
    expect(SENTRY).toMatch(/extra: \{ filename: event\.filename, lineno: event\.lineno, colno: event\.colno \}/);
  });

  it('unhandledrejection listener tag source=unhandledrejection', () => {
    expect(SENTRY).toMatch(/window\.addEventListener\('unhandledrejection'/);
    expect(SENTRY).toMatch(/tags: \{ source: 'unhandledrejection' \}/);
  });

  it('idempotent guard（_globalListenersInstalled flag 防 double-install）', () => {
    expect(SENTRY).toMatch(/_globalListenersInstalled/);
    expect(SENTRY).toMatch(/if \(_globalListenersInstalled \|\| typeof window === 'undefined'\) return/);
  });

  it('Sentry import 是 lazy dynamic（避免 bundle 含 Sentry 即使 dev mode）', () => {
    expect(SENTRY).toMatch(/void import\(['"]@sentry\/react['"]\)\.then/);
  });
});
