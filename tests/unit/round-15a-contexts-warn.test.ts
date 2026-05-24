/**
 * round-15a-contexts-warn.test.ts — v2.33.64 src/contexts mini-review
 *
 * Source-grep guard:
 *  1. NewTripContext.useNewTrip — outside provider 改 null-sentinel + dev warn
 *  2. ActiveTripContext.useActiveTrip — outside provider 加 dev warn (LS fallback 保留)
 *
 * 原本兩個 hook 在 caller 忘記 wrap provider 時 silent no-op / silent partial-sync,
 * bug 難 trace。改 dev warn 立刻暴露，prod 保留 graceful (避免單錯讓全 app 崩)。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const read = (p: string) => readFileSync(path.resolve(__dirname, '../..', p), 'utf-8');

const NEW_TRIP_CTX = read('src/contexts/NewTripContext.tsx');
const ACTIVE_TRIP_CTX = read('src/contexts/ActiveTripContext.tsx');

describe('v2.33.64 — NewTripContext outside-provider warn', () => {
  it('改 createContext<ActiveTripContextValue | null>(null)', () => {
    expect(NEW_TRIP_CTX).toMatch(/createContext<NewTripContextValue \| null>\(null\)/);
  });

  it('useNewTrip dev mode warn', () => {
    expect(NEW_TRIP_CTX).toMatch(/import\.meta\.env\.DEV/);
    expect(NEW_TRIP_CTX).toMatch(/useNewTrip.*called outside.*NewTripProvider/);
  });

  it('prod 仍 graceful no-op (不 throw)', () => {
    expect(NEW_TRIP_CTX).toMatch(/return \{ openModal: \(\) => \{\} \}/);
    expect(NEW_TRIP_CTX).not.toMatch(/throw new Error.*NewTripProvider/);
  });
});

describe('v2.33.64 — ActiveTripContext outside-provider warn', () => {
  it('保留 SSR no-op + browser-without-provider dev warn', () => {
    expect(ACTIVE_TRIP_CTX).toMatch(/typeof window === 'undefined'/);
    expect(ACTIVE_TRIP_CTX).toMatch(/import\.meta\.env\.DEV/);
    expect(ACTIVE_TRIP_CTX).toMatch(/useActiveTrip.*called outside.*ActiveTripProvider/);
  });

  it('LS fallback 保留 (backward compat)', () => {
    expect(ACTIVE_TRIP_CTX).toMatch(/lsGet<string>\(LS_KEY_TRIP_PREF\)/);
    expect(ACTIVE_TRIP_CTX).toMatch(/lsSet\(LS_KEY_TRIP_PREF, id\)/);
  });

  it('warn message 標 NOT trigger re-render limitation', () => {
    expect(ACTIVE_TRIP_CTX).toMatch(/NOT trigger re-render/);
  });
});
