/**
 * 驗證 css/ 和 src/ 中不存在非整數 px 字級（如 9.5px、10.5px、11.5px）
 * 非整數字級在 mobile 上造成次像素渲染，出現 9.5/10.5/11.5/13.333px 等模糊字級。
 * DESIGN.md type scale 全部為整數 px。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { resolve, extname } from 'path';

const ROOT = resolve(__dirname, '../../');
const SCAN_DIRS = ['css', 'src'];
// .css — design tokens / component styles
// .tsx — React components that may have inline style={{ fontSize: ... }}
// .ts / .js / .jsx 排除：hooks/lib 工具檔不寫 font-size
const SCAN_EXTS = new Set(['.css', '.tsx']);

/** Recursively collect files */
function collectFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = resolve(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      results.push(...collectFiles(full));
    } else if (SCAN_EXTS.has(extname(entry))) {
      results.push(full);
    }
  }
  return results;
}

const FRACTIONAL_PX_RE = /font-size:\s*\d+\.\d+px/g;

describe('non-integer font-size px', () => {
  const violations: { file: string; match: string }[] = [];

  for (const dir of SCAN_DIRS) {
    const files = collectFiles(resolve(ROOT, dir));
    for (const file of files) {
      const content = readFileSync(file, 'utf-8');
      const matches = content.match(FRACTIONAL_PX_RE);
      if (matches) {
        for (const m of matches) {
          violations.push({ file: file.replace(ROOT, ''), match: m });
        }
      }
    }
  }

  it('css/ 和 src/ 中不存在非整數 px font-size', () => {
    if (violations.length > 0) {
      const report = violations.map(v => `  ${v.file}: ${v.match}`).join('\n');
      throw new Error(`找到 ${violations.length} 個非整數 px font-size 違規：\n${report}`);
    }
    expect(violations).toHaveLength(0);
  });
});
