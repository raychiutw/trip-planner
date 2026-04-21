# Design: pr7-og-preview

## OG Image 視覺規格

### 尺寸
- 1200 x 630 px（標準 OG 規格，2:1 比例）
- Twitter/X、LINE、Facebook、iMessage、Slack 全部接受

### 色彩
- 背景：`#0077B6`（Tripline 品牌藍，對應 `--accent-500` token）
- 文字：白色 `#FFFFFF`
- 漸層（可選）：從 `#0077B6` 到 `#023E8A`（深藍，增加層次感）

### 文字
- 大標：「Tripline」— Inter Bold / 80px / white
- 副標：「和旅伴一起查看精美行程」— Noto Sans TC / 36px / rgba(255,255,255,0.85)
- 下方小字：「trip-planner-dby.pages.dev」— Inter / 24px / rgba(255,255,255,0.6)

### Layout
- 大標垂直置中稍上 (y ~280)
- 副標在大標下方 gap 24px (y ~376)
- 左邊留白 80px，文字靠左對齊（更現代感）
- 右下角可放簡單圖示（✈ 或 📍 emoji，SVG 內 text node）

## 技術方案選擇

### 方案 A：SVG inline → Node.js `fs.writeFileSync` as SVG（最簡）
- 直接生成 SVG 檔，rename 為 .png（部分爬蟲接受 SVG OG image）
- **問題**：LINE 爬蟲不接受 SVG，必須是真正的 PNG

### 方案 B：node-canvas（需安裝 native binding）
- `npm install canvas` — 有 native binary，Windows/macOS/Linux 都有 prebuilt
- 用 Canvas API 繪圖後 `canvas.toBuffer('image/png')`
- **問題**：canvas 是大 dep（~15MB prebuilt），只為一次生成有點重

### 方案 C：@resvg/resvg-js（SVG → PNG via WASM）
- `npx @resvg/resvg-js` 不需 install，`--config` 直接 pipe SVG
- 或用 CLI：`echo "<svg...>" | npx resvg-js /dev/stdin output.png`
- **問題**：Windows `/dev/stdin` pipe 行為不穩定

### 方案 D：sharp（已是常見 dep，有 SVG→PNG 能力）
- `sharp` 可以直接 `sharp(Buffer.from(svgStr)).png().toFile()`
- `sharp` 不在現有 devDependencies 中，但是業界標準
- 安裝成本低，功能可靠

### 方案 E：直接寫 PNG binary（最原始）
- 用 `pngjs` 或手寫 PNG header，繪圖效果差

### 決策：方案 D（sharp + SVG）

**理由**：
1. sharp 是 Node.js 圖片處理業界標準，Windows / macOS / Linux prebuilt 健全
2. SVG 定義視覺，sharp 轉 PNG — 分離關注點
3. 腳本可重複執行（冪等）
4. 字型內嵌不需要，SVG `font-family: sans-serif` 就夠（OG image 不需要精確字型）
5. 安裝為 `devDependencies`，不污染 production bundle

**安裝指令**：`npm install --save-dev sharp`

## 為何不用 @vercel/og / Satori

| | Satori | 本方案 (sharp+SVG) |
|---|---|---|
| Cloudflare Workers 相容 | 需驗證（Edge Runtime 綁 Vercel） | 不在 Workers 跑（build time 腳本） |
| 字型需求 | 需要 Noto Sans TC WASM 字型 | 不需要（SVG system font） |
| bundle 大小 | ~2MB+ | N/A（只在 build 時） |
| 動態 OG 支援 | 是（future use） | 否（靜態用途已足夠） |
| 安裝複雜度 | 高 | 低 |

**結論**：Satori 留給未來動態 OG 的 Workers 實作，MVP 不需要。

## _headers Cloudflare Pages 語法

```
/og/*
  Cache-Control: public, max-age=86400
  X-Content-Type-Options: nosniff
```

- `/*` 是前綴匹配，`/og/*` 匹配所有 `/og/` 下的路徑
- `max-age=86400` = 24 小時，爬蟲快取
- 注意：不加 `s-maxage` 避免混淆 Cloudflare Edge Cache 策略
