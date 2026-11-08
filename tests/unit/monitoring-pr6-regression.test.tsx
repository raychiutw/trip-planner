/**
 * PR6 monitoring regression — v2.33.129
 *
 * G5: CF _middleware.ts catch path → console.error + alertAdminTelegram
 * G9: useRequestSSE pollOnce AbortController 10s timeout
 * G11: ServerStatusBanner mount + offline render
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ServerStatusBanner } from '../../src/components/ServerStatusBanner';
import { reportFetchResult } from '../../src/lib/networkBus';

const MW = readFileSync(join(__dirname, '../../functions/api/_middleware.ts'), 'utf8');
const SSE = readFileSync(join(__dirname, '../../src/hooks/useRequestSSE.ts'), 'utf8');
const MAIN = readFileSync(join(__dirname, '../../src/entries/main.tsx'), 'utf8');

describe('G5: CF _middleware 5xx → alertAdminTelegram + console.error', () => {
  it('import alertAdminTelegram', () => {
    expect(MW).toMatch(/import \{ alertAdminTelegram \} from '\.\/_alert'/);
  });

  it('non-AppError catch path 加 console.error 含 method/path/duration/error', () => {
    expect(MW).toMatch(/\[_middleware unhandled 5xx\]/);
    expect(MW).toMatch(/method: request\.method,\s+path: url\.pathname,\s+duration,\s+source: getSource\(\),\s+error: errMsg/);
  });

  it('context.waitUntil 包 alertAdminTelegram + 含 method/path/source/duration/error 前 200 字', () => {
    expect(MW).toMatch(/context\.waitUntil\(\s*alertAdminTelegram\(/);
    expect(MW).toMatch(/CF Worker 5xx unhandled/);
    expect(MW).toMatch(/errMsg\.slice\(0, 200\)/);
  });

  it('stack trace slice 500 chars 寫 console (不入 api_logs/telegram 避免 PII)', () => {
    expect(MW).toMatch(/stack: errStack\.slice\(0, 500\)/);
  });
});

describe('G9: useRequestSSE pollOnce AbortController 10s timeout', () => {
  it('POLL_FETCH_TIMEOUT_MS 常數 = 10_000', () => {
    expect(SSE).toMatch(/POLL_FETCH_TIMEOUT_MS = 10_000/);
  });

  it('pollOnce 內建 new AbortController + setTimeout abort', () => {
    expect(SSE).toMatch(/const ctrl = new AbortController\(\)/);
    expect(SSE).toMatch(/setTimeout\(\(\) => ctrl\.abort\(\), POLL_FETCH_TIMEOUT_MS\)/);
  });

  it('輪詢請求傳 signal: ctrl.signal（typed client 的 GET /api/requests/{id}）', () => {
    expect(SSE).toMatch(/api\.get\('\/api\/requests\/\{id\}'[\s\S]*?signal: ctrl\.signal/);
  });

  it('finally clearTimeout 防 timer leak', () => {
    expect(SSE).toMatch(/} finally \{\s+clearTimeout\(abortTimer\)/);
  });
});

describe('G11: ServerStatusBanner', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  });

  it('online 時不 render', () => {
    const { container } = render(<ServerStatusBanner />);
    expect(container.querySelector('[data-testid="server-status-banner"]')).toBeNull();
  });

  it('offline → role=alert + 中文提示文案', () => {
    vi.useFakeTimers();
    const { container } = render(<ServerStatusBanner />);
    act(() => {
      reportFetchResult(false);
      vi.advanceTimersByTime(3100); // useOnlineStatus 3s debounce
    });
    const banner = container.querySelector('[data-testid="server-status-banner"]');
    expect(banner).toBeTruthy();
    expect(banner?.getAttribute('role')).toBe('alert');
    expect(banner?.textContent).toContain('連線中斷');
    expect(banner?.textContent).toContain('自動上傳');
    vi.useRealTimers();
  });

  it('mount 在 main.tsx root（ErrorBoundary > BrowserRouter 下 DarkModeInit 旁）', () => {
    expect(MAIN).toMatch(/import \{ ServerStatusBanner \} from '\.\.\/components\/ServerStatusBanner'/);
    expect(MAIN).toMatch(/<DarkModeInit \/>\s+<ServerStatusBanner \/>/);
  });
});
