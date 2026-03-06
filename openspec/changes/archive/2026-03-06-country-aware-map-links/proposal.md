## Why

韓國的 Google Maps 因資料出口限制，無法提供導航與大眾運輸路線，實用性極低。Naver Map 是韓國在地標準，提供完整的店家資訊、評價、導航功能。釜山行程已上線但缺少 Naver Map 連結，旅伴在韓國現場使用不便。同時，mapcode 是日本特有的車用導航編碼，目前品質規則未限定適用國家。需要引入國家感知機制，讓地圖連結依行程目的地自動調整。

## What Changes

- 新增 `meta.countries` 欄位（ISO 3166-1 alpha-2 國碼陣列，如 `["KR"]`、`["JP"]`、`["TW"]`），由 tp-create 根據行程目的地自動判斷填入
- 新增 `location.naverQuery` 欄位，存放 Naver Map 精確 place URL（`https://map.naver.com/v5/entry/place/{placeId}`），查不到 place ID 時 fallback 為搜尋式 URL
- `renderMapLinks` 渲染邏輯：有 `naverQuery` 就顯示 Naver Map 按鈕、有 `mapcode` 就顯示 mapcode（純粹依欄位有無，不看 countries）
- 品質規則新增：KR 行程的 POI 必填 `naverQuery`；`mapcode` 收窄為 JP + selfDrive 行程才需填
- 所有既有行程 JSON 補上 `meta.countries`
- 釜山行程所有 POI 補上 `naverQuery`（精確 Naver place URL）

## Capabilities

### New Capabilities
- `country-aware-maps`: 依行程目的地國家決定地圖連結種類（Naver Map 按鈕渲染、naverQuery 欄位、countries 欄位）

### Modified Capabilities
- `trip-quality-rules-source`: 品質規則新增 KR 行程 naverQuery 必填條件、mapcode 條件收窄為 JP + selfDrive

## Impact

- **JSON 結構變更**：`meta.countries`（新欄位）、`location.naverQuery`（新欄位）
  - `data/examples/template.json` 需同步更新
  - checklist / backup / suggestions 不受影響（新欄位不涉及天數或內容結構）
- **JS**：`js/app.js`（renderMapLinks 加 Naver 按鈕）、`js/icons.js`（可能需 Naver icon）
- **CSS**：`css/style.css` 或 `css/shared.css`（Naver 按鈕樣式）
- **品質規則**：`.claude/commands/trip-quality-rules.md`
- **行程 JSON**：所有 `data/trips/*.json`（補 countries）、釜山行程（補 naverQuery）
- **測試**：validate / render / quality 測試需更新
- **tp-create / tp-edit skill**：`.claude/commands/tp-create.md`、`.claude/commands/tp-edit.md` 需加入 naverQuery 搜尋指引
