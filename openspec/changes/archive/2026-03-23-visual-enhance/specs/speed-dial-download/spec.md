## ADDED Requirements

### Requirement: Speed Dial icon 放大至 28px

系統 SHALL 在 `css/style.css` 中新增規則，將 `.speed-dial-item` 內的 SVG 圖示尺寸設為 28px × 28px。`.speed-dial-item` 圓圈按鈕本身的大小 SHALL 維持不變。

```css
.speed-dial-item svg {
  width: 28px;
  height: 28px;
}
```

#### Scenario: speed-dial-item SVG 尺寸為 28px

- **WHEN** 渲染任意 `.speed-dial-item` 按鈕
- **THEN** 其內部 SVG 元素的 computed `width` 與 `height` SHALL 均為 `28px`

#### Scenario: speed-dial-item 按鈕大小不變

- **WHEN** 渲染 `.speed-dial-item` 按鈕（SVG 放大後）
- **THEN** 按鈕本身的 width 與 height SHALL 維持與修改前相同的值，不因 SVG 放大而撐大容器

### Requirement: Speed Dial 新增 download 項目

系統 SHALL 在 `src/components/trip/SpeedDial.tsx` 的 `DIAL_ITEMS` 陣列末尾新增一個項目：

```ts
{ key: 'download', icon: 'download', label: '下載行程' }
```

點擊 download 項目時，系統 SHALL 開啟 `DownloadSheet` bottom sheet，而非呼叫 `onItemClick`。

#### Scenario: Speed Dial 顯示下載按鈕

- **WHEN** Speed Dial 展開
- **THEN** 應有一個 `data-content="download"` 且 `aria-label="下載行程"` 的按鈕顯示

#### Scenario: 點擊下載按鈕開啟 DownloadSheet

- **WHEN** 使用者點擊 Speed Dial 中的下載按鈕
- **THEN** `DownloadSheet` bottom sheet SHALL 開啟，Speed Dial 菜單 SHALL 關閉

### Requirement: download icon

系統 SHALL 在 `src/components/shared/Icon.tsx` 的 `ICONS` registry 中新增 `download` key，路徑為 Material Symbols Rounded 風格的下載箭頭圖示：

```ts
'download': '<path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>'
```

#### Scenario: Icon 元件可渲染 download

- **WHEN** 以 `name="download"` 渲染 `<Icon>` 元件
- **THEN** 回傳的 SVG 內容 SHALL 包含下載箭頭路徑，不得為空

### Requirement: DownloadSheet 元件

系統 SHALL 建立 `src/components/trip/DownloadSheet.tsx`，為 bottom sheet 元件，提供四種行程下載格式選項。

Props 介面：

```ts
interface DownloadSheetProps {
  tripId: string;
  tripName: string;
  isOpen: boolean;
  onClose: () => void;
}
```

四個下載按鈕：

| 按鈕 | 動作 |
|------|------|
| PDF | 呼叫 `window.print()` |
| Markdown | 從 API 組裝 MD 文字，Blob 下載 |
| JSON | 下載行程完整 JSON 資料 |
| CSV | 攤平 entries 成 CSV，Blob 下載 |

下載檔名格式：`{tripName}-{YYYY-MM-DD}.{ext}`，日期取當前日期。

Markdown 組裝 SHALL 依序呼叫 `GET /api/trips/:tripId/days`，再對每天呼叫 `GET /api/trips/:tripId/days/:num`。

下載進行時 SHALL 顯示 loading 狀態，避免重複點擊。

#### Scenario: 點擊 PDF 觸發 window.print

- **WHEN** DownloadSheet 開啟且使用者點擊「PDF」按鈕
- **THEN** 系統 SHALL 呼叫 `window.print()`

#### Scenario: 點擊 JSON 下載原始資料

- **WHEN** DownloadSheet 開啟且使用者點擊「JSON」按鈕
- **THEN** 系統 SHALL 從 API 取得行程資料並下載 JSON 檔，檔名 SHALL 符合 `{tripName}-{YYYY-MM-DD}.json` 格式

#### Scenario: 點擊 Markdown 下載 MD 檔

- **WHEN** DownloadSheet 開啟且使用者點擊「Markdown」按鈕
- **THEN** 系統 SHALL 呼叫 API 取得各天資料，組裝 MD 文字後下載，檔名 SHALL 符合 `{tripName}-{YYYY-MM-DD}.md` 格式

#### Scenario: 點擊 CSV 下載攤平 entries

- **WHEN** DownloadSheet 開啟且使用者點擊「CSV」按鈕
- **THEN** 系統 SHALL 從 API 取得各天 entries，攤平為 CSV 並下載，檔名 SHALL 符合 `{tripName}-{YYYY-MM-DD}.csv` 格式

#### Scenario: 下載期間顯示 loading 狀態

- **WHEN** 使用者點擊任一下載按鈕後資料尚未準備完成
- **THEN** 對應按鈕 SHALL 顯示 loading 狀態（disabled 或 spinner），避免重複觸發

#### Scenario: 關閉 DownloadSheet

- **WHEN** 使用者點擊 sheet 遮罩或關閉按鈕
- **THEN** `onClose` callback SHALL 被呼叫，sheet SHALL 收起
