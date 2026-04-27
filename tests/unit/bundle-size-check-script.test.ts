/**
 * scripts/bundle-size-check.sh + ci.yml 結構測試（B-P6 task 11.3 / 6.4）
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const SCRIPT = fs.readFileSync(
  path.resolve(__dirname, '../../scripts/bundle-size-check.sh'),
  'utf8',
);
const CI_YML = fs.readFileSync(
  path.resolve(__dirname, '../../.github/workflows/ci.yml'),
  'utf8',
);

describe('bundle-size-check.sh — script contract', () => {
  it('shebang bash + set -euo pipefail（fail-loud）', () => {
    expect(SCRIPT).toMatch(/^#!\/usr\/bin\/env bash/);
    expect(SCRIPT).toMatch(/set -euo pipefail/);
  });

  it('THRESHOLD_KB env 預設 300（task 6.4 / 11.3 spec）', () => {
    expect(SCRIPT).toMatch(/THRESHOLD_KB:?-?300/);
  });

  it('掃 dist/assets/*.js 全部', () => {
    expect(SCRIPT).toMatch(/dist\/assets/);
    expect(SCRIPT).toMatch(/-name\s+['"]\*\.js['"]/);
  });

  it('用 gzip -c | wc -c 算 gzipped size（不是 raw size）', () => {
    expect(SCRIPT).toMatch(/gzip\s+-c.*wc\s+-c/);
  });

  it('Exit 1 when over threshold, 2 when dist missing', () => {
    expect(SCRIPT).toMatch(/exit 1/);
    expect(SCRIPT).toMatch(/exit 2/);
  });
});

describe('ci.yml — bundle size gate step', () => {
  it('包含 Bundle size gate step', () => {
    expect(CI_YML).toMatch(/Bundle size gate/);
    expect(CI_YML).toMatch(/bash scripts\/bundle-size-check\.sh/);
  });

  it('在 Build step 之後（dist/ 才存在）', () => {
    const buildIdx = CI_YML.indexOf('Build');
    const gateIdx = CI_YML.indexOf('Bundle size gate');
    expect(buildIdx).toBeGreaterThan(0);
    expect(gateIdx).toBeGreaterThan(buildIdx);
  });

  it('傳 THRESHOLD_KB env (300)', () => {
    expect(CI_YML).toMatch(/THRESHOLD_KB:\s*300/);
  });
});

describe('ci.yml — Playwright matrix gate', () => {
  it('PR 只跑 desktop chromium', () => {
    expect(CI_YML).toMatch(/github\.event_name[\s\S]*pull_request/);
    expect(CI_YML).toMatch(/npx playwright install --with-deps chromium/);
    expect(CI_YML).toMatch(/npx playwright test --project=chromium/);
  });

  it('push master 跑完整 Playwright matrix', () => {
    expect(CI_YML).toMatch(/push:[\s\S]*branches:\s*\[master\]/);
    expect(CI_YML).toMatch(/npx playwright install --with-deps chromium webkit/);
    expect(CI_YML).toMatch(/else[\s\S]*npx playwright test/);
  });
});
