/**
 * CI 不穩定的兜底設定守門（見 vitest.config.js／tests/setup-dom.js 的說明）。
 * 任何一項被改回預設，entry-visible-synchronization 的 5000ms 逾時與
 * 「waitFor 1 秒不夠」類的間歇失敗就會回來。
 */
import { describe, it, expect } from 'vitest';
import { getConfig } from '@testing-library/react';
import vitestConfig from '../../vitest.config.js';

describe('測試穩定性設定', () => {
  it('RTL 非同步查詢逾時是 5000ms（預設 1000ms 在 CI 吃緊時不夠）', () => {
    expect(getConfig().asyncUtilTimeout).toBe(5000);
  });

  it('unit-dom 專案的 testTimeout / hookTimeout 不吃 vitest 預設 5s', () => {
    const dom = vitestConfig.test.projects.find((p: { test: { name: string } }) => p.test.name === 'unit-dom');
    expect(dom.test.testTimeout).toBeGreaterThanOrEqual(30000);
    expect(dom.test.hookTimeout).toBeGreaterThanOrEqual(60000);
  });
});
