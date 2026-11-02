/**
 * round-14b-residuals.test.ts — v2.33.61 Round 14 residuals guard
 *
 * Source-grep:
 *   1. package.json overrides pin 3 HIGH CVE
 *   （auth-cleanup / daily-report 的 source-grep 屬 agent repo，已隨 T16 階段 C 移除）
 *   4. .tp-rail-line CSS rule removed
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const read = (p: string) => readFileSync(path.resolve(__dirname, '../..', p), 'utf-8');

const PACKAGE_JSON = JSON.parse(read('package.json'));
const TOKENS_CSS = read('css/tokens.css');

describe('v2.33.61 #1 — npm overrides pin 3 HIGH CVE', () => {
  it('overrides 區塊存在', () => {
    expect(PACKAGE_JSON.overrides).toBeDefined();
  });

  it('@babel/plugin-transform-modules-systemjs 鎖 7.29.4+ (RCE CVSS 8.2)', () => {
    expect(PACKAGE_JSON.overrides['@babel/plugin-transform-modules-systemjs']).toMatch(/\^7\.29\./);
  });

  it('serialize-javascript 鎖 7.0.5+ (RCE CVSS 8.1)', () => {
    expect(PACKAGE_JSON.overrides['serialize-javascript']).toMatch(/\^7\.0\./);
  });

  it('fast-uri 鎖 3.1.2+ (path traversal CVSS 7.5)', () => {
    expect(PACKAGE_JSON.overrides['fast-uri']).toMatch(/\^3\.1\./);
  });
});

describe('v2.33.61 #4 — .tp-rail-line dead code 拔', () => {
  it('CSS rule 不再有 .tp-rail-line { display: none } 殼', () => {
    expect(TOKENS_CSS).not.toMatch(/\.tp-rail-line\s*\{\s*display:\s*none/);
  });

  it('CSS rule 不再有 .tp-rail-line { left: 96px }', () => {
    expect(TOKENS_CSS).not.toMatch(/\.tp-rail-line\s*\{\s*left:\s*96px/);
  });
});
