/**
 * App 版本 / commit 的**單一來源**。
 *
 * 三個消費端共用，不可各自計算：
 *   - vite.config.ts   → define 給前端顯示（帳號頁版本頁尾）
 *   - vite.config.ts   → Sentry release tag
 *   - vitest.config.js → 讓測試環境也拿得到，否則任何 render 版本的 component
 *                        在測試裡會 ReferenceError（實際踩過）
 *
 * 各自算的話，使用者回報「我用 2.56.13」時 Sentry 上可能對不到那個 release。
 */

/** package.json 的 version（由 /ship 統一 bump，是唯一權威）。 */
export const appVersion = process.env.npm_package_version || '0.0.0';

/** 短 commit SHA。CI 給 GITHUB_SHA、Cloudflare Pages 給 CF_PAGES_COMMIT_SHA。 */
export const commitSha = (
  process.env.GITHUB_SHA || process.env.CF_PAGES_COMMIT_SHA || 'local'
).slice(0, 7);

/** 前端 define 表。vite 與 vitest 都必須套用同一份。 */
export const versionDefine = {
  __APP_VERSION__: JSON.stringify(appVersion),
  __APP_COMMIT__: JSON.stringify(commitSha),
};
