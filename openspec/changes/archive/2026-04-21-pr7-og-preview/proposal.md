# Proposal: pr7-og-preview — OG link preview MVP

## 問題

Tripline 分享連結在 LINE / iMessage / Slack 顯示為白板 — 沒有 OG meta tag。
用戶分享行程連結時，接收者完全看不到任何預覽資訊，導致點擊率低、分享體驗差。
OG link preview 是零成本高 ROI 的 distribution channel，應優先修復。

## MVP Scope

1. 生一張靜態 brand OG image (1200x630 PNG)，所有 trip 共用，放 `public/og/tripline-default.png`
2. `index.html` 補完整 OG + Twitter card meta tags
3. `public/_headers` 加 `/og/*` Cache-Control header
4. `TODOS.md` 加 per-trip dynamic OG roadmap

## Why Static-First

- **速度**：靜態 PNG 零伺服器負擔，Cloudflare CDN 直接 serve
- **相容性**：社群爬蟲（LINE、iMessage、Slack、FB、Twitter）100% 支援 PNG
- **無風險**：不需要改動 Cloudflare Workers，不影響任何現有功能
- **夠用**：brand consistency 比 per-trip 動態圖更重要（MVP 的優先目標是打開 channel）
- **快速驗收**：可以立刻用 opengraph.xyz / card-validator.twitter.com 驗證

## Why Not @vercel/og / Satori

- `@vercel/og` 是 Vercel Edge Runtime 最佳化，在 Cloudflare Workers 有相容性風險
- Satori 需要字型檔案載入（Noto Sans TC 數 MB），cold start 慢
- Workers 的 HTML Rewriter API 可以動態注入 meta，但 OG **image** 生成仍需 Canvas/WASM
- MVP 不值得投入這個複雜度，先靜態 ship，再補動態

## 未來 Dynamic OG Roadmap

詳見 `TODOS.md`：
- 每個 trip 有動態 OG image 顯示行程名 + 天數 + 目的地
- 使用 Workers HTML Rewriter 動態替換 meta tag
- OG image 生成：KV cache + Cloudflare Image Resizing 或 lightweight canvas WASM
- 字型策略：Noto Sans TC subset + base64 embed

## 影響範圍

- `public/og/tripline-default.png` — 新增（1200x630 PNG）
- `public/_headers` — 新增 `/og/*` Cache-Control rule
- `index.html` — 補 OG + Twitter card meta tags
- `TODOS.md` — 補 dynamic OG roadmap 條目
- `scripts/generate-og-image.mjs` — 一次性生成腳本（SVG → PNG）
- `tests/unit/og-image.test.ts` — F001 測試
- `tests/unit/og-meta.test.ts` — F002 測試
- `tests/unit/og-headers.test.ts` — F004 測試
