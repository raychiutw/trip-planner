/**
 * Array.prototype.at polyfill（Sentry 7851675247）
 *
 * Sentry 11 帶進來的 web-vitals 6 原始碼直接呼叫 `this._sessionEntries.at(-1)`
 * （LayoutShiftManager），只保證 Baseline Widely Available（Chrome 92+）。
 * Chrome 90 沒有 `.at` → CLS 量測時丟 `this.o.at is not a function`。
 * build target 只轉語法、不補內建方法，所以要自己 polyfill。
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { installArrayAtPolyfill } from '../../src/lib/polyfills';

const ROOT = path.resolve(__dirname, '../..');
// web-vitals 的 package exports 不開放 deep import，直接用檔案路徑載入真實實作。
const LAYOUT_SHIFT_MANAGER = pathToFileURL(
  path.join(ROOT, 'node_modules/web-vitals/dist/modules/lib/LayoutShiftManager.js'),
).href;

type Shift = { value: number; startTime: number; hadRecentInput: boolean };

// 在刪掉 `.at` 之前先載入：vitest 自己的 dynamic import / expect 也會用 `.at`。
const { LayoutShiftManager } = await import(/* @vite-ignore */ LAYOUT_SHIFT_MANAGER);

/**
 * 在「沒有 Array.prototype.at」的環境裡執行 fn（模擬 Chrome 90），結束後還原原生實作。
 * 斷言放在外面做，避免測試框架本身因為少了 `.at` 而壞掉、蓋掉真正的症狀。
 */
function withoutNativeAt<T>(fn: () => T): T {
  const nativeAt = Object.getOwnPropertyDescriptor(Array.prototype, 'at');
  delete (Array.prototype as { at?: unknown }).at;
  try {
    return fn();
  } finally {
    delete (Array.prototype as { at?: unknown }).at;
    if (nativeAt) Object.defineProperty(Array.prototype, 'at', nativeAt);
  }
}

describe('installArrayAtPolyfill — 模擬 Chrome 90（沒有 Array.prototype.at）', () => {
  it('web-vitals LayoutShiftManager 連續處理 layout shift 不再丟 TypeError', () => {
    const first: Shift = { value: 0.1, startTime: 100, hadRecentInput: false };
    const second: Shift = { value: 0.2, startTime: 600, hadRecentInput: false };
    const manager = new LayoutShiftManager();

    const error = withoutNativeAt(() => {
      installArrayAtPolyfill();
      try {
        manager._processEntry(first);
        manager._processEntry(second);
        return null;
      } catch (e) {
        return e;
      }
    });

    expect(error).toBeNull();
    // 500ms 內的第二筆併入同一個 session — 證明 `.at(-1)` 真的取到最後一筆
    expect(manager._sessionEntries).toEqual([first, second]);
    expect(manager._sessionValue).toBeCloseTo(0.3);
  });

  it('語意與規格一致：負索引、越界、小數索引，且不可列舉', () => {
    const result = withoutNativeAt(() => {
      installArrayAtPolyfill();
      const arr = ['a', 'b', 'c'];
      return {
        at: [arr.at(0), arr.at(-1), arr.at(-3), arr.at(3), arr.at(-4), arr.at(1.7)],
        enumerable: Object.keys(Array.prototype).includes('at'),
      };
    });

    expect(result.at).toEqual(['a', 'c', 'a', undefined, undefined, 'b']);
    expect(result.enumerable).toBe(false);
  });
});

describe('main.tsx 接線', () => {
  it('第一個 import 是 polyfills，確保比 Sentry / 其他 chunk 先執行', () => {
    const main = fs.readFileSync(path.join(ROOT, 'src/entries/main.tsx'), 'utf8');
    const firstImport = main.split('\n').find((line) => line.startsWith('import '));
    expect(firstImport).toBe("import '../lib/polyfills';");
  });
});
