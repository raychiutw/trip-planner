import { readFileSync } from 'fs';
import { describe, it, expect } from 'vitest';

/**
 * RequestStepper structural validations — TSX source checks.
 * Uses CSS classes defined in shared.css (restored from manage.css).
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

/* ===== 圓點 CSS class 驗證 ===== */

describe('RequestStepper dot CSS classes', () => {
  it('renders done dot with stepper-dot--done class', () => {
    expect(tsx).toContain('stepper-dot--done');
  });

  it('renders active dot with stepper-dot--active class', () => {
    expect(tsx).toContain('stepper-dot--active');
  });

  it('renders pending dot with stepper-dot--pending class', () => {
    expect(tsx).toContain('stepper-dot--pending');
  });
});

/* ===== 連接線 CSS class 驗證 ===== */

describe('RequestStepper line CSS classes', () => {
  it('renders done/active line with stepper-line--done class', () => {
    expect(tsx).toContain('stepper-line--done');
  });

  it('renders pending line with stepper-line--pending class', () => {
    expect(tsx).toContain('stepper-line--pending');
  });
});

/* ===== Label CSS class 驗證 ===== */

describe('RequestStepper label CSS classes', () => {
  it('renders active label with stepper-label--active class', () => {
    expect(tsx).toContain('stepper-label--active');
  });

  it('renders done label with stepper-label--done class', () => {
    expect(tsx).toContain('stepper-label--done');
  });

  it('renders pending label with stepper-label--pending class', () => {
    expect(tsx).toContain('stepper-label--pending');
  });
});

/* ===== 結構驗證 ===== */

describe('RequestStepper structure', () => {
  it('uses request-stepper container class', () => {
    expect(tsx).toContain('request-stepper');
  });

  it('uses stepper-step class for each step', () => {
    expect(tsx).toContain('stepper-step');
  });

  it('uses stepper-dot base class', () => {
    expect(tsx).toContain('stepper-dot');
  });

  it('uses stepper-label base class', () => {
    expect(tsx).toContain('stepper-label');
  });

  it('uses stepper-line base class', () => {
    expect(tsx).toContain('stepper-line');
  });
});
