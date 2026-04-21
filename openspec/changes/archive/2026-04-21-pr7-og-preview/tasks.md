# Tasks: pr7-og-preview

TDD 順序：紅（測試） → 綠（實作） → 重構

## F001 — 靜態 brand OG image

### F001-T1 紅：og-image.test.ts 失敗測試
- 建 `tests/unit/og-image.test.ts`
- assert `public/og/tripline-default.png` 存在
- assert 檔案大小 > 10 KB（確保不是空檔）
- assert 檔案大小 < 500 KB（確保合理壓縮）
- 跑測試，確認因「檔案不存在」失敗（非編譯錯誤）

### F001-T2 綠：generate-og-image.mjs + 生成 PNG
- 建 `scripts/generate-og-image.mjs`
- 使用 SVG inline 方式定義 1200x630 OG image
- 品牌色 `#0077B6`（深藍背景）+ 白字
- 大標「Tripline」+ 副標「和旅伴一起查看精美行程」
- 使用 `@resvg/resvg-js` 或直接用 Node.js `fs` + SVG→Canvas 轉 PNG
- 執行腳本生成 `public/og/tripline-default.png`
- 跑 F001 測試，確認全綠

### F001-T3 重構
- 確認 SVG 內容清晰易讀
- 確認生成腳本可重複執行（冪等）

---

## F002 — index.html 補 OG + Twitter card meta

### F002-T1 紅：og-meta.test.ts 失敗測試
- 建 `tests/unit/og-meta.test.ts`
- 讀 `index.html`，assert 含 `property="og:image"`
- assert 含 `name="twitter:card"` + `content="summary_large_image"`
- assert 含 `property="og:image:width"` content 為 `1200`
- assert 含 `property="og:image:height"` content 為 `630`
- assert 不含重複的 `og:title`（只能出現一次）
- 跑測試，確認失敗

### F002-T2 綠：更新 index.html
- 在 `<head>` 補完整 OG + Twitter card meta tags
- 注意：index.html 已有 `og:title`、`og:description`、`og:site_name`、`og:type`、`og:url` — 不重複
- 補新增項目：`og:image`、`og:image:width`、`og:image:height`、twitter card 系列
- 跑 F002 測試，確認全綠

### F002-T3 重構
- 確認 meta 排列有邏輯順序（og: 一組，twitter: 一組）

---

## F003 — TODOS.md 補 dynamic OG roadmap

### F003-T1（豁免 TDD — 純文件）
- 在 `TODOS.md` 加 `## OG Preview — Dynamic per-trip image` 段落
- 說明 Blockers、Est、Priority

---

## F004 — public/_headers 補 `/og/*` Cache-Control

### F004-T1 紅：og-headers.test.ts 失敗測試
- 建 `tests/unit/og-headers.test.ts`
- 讀 `public/_headers`，assert 含 `/og/*` rule
- assert 含 `Cache-Control: public, max-age=86400`
- 跑測試，確認失敗

### F004-T2 綠：更新 public/_headers
- 在 `public/_headers` 加 `/og/*` rule + `Cache-Control` + `X-Content-Type-Options`
- 跑 F004 測試，確認全綠

### F004-T3 重構
- 確認 _headers 格式正確（Cloudflare Pages 語法）

---

## 驗收條件（全部完成才算 done）

- [ ] `public/og/tripline-default.png` 存在，10KB–500KB
- [ ] `npm test` 全綠（F001 + F002 + F004 新增測試通過）
- [ ] `npx tsc --noEmit` 0 errors
- [ ] `index.html` 含完整 OG + Twitter card meta
- [ ] `TODOS.md` 含 dynamic OG roadmap 條目
- [ ] `public/_headers` 含 `/og/*` Cache-Control rule
