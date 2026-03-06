## 1. localStorage prefix 變更

- [x] 1.1 `js/shared.js` 將 `LS_PREFIX` 從 `'trip-planner-'` 改為 `'tp-'`
- [x] 1.2 `js/shared.js` 新增遷移函式：掃描 localStorage 中 `trip-planner-*` key，搬移至 `tp-*`（新 key 不存在時才寫入），刪除舊 key；同時處理無 prefix 舊 key（`tripFile`、`tripPref`、`dark`）→ `tp-*`
- [x] 1.3 `js/app.js` 移除既有的舊 key 遷移 IIFE（`tripFile`、`tripPref`、`dark` 遷移邏輯已合併至 shared.js）

## 2. 載入失敗處理

- [x] 2.1 `js/app.js` `loadTrip` catch 區塊：呼叫 `lsRemove('trip-pref')`，在 `#tripContent` 渲染「行程不存在」訊息與 `setting.html` 連結按鈕
- [x] 2.2 `js/app.js` `resolveAndLoad` 移除 `DEFAULT_SLUG` 常數與 fallback 邏輯；當無 URL 參數且無 trip-pref 時，在 `#tripContent` 渲染「請選擇行程」訊息與 `setting.html` 連結按鈕

## 3. 樣式

- [x] 3.1 `css/style.css` 確認 `.trip-error` 樣式適用於新的訊息區塊（含連結按鈕樣式），必要時擴充

## 4. 測試

- [x] 4.1 `tests/unit/` 新增或更新 localStorage 遷移相關測試（舊 prefix → 新 prefix、無 prefix → 新 prefix、新 key 已存在不覆蓋）
- [x] 4.2 `tests/unit/` 新增 loadTrip 失敗時清除 trip-pref 並顯示訊息的測試
- [x] 4.3 `tests/unit/` 新增 resolveAndLoad 無 trip-pref 時顯示選擇行程訊息的測試
- [x] 4.4 `tests/e2e/` 更新或新增行程載入失敗場景測試（驗證訊息文字與 setting 連結）
