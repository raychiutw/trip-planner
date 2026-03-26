import { readFileSync } from 'fs';
import { describe, it, expect } from 'vitest';

/**
 * RequestStepper structural validations — TSX source checks.
 * Uses Tailwind inline classes with tokens from tokens.css.
 */

const tsx = readFileSync('src/components/shared/RequestStepper.tsx', 'utf-8');

/* ===== STEPS 定義驗證 ===== */

describe('RequestStepper STEPS', () => {
  it('defines exactly 4 steps', () => {
    const stepMatches = tsx.match(/\{\s*key:\s*'[^']+',\s*label:\s*'[^']+'\s*\}/g);
    expect(stepMatches).toHaveLength(4);
  });

  it('has correct step keys in order: open, received, processing, completed', () => {
    const keyRe = /key:\s*'([^']+)'/g;
    const stepsBlock = tsx.slice(tsx.indexOf('const STEPS'), tsx.indexOf('] as const'));
    const keys = [];
    let m;
    while ((m = keyRe.exec(stepsBlock))) {
      keys.push(m[1]);
    }
    expect(keys).toEqual(['open', 'received', 'processing', 'completed']);
  });

  it('has correct step labels in order: 送出, 接收, 處理中, 已回覆', () => {
    const labelRe = /label:\s*'([^']+)'/g;
    const stepsBlock = tsx.slice(tsx.indexOf('const STEPS'), tsx.indexOf('] as const'));
    const labels = [];
    let m;
    while ((m = labelRe.exec(stepsBlock))) {
      labels.push(m[1]);
    }
    expect(labels).toEqual(['送出', '接收', '處理中', '已回覆']);
  });
});

/* ===== Tailwind class 驗證 ===== */

describe('RequestStepper Tailwind structure', () => {
  it('has role="group" with aria-label', () => {
    expect(tsx).toContain('role="group"');
    expect(tsx).toContain('aria-label="請求進度"');
  });

  it('uses Tailwind utility classes for dot styling', () => {
    expect(tsx).toContain('bg-accent');
    expect(tsx).toContain('border-accent');
    expect(tsx).toContain('rounded-full');
  });

  it('uses Tailwind utility classes for line styling', () => {
    expect(tsx).toContain('h-0.5');
  });
});
