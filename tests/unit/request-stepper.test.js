import { readFileSync } from 'fs';
import { describe, it, expect } from 'vitest';

/**
 * RequestStepper structural validations — TSX source checks.
 * CSS classes replaced with Tailwind utilities (manage.css removed).
 */

const tsx = readFileSync('src/components/shared/RequestStepper.tsx', 'utf-8');

/* ===== STEPS 定義驗證 ===== */

describe('RequestStepper STEPS', () => {
  it('defines exactly 4 steps', () => {
    // Match the STEPS array items
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

/* ===== 圓點 Tailwind class 驗證 ===== */

describe('RequestStepper dot Tailwind classes', () => {
  it('renders done dot with accent background color', () => {
    expect(tsx).toContain('bg-[var(--color-accent)]');
  });

  it('renders active dot with accent border', () => {
    expect(tsx).toContain('border-[var(--color-accent)]');
  });

  it('renders pending dot with border color', () => {
    expect(tsx).toContain('border-[var(--color-border)]');
  });
});

/* ===== 連接線 Tailwind class 驗證 ===== */

describe('RequestStepper line Tailwind classes', () => {
  it('renders done/active line with accent background', () => {
    expect(tsx).toContain("'bg-[var(--color-accent)]'");
  });

  it('renders pending line with border background', () => {
    expect(tsx).toContain("'bg-[var(--color-border)]'");
  });
});

/* ===== Label Tailwind class 驗證 ===== */

describe('RequestStepper label Tailwind classes', () => {
  it('renders active label with accent color and semibold', () => {
    expect(tsx).toContain('text-[var(--color-accent)] font-semibold');
  });

  it('renders done/pending labels with muted color', () => {
    expect(tsx).toContain('text-[var(--color-muted)]');
  });
});

/* ===== Animation 驗證 ===== */

describe('RequestStepper animation', () => {
  it('defines stepper-pulse keyframes inline', () => {
    expect(tsx).toContain('@keyframes stepper-pulse');
  });

  it('applies stepper-pulse animation to active dot', () => {
    expect(tsx).toContain('stepper-dot-active');
    expect(tsx).toContain('stepper-pulse');
  });
});

/* ===== 結構驗證 ===== */

describe('RequestStepper structure', () => {
  it('uses flex layout for stepper container', () => {
    expect(tsx).toContain('flex items-center');
  });

  it('uses caption2 font size for labels', () => {
    expect(tsx).toContain('var(--font-size-caption2)');
  });
});
