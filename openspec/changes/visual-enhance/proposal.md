## Why

晴空（sky）主題的淺色配色對比度不足，各 UI 層次（背景、次要背景、強調色）色差過小，在戶外環境下易辨識度低。Speed Dial 圖示偏小、缺乏下載功能，而列印模式目前使用的不是純白背景，導致列印輸出視覺不乾淨。插畫寬度偏窄，裝飾感不足。

## What Changes

- 加大 `body.theme-sky` 各 CSS 變數色差，維持暖白主背景 `#FFF9F0`
- `ThemeArt.tsx` 的 `DayHeaderArt` container 從 `width: '60%'` 擴大至 `width: '80%'`，SVG 元素對應放大
- `css/style.css` 中 `.day-header` min-height 加高至 `100px`
- sticky nav 新增主題淡色裝飾背景（新增 `NavArt` 元件至 `ThemeArt.tsx`）
- `css/style.css` 列印模式 `.print-mode` 的卡片、info-card、day-header 改用純白 `#FFFFFF` 背景並移除 backdrop-filter
- `@media print` 同步套用純白規則
- Speed Dial svg icon 尺寸由約 `20px` 放大至 `28px`（CSS）
- `DIAL_ITEMS` 新增 `{ key: 'download', icon: 'download', label: '下載行程' }`
- `Icon.tsx` 新增 `download` icon
- 新增 `src/components/trip/DownloadSheet.tsx`：Bottom Sheet 顯示 PDF / Markdown / JSON / CSV 四種下載選項

## Capabilities

### New Capabilities

- `sky-theme-contrast`: 晴空主題淺色色差加大，讓 UI 層次更分明
- `day-header-art-enlarge`: DayHeaderArt 插畫放大 + NavArt sticky nav 裝飾
- `print-mode-whitebg`: 列印模式純白背景，卡片移除 backdrop-filter
- `speed-dial-download`: Speed Dial 下載功能（DownloadSheet + icon 放大）

### Modified Capabilities

（無現有 spec 的需求層行為變更）

## Impact

- `css/shared.css`：`body.theme-sky` 七個 CSS 變數值變更
- `src/components/trip/ThemeArt.tsx`：DayHeaderArt container width + SVG scale + 新增 NavArt
- `css/style.css`：`.day-header` min-height + `.print-mode` 卡片純白規則 + `@media print` + speed-dial icon 尺寸
- `src/components/trip/SpeedDial.tsx`：DIAL_ITEMS 新增 download + DownloadSheet 整合
- `src/components/shared/Icon.tsx`：新增 download icon
- `src/components/trip/DownloadSheet.tsx`：全新元件
- 無 API 端點異動、無 D1 schema 異動
- 無 checklist / backup / suggestions 格式連動影響
