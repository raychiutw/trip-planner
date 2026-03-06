## 1. JSON 結構與範本

- [x] 1.1 `data/examples/template.json` 新增 `meta.countries` 欄位（示例值 `["JP"]`）及 location 物件的 `naverQuery` 欄位（空字串）
- [x] 1.2 所有非韓國行程 JSON（okinawa x3、kyoto、banqiao）補上 `meta.countries`（`["JP"]` 或 `["TW"]`）
- [x] 1.3 釜山行程 JSON 補上 `meta.countries: ["KR"]`，並為所有 POI 的 location 新增 `naverQuery`（精確 Naver place URL，查不到時用搜尋式 URL）

## 2. 渲染端

- [x] 2.1 `js/app.js` `renderMapLinks` 新增 Naver Map 按鈕：有 `loc.naverQuery` 且以 `https://` 開頭時渲染 `<a>` 連結，class 含 `naver`，icon 為 `<span class="n-icon">N</span>`，文字 `N Map`
- [x] 2.2 `css/style.css` 或 `css/shared.css` 新增 `.n-icon` 樣式（背景色 `#03C75A`、白色文字、圓角與 `.g-icon` 一致）及 `.naver` class
- [x] 2.3 `tests/unit/render.test.js` 新增 renderMapLinks 的 Naver 相關測試（有 naverQuery 顯示、無則不顯示、不安全 URL 不渲染）

## 3. 品質規則

- [x] 3.1 `.claude/commands/trip-quality-rules.md` R1 新增 `meta.countries` 必填（非空 ISO 3166-1 alpha-2 陣列）
- [x] 3.2 `.claude/commands/trip-quality-rules.md` R3 新增 `naverQuery` URL 驗證（須以 `https://map.naver.com/` 開頭）
- [x] 3.3 `.claude/commands/trip-quality-rules.md` R3 修改 `mapcode` 條件：僅 `meta.countries` 含 `"JP"` 且 `meta.selfDrive === true` 時必填
- [x] 3.4 `.claude/commands/trip-quality-rules.md` 新增國家感知規則：`meta.countries` 含 `"KR"` 時所有 POI 的 location 必填 `naverQuery`

## 4. 驗證函式與測試

- [x] 4.1 `js/app.js` `validateTripData` 新增 `meta.countries` 驗證（必填、陣列、非空、元素為 2 字元大寫字串）
- [x] 4.2 `js/app.js` `validateTripData` 新增 `naverQuery` URL 驗證（存在時須以 `https://map.naver.com/` 開頭）
- [x] 4.3 `tests/unit/validate.test.js` 新增 countries 與 naverQuery 驗證測試
- [x] 4.4 `tests/json/quality.test.js` 確認既有品質測試通過（含新欄位）

## 5. Skill 更新

- [x] 5.1 `.claude/commands/tp-create.md` Phase 1 新增 `meta.countries` 自動判斷指引；Phase 2 新增韓國行程搜尋 naverQuery 指引
- [x] 5.2 `.claude/commands/tp-edit.md` 新增 naverQuery 欄位處理指引（韓國行程新增 POI 時須搜尋 naverQuery）

## 6. E2E 測試

- [x] 6.1 `tests/e2e/trip-page.spec.js` 新增 Naver Map 連結測試（韓國行程有 Naver 按鈕、非韓國行程無）
