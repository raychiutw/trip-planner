## Why

現有主題插畫以 `body` 的 `background-image` 呈現，被卡片層覆蓋後幾乎不可見；深色模式下插畫被整體暗化，失去辨識度；晴空與和風主題的 `--accent` 色調在淺色模式下偏淡，對比不足；sticky nav 的 Day pills 緊接行程名稱，排版失去呼吸感。本次統一修正，以嵌入式 SVG 元件取代背景圖、調整色碼、靠右對齊 pills，全面提升視覺精緻度。

## What Changes

- **插畫元件化**：建立 `src/components/trip/ThemeArt.tsx`，提供 `DayHeaderArt`、`DividerArt`、`FooterArt` 三個 inline SVG 元件，根據 `colorTheme` + `isDark` 渲染對應圖形（6 套主題 × 淺/深），取代 `body` 背景插畫
- **移除 body 背景圖**：刪除 `css/style.css` 中 `body.theme-*` 的 `background-image` 規則及 `images/bg-*.svg` 六個檔案
- **深色模式插畫原色化**：深色版插畫使用鮮豔原色（金色月亮 `#FFD080`、亮星 `#FFF4C0`、螢火蟲光暈等），不做暗化處理；插畫透明度淺色 50–55%、深色 35–45%
- **晴空 accent 加深**：`body.theme-sky` 的 `--accent` 從 `#5BA4CF` → `#3B88B8`
- **和風 accent 加深**：`body.theme-zen` 的 `--accent` 從 `#B8856C` → `#9A6B50`，抹茶 tag `--success` 從 `#9EB8A8` → `#7A9A88`
- **同步更新色碼來源**：`useDarkMode.ts` 的 `THEME_COLORS` 和 `SettingPage.tsx` 的 `COLOR_THEMES` 配合更新
- **Nav pills 靠右**：`#navPills`（或 `.nav-pills`）加 `margin-left: auto`，pills 靠 nav 右側

## Capabilities

### New Capabilities

- `inline-theme-art`：嵌入式主題插畫元件（DayHeaderArt / DividerArt / FooterArt），支援 6 套主題 × 淺/深，inline SVG 渲染，不再被卡片遮擋

### Modified Capabilities

- `design-tokens`：晴空/和風淺色 `--accent` 與 `--success` 色碼數值變更（spec 中色碼定義須更新）
- `sticky-nav-flush`：Day pills 對齊方式從緊接行程名稱改為 `margin-left: auto` 靠右（pill 佈局行為變更）

## Impact

- **新增檔案**：`src/components/trip/ThemeArt.tsx`
- **修改檔案**：
  - `css/shared.css`（`--accent`、`--success` 色碼）
  - `css/style.css`（移除 `body.theme-*` background-image，新增 nav pills 靠右）
  - `src/pages/TripPage.tsx`（引入三個 ThemeArt 元件）
  - `src/hooks/useDarkMode.ts`（`THEME_COLORS` sky/zen light 色碼）
  - `src/pages/SettingPage.tsx`（`COLOR_THEMES` swatch 色碼）
- **刪除檔案**：`images/bg-sun-light.svg`、`bg-sun-dark.svg`、`bg-sky-light.svg`、`bg-sky-dark.svg`、`bg-zen-light.svg`、`bg-zen-dark.svg`
- **無 API 異動**，無 D1 schema 異動，無 checklist/backup/suggestions 連動
