/**
 * 舊瀏覽器內建方法 polyfill —— 必須是 src/entries/main.tsx 的第一個 import。
 *
 * build target（Vite / oxc）只會轉譯語法，不會補內建方法。第三方套件若直接呼叫
 * 新的內建方法，在我們仍支援的舊瀏覽器上會直接丟 TypeError。
 *
 * Array.prototype.at（Chrome 92 / Safari 15.4 / Firefox 90）：
 * Sentry 11 帶進來的 web-vitals 6 在 LayoutShiftManager 呼叫 `.at(-1)`，
 * Chrome 90 量 CLS 時丟 `this.o.at is not a function`（Sentry 7851675247）。
 * repo 沒有 build.target / browserslist；目前唯一寫下的支援範圍是 vite.config.ts 中
 * VitePWA workbox 的 babelPresetEnvTargets（chrome >= 87 / safari >= 14），以此為準。
 */
export function installArrayAtPolyfill(): void {
  if (typeof (Array.prototype as { at?: unknown }).at === 'function') return;
  Object.defineProperty(Array.prototype, 'at', {
    // 依 ECMAScript 規格：ToIntegerOrInfinity 後負值從尾端算回來，越界回 undefined
    value: function at<T>(this: ArrayLike<T>, index: number): T | undefined {
      const length = this.length >>> 0;
      let relative = Math.trunc(Number(index)) || 0;
      if (relative < 0) relative += length;
      return relative < 0 || relative >= length ? undefined : this[relative];
    },
    writable: true,
    enumerable: false,
    configurable: true,
  });
}

installArrayAtPolyfill();
