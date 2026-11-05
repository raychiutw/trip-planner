/**
 * PR 2 — tokens.css + CSS glass 統一性測試
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { resolve, extname } from 'path';

const ROOT = resolve(__dirname, '../../');
const tokensPath = resolve(ROOT, 'css/tokens.css');
const tokens = readFileSync(tokensPath, 'utf-8');

// ——— Item 2: tokens.css 新 token ———
describe('tokens.css — 新 token', () => {
  it('包含 --font-size-eyebrow: 0.625rem (10px)', () => {
    expect(tokens).toMatch(/--font-size-eyebrow:\s*0\.625rem/);
  });

  it('包含 --font-size-caption2: 0.6875rem (11px)', () => {
    expect(tokens).toMatch(/--font-size-caption2:\s*0\.6875rem/);
  });

  it('包含 --blur-glass token', () => {
    expect(tokens).toContain('--blur-glass:');
  });

  it('--blur-glass 值為 14px', () => {
    expect(tokens).toMatch(/--blur-glass:\s*14px/);
  });

  it('包含 --color-warning token', () => {
    expect(tokens).toMatch(/--color-warning:\s*#F48C06/);
  });
});

// ——— Item 3/4: Glass blur 統一 14px ———
describe('CSS glass blur 統一性', () => {
  it('tokens.css 不存在 blur(12px)', () => {
    expect(tokens).not.toContain('blur(12px)');
  });

  it('tokens.css 不存在 blur(6px)', () => {
    expect(tokens).not.toContain('blur(6px)');
  });
});

// ——— Item 5: hardcode 10/11px 改 token ———
describe('hardcode px → token 替換', () => {
  function collectFiles(dir: string, exts: Set<string>): string[] {
    const results: string[] = [];
    try {
      for (const entry of readdirSync(dir)) {
        const full = resolve(dir, entry);
        const stat = statSync(full);
        if (stat.isDirectory()) {
          results.push(...collectFiles(full, exts));
        } else if (exts.has(extname(entry))) {
          results.push(full);
        }
      }
    } catch { /* skip inaccessible dirs */ }
    return results;
  }

  const SCAN_EXTS = new Set(['.css', '.tsx']);
  const files = [
    ...collectFiles(resolve(ROOT, 'css'), SCAN_EXTS),
    ...collectFiles(resolve(ROOT, 'src'), SCAN_EXTS),
  ];

  it('css/ + src/ 不存在 font-size: 10px hardcode（應改 var(--font-size-eyebrow)）', () => {
    const violations: string[] = [];
    for (const file of files) {
      const content = readFileSync(file, 'utf-8');
      // 找 font-size: 10px（排除 @theme 中的 token 定義本身）
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i] ?? '';
        if (/font-size:\s*10px/.test(line) && !line.includes('--font-size-eyebrow')) {
          violations.push(`${file.replace(ROOT, '')}:${i + 1}: ${line.trim()}`);
        }
      }
    }
    if (violations.length > 0) {
      throw new Error(`找到 hardcode 10px font-size（應改 var(--font-size-eyebrow)）：\n${violations.join('\n')}`);
    }
    expect(violations).toHaveLength(0);
  });

  it('css/ + src/ 不存在 font-size: 11px hardcode（應改 var(--font-size-caption2)）', () => {
    const violations: string[] = [];
    for (const file of files) {
      const content = readFileSync(file, 'utf-8');
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i] ?? '';
        if (/font-size:\s*11px/.test(line) && !line.includes('--font-size-caption2')) {
          violations.push(`${file.replace(ROOT, '')}:${i + 1}: ${line.trim()}`);
        }
      }
    }
    if (violations.length > 0) {
      throw new Error(`找到 hardcode 11px font-size（應改 var(--font-size-caption2)）：\n${violations.join('\n')}`);
    }
    expect(violations).toHaveLength(0);
  });
});

// ——— Review follow-up Item 3: Bottom nav tap target ———
describe('tp-bottom-nav-btn — tap target 防呆', () => {
  it('.tp-bottom-nav-btn 包含 min-height: 44px（Apple HIG tap target）', () => {
    expect(tokens).toContain('min-height: 44px');
  });
});

// ——— Review follow-up Item 6: 760px breakpoint 文件註解 ———
describe('760px breakpoint — 文件註解', () => {
  it('tokens.css 包含 breakpoint 說明（760px intentionally set）', () => {
    expect(tokens).toContain('Breakpoint intentionally set');
  });
});
