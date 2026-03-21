import { readFileSync } from 'fs';
import { describe, it, expect } from 'vitest';

/**
 * RequestStepper structural validations — TSX source checks.
 */

const tsx = readFileSync('src/components/shared/RequestStepper.tsx', 'utf-8');
const css = readFileSync('css/manage.css', 'utf-8');

/* ===== Helpers ===== */

/** Extract all CSS rules containing a given selector substring */
function rulesFor(source, selector) {
  const rules = [];
  const re = /([^{}]+)\{([^}]*)\}/g;
  let m;
  while ((m = re.exec(source))) {
    if (m[1].includes(selector)) {
      rules.push({ selector: m[1].trim(), body: m[2].trim() });
    }
  }
  return rules;
}

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

/* ===== 圓點 class 驗證 ===== */

describe('RequestStepper dot classes', () => {
  it('renders stepper-dot--done for completed steps', () => {
    expect(tsx).toContain("'stepper-dot--done'");
  });

  it('renders stepper-dot--active for current step', () => {
    expect(tsx).toContain("'stepper-dot--active'");
  });

  it('renders stepper-dot--pending for future steps', () => {
    expect(tsx).toContain("'stepper-dot--pending'");
  });
});

/* ===== 連接線 class 驗證 ===== */

describe('RequestStepper line classes', () => {
  it('renders stepper-line--done for completed connections', () => {
    expect(tsx).toContain("'stepper-line--done'");
  });

  it('renders stepper-line--pending for future connections', () => {
    expect(tsx).toContain("'stepper-line--pending'");
  });
});

/* ===== Label class 驗證 ===== */

describe('RequestStepper label classes', () => {
  it('renders stepper-label--active for current step', () => {
    expect(tsx).toContain("'stepper-label--active'");
  });

  it('renders stepper-label--done for completed steps', () => {
    expect(tsx).toContain("'stepper-label--done'");
  });

  it('renders stepper-label--pending for future steps', () => {
    expect(tsx).toContain("'stepper-label--pending'");
  });
});

/* ===== CSS 規則驗證 ===== */

describe('RequestStepper CSS', () => {
  it('defines .request-stepper with flex layout', () => {
    const rules = rulesFor(css, '.request-stepper');
    expect(rules.length).toBeGreaterThan(0);
    expect(rules[0].body).toContain('display: flex');
  });

  it('defines stepper-dot base with border-radius 50%', () => {
    const rules = rulesFor(css, '.stepper-dot');
    const base = rules.find(r => r.selector === '.stepper-dot');
    expect(base).toBeDefined();
    expect(base.body).toContain('border-radius: 50%');
  });

  it('defines stepper-dot--done with accent background', () => {
    const rules = rulesFor(css, '.stepper-dot--done');
    expect(rules.length).toBeGreaterThan(0);
    expect(rules[0].body).toContain('var(--color-accent)');
  });

  it('defines stepper-dot--active with accent border', () => {
    const rules = rulesFor(css, '.stepper-dot--active');
    const borderRule = rules.find(r => r.body.includes('border'));
    expect(borderRule).toBeDefined();
    expect(borderRule.body).toContain('var(--color-accent)');
  });

  it('defines stepper-pulse keyframes', () => {
    expect(css).toContain('@keyframes stepper-pulse');
  });

  it('defines stepper-label with caption2 font size', () => {
    const rules = rulesFor(css, '.stepper-label');
    const base = rules.find(r => r.selector === '.stepper-label');
    expect(base).toBeDefined();
    expect(base.body).toContain('var(--font-size-caption2)');
  });
});
