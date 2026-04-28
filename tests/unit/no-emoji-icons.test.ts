/**
 * no-emoji-icons contract test — terracotta-icon-svg-sweep (Section 1)
 *
 * 對照 OpenSpec change `terracotta-mockup-parity-v2` spec/terracotta-icon-svg-sweep
 * 跟 CLAUDE.md「icon 用 inline SVG，不用 emoji 或 icon font」規範。掃描
 * src/components/ + src/pages/ 全 .tsx file，禁止 emoji unicode 出現於 JSX
 * source（剝除 // 跟 / * ... * / comment 後）。
 *
 * 例外：src/components/shared/Icon.tsx 自身（icon catalog comment 跟 placeholder
 * 範例字符可能含 emoji）。
 *
 * 違規 emoji 範圍 = mockup 主要違規列表（見 OpenSpec change spec.md
 * `terracotta-icon-svg-sweep` Requirement 1）：
 * 🗑 trash / 🔍 search / ⛶ maximize / ⎘ copy / ⇅ arrows-vertical /
 * ❤ heart / 🚗 car / 📋 clipboard
 *
 * Note: ✕ U+2715 跟 ✓ U+2713 是 mathematical symbol 不在 emoji range，
 * 雖然本 capability 也替換為 `<Icon name="x-mark|check" />`，但既有 codebase
 * 還有其他 component (StopLightbox / TripSheet / GlobalMapPage) 用 ✕ 為
 * close affordance，超出本 capability scope，留 follow-up issue。
 *
 * 任一違規即 fail，列出 file:line(s) → emoji char 對應，引導開發者改用
 * `<Icon name="..." />` SVG sprite。
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const PROJECT_ROOT = join(__dirname, '../..');
const SCAN_DIRS = ['src/components', 'src/pages'];
const EXCLUDE_FILE_NAMES = ['Icon.tsx'];
const BANNED_CHARS = ['🗑', '🔍', '⛶', '⎘', '⇅', '❤', '🚗', '📋'] as const;

function* walkTsx(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith('.')) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      yield* walkTsx(full);
    } else if (full.endsWith('.tsx')) {
      yield full;
    }
  }
}

/** 剝除 // line comments + /* ... * / block comments，避免 comment 內 emoji 誤報 */
function stripComments(content: string): string {
  return content
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');
}

interface Violation {
  file: string;
  line: number;
  char: string;
}

describe('no-emoji-icons contract (terracotta-icon-svg-sweep)', () => {
  it('禁止在 src/components + src/pages .tsx 內使用 emoji-as-icon (剝 comment 後)', () => {
    const violations: Violation[] = [];

    for (const dir of SCAN_DIRS) {
      const fullDir = join(PROJECT_ROOT, dir);
      for (const filePath of walkTsx(fullDir)) {
        const baseName = filePath.split('/').pop()!;
        if (EXCLUDE_FILE_NAMES.includes(baseName)) continue;

        const raw = readFileSync(filePath, 'utf-8');
        const stripped = stripComments(raw);
        const lines = stripped.split('\n');

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]!;
          for (const ch of BANNED_CHARS) {
            if (line.includes(ch)) {
              violations.push({
                file: relative(PROJECT_ROOT, filePath),
                line: i + 1,
                char: ch,
              });
            }
          }
        }
      }
    }

    if (violations.length > 0) {
      const report = violations
        .map((v) => `  ${v.file}:${v.line} → ${v.char}`)
        .join('\n');
      throw new Error(
        `Emoji-as-icon detected (${violations.length} violations). ` +
          `用 <Icon name="..." /> SVG sprite 取代:\n${report}`,
      );
    }
    expect(violations).toHaveLength(0);
  });

  it('Icon.tsx 自身豁免（catalog comment / placeholder 可含 emoji）', () => {
    const iconFile = join(PROJECT_ROOT, 'src/components/shared/Icon.tsx');
    expect(EXCLUDE_FILE_NAMES.some((n) => iconFile.endsWith(n))).toBe(true);
  });

  it('掃描 dir + 排除 list 對齊 OpenSpec spec', () => {
    expect(SCAN_DIRS).toEqual(['src/components', 'src/pages']);
    expect(EXCLUDE_FILE_NAMES).toContain('Icon.tsx');
    expect(BANNED_CHARS.length).toBeGreaterThanOrEqual(8);
  });
});
