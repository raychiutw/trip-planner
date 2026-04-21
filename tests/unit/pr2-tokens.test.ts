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

// ——— Item 4: InfoSheet saturate 移除 ———
const infoSheetPath = resolve(ROOT, 'src/components/trip/InfoSheet.tsx');
const infoSheet = readFileSync(infoSheetPath, 'utf-8');

describe('InfoSheet — glass 清理', () => {
  it('InfoSheet 不存在 saturate(180%)', () => {
    expect(infoSheet).not.toContain('saturate(180%)');
  });

  it('InfoSheet 不存在 blur(28px)', () => {
    expect(infoSheet).not.toContain('blur(28px)');
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

// ——— Item 7: AI 編輯 pill 改 Ocean fill ———
const tokensContent = tokens;

describe('AI 編輯 pill — Ocean fill', () => {
  it('.ocean-tb-ai 使用 var(--color-accent) 作為 background', () => {
    // 找 .ocean-tb-ai 區塊後確認 background: var(--color-accent)
    const aiBlock = tokensContent.match(/\.ocean-tb-btn\.ocean-tb-ai\s*\{[^}]+\}/s)?.[0] ?? '';
    expect(aiBlock).toContain('var(--color-accent)');
  });

  it('.ocean-tb-ai::before cyan dot 已移除', () => {
    // ::before 中不應再有 background: #00B4D8 (cyan)
    const beforeBlock = tokensContent.match(/\.ocean-tb-btn\.ocean-tb-ai::before\s*\{[^}]+\}/s)?.[0] ?? '';
    expect(beforeBlock).not.toContain('#00B4D8');
  });
});

// ——— Review follow-up Item 1: topbar blur 改 token ———
describe('ocean-topbar — backdrop-filter 使用 token', () => {
  it('.ocean-topbar backdrop-filter 使用 var(--blur-glass) token 而非 hardcode 14px', () => {
    // 找 .ocean-topbar 區塊
    const topbarBlock = tokens.match(/\.ocean-topbar\s*\{[^}]+\}/s)?.[0] ?? '';
    expect(topbarBlock).toContain('var(--blur-glass)');
  });

  it('.ocean-topbar 不存在 backdrop-filter: blur(14px) hardcode', () => {
    // 確認已改用 token，不再有 hardcode 14px
    const topbarBlock = tokens.match(/\.ocean-topbar\s*\{[^}]+\}/s)?.[0] ?? '';
    expect(topbarBlock).not.toMatch(/backdrop-filter:\s*blur\(14px\)/);
  });
});

// ——— Review follow-up Item 3: Bottom nav tap target ———
describe('ocean-bottom-nav-btn — tap target 防呆', () => {
  it('.ocean-bottom-nav-btn 包含 min-height: 44px（Apple HIG tap target）', () => {
    expect(tokens).toContain('min-height: 44px');
  });
});

// ——— Review follow-up Item 4: AI pill 互動 states ———
describe('ocean-tb-ai — 互動 state 補齊', () => {
  it('.ocean-tb-btn.ocean-tb-ai:hover 存在 filter: brightness 樣式', () => {
    const hoverBlock = tokens.match(/\.ocean-tb-btn\.ocean-tb-ai:hover\s*\{[^}]+\}/s)?.[0] ?? '';
    expect(hoverBlock).toMatch(/filter:\s*brightness/);
  });

  it('.ocean-tb-btn.ocean-tb-ai:focus-visible 存在 outline 樣式', () => {
    const focusBlock = tokens.match(/\.ocean-tb-btn\.ocean-tb-ai:focus-visible\s*\{[^}]+\}/s)?.[0] ?? '';
    expect(focusBlock).toMatch(/outline:/);
  });

  it('.ocean-tb-btn.ocean-tb-ai:active 存在 filter: brightness 樣式', () => {
    const activeBlock = tokens.match(/\.ocean-tb-btn\.ocean-tb-ai:active\s*\{[^}]+\}/s)?.[0] ?? '';
    expect(activeBlock).toMatch(/filter:\s*brightness/);
  });
});

// ——— Review follow-up Item 6: 760px breakpoint 文件註解 ———
describe('760px breakpoint — 文件註解', () => {
  it('tokens.css 包含 breakpoint 說明（760px intentionally set）', () => {
    expect(tokens).toContain('Breakpoint intentionally set');
  });
});

// ——— Review follow-up Item 7: InfoSheet sheet opacity bump ———
const infoSheetContent = readFileSync(resolve(ROOT, 'src/components/trip/InfoSheet.tsx'), 'utf-8');

describe('InfoSheet — sheet 邊緣清晰度', () => {
  it('InfoSheet sheet background 使用 94% 而非 88%（opacity bump）', () => {
    expect(infoSheetContent).toMatch(/color-mix\(in srgb,\s*var\(--color-secondary\)\s*94%/);
  });
});

// ——— Review follow-up Item 8: 注意事項 warning amber ———
const daySectionPath = resolve(ROOT, 'src/components/trip/DaySection.tsx');
const daySection = readFileSync(daySectionPath, 'utf-8');

describe('注意事項卡 — warning amber', () => {
  it('DaySection 警告區塊 className 不含 bg-destructive-bg', () => {
    // 搜尋 warnings.length > 0 後的 className
    const warningSection = daySection.match(/warnings\.length > 0[\s\S]{0,400}/)?.[0] ?? '';
    expect(warningSection).not.toContain('bg-destructive-bg');
    expect(warningSection).not.toContain('text-destructive');
  });

  it('DaySection 警告區塊 使用 warning 色調 className', () => {
    const warningSection = daySection.match(/warnings\.length > 0[\s\S]{0,400}/)?.[0] ?? '';
    expect(warningSection).toMatch(/warning/);
  });
});
