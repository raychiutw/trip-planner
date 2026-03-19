## Context

目前網站使用單一配色（森林綠 `#4A7C59`），透過 `:root` 定義淺色變數、`body.dark` 覆寫深色變數。使用者回饋風格過於專業，希望能切換不同休閒風格的配色。

現有機制：
- `useDarkMode.ts` hook 管理 `colorMode`（`light`/`dark`/`auto`），控制 `body.dark` class
- `SettingPage.tsx` 提供三張模式卡片（淺色/深色/自動）
- 各頁 HTML 寫死 `<meta name="theme-color" content="#4A7C59">`

## Goals / Non-Goals

**Goals:**
- 提供三套色彩主題（陽光/晴空/和風），各有淺色 + 深色版
- 主題選擇與深淺模式獨立運作
- 切換即時生效、重新整理後保持
- 符合既有 CSS HIG 規範（token、無框線設計）

**Non-Goals:**
- 不做自訂色彩（使用者自選 accent color）
- 不做行程綁定主題（每個行程自動配色）
- 不修改 API 或 D1 結構（主題純前端 localStorage）

## Decisions

### D1: CSS 變數覆寫策略 — 使用 body class 組合

**選擇**：`body.theme-sun`、`body.theme-sky`、`body.theme-zen`，搭配 `body.dark`

**替代方案**：
- CSS custom property set（`@property`）— 瀏覽器支援度不足
- data attribute（`data-theme="sun"`）— 可行但與現有 `body.dark` 風格不一致

**理由**：與現有 `body.dark` class 機制一致，選擇器組合直覺（`body.theme-sky.dark`）。

### D2: 預設主題 — 陽光（sun）

新使用者和未設定主題的既有使用者都使用「陽光」主題。現有的 `:root` 變數改為 `body.theme-sun` 的值，`:root` 只保留非色彩的基礎 token。

### D3: hook 架構 — 擴展 useDarkMode 為 useTheme

將 `useDarkMode.ts` 重新命名或擴展，同時管理 `colorMode` 和 `colorTheme`。

**理由**：主題 class 和 dark class 需要在同一處協調，避免競態條件。

### D4: meta theme-color — JS 動態設定

移除 HTML 中寫死的 `<meta name="theme-color">`，改由 hook 初始化時根據主題 + 模式動態設定。每套主題 × 模式需定義對應的 theme-color 值。

### D5: CSS 結構

```
:root          — 非色彩 token（spacing, radius, font-size, duration 等）
body.theme-sun — 陽光淺色變數
body.theme-sky — 晴空淺色變數
body.theme-zen — 和風淺色變數
body.theme-sun.dark — 陽光深色變數
body.theme-sky.dark — 晴空深色變數
body.theme-zen.dark — 和風深色變數
```

## Risks / Trade-offs

- **[CSS 選擇器優先級]** → `body.theme-xxx.dark` 比 `body.dark` 優先級高，不需要 `!important`。須確保不與頁面特定覆寫衝突。
- **[6 組配色維護成本]** → 每次新增 CSS 變數需更新 6 處。可在 CSS 註解中標記區塊方便查找。
- **[既有使用者遷移]** → 第一次載入時 `colorTheme` 為空，hook 需預設 fallback 為 `sun` 並寫入 localStorage。
- **[meta theme-color 閃爍]** → JS 載入前的瞬間可能無 theme-color。在 HTML 保留一個預設值（陽光色），JS 載入後覆蓋。
