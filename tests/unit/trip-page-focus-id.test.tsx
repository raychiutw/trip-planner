/** Legacy routing and timer-cleanup guards; focus behavior runs through real routes in entry-visible-synchronization.test.tsx. */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const SRC = readFileSync(
  path.resolve(__dirname, '../../src/pages/TripPage.tsx'),
  'utf-8',
);

// Focus behavior is covered through real routes and HTTP in entry-visible-synchronization.test.tsx.

describe('TripPage — `?sheet=collab` legacy redirect', () => {
  it('redirect to /trip/:id/collab via navigate({ replace: true })', () => {
    expect(SRC).toMatch(/sheetParam === ['"]collab['"]/);
    expect(SRC).toMatch(/\/collab[\s\S]{0,80}\{ replace: true \}/);
  });
});

describe('TripPage — v2.33.46 round 7a setTimeout cleanup (regression guard)', () => {
  it('autolocate effect 包 cancelAnimationFrame + clearTimeout cleanup', () => {
    expect(SRC).toMatch(/cancelAnimationFrame\(rafId\)/);
    expect(SRC).toMatch(/clearTimeout\(timeoutId\)/);
  });
});
