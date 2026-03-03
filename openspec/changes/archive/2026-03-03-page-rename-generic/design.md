## Approach

本次變更為純文字字串替換，不涉及 CSS、HTML 結構或 JS 邏輯調整。所有改動都是將現有字串常值替換為新字串，改動範圍小、風險低。

### Item 4：JS 中的頁面名稱替換

`buildMenu()`、`buildEditMenu()`、`buildSettingMenu()` 三個函式內，每個函式分別在兩處（menu drawer `#menuGrid` 和 sidebar `#sidebarNav`）渲染導航連結。每處連結的可見文字與 `title` 屬性需同步修改。

替換規則（全站統一）：

| 原字串 | 新字串 |
|--------|--------|
| `行程頁` | `我的行程` |
| `編輯頁` | `編輯行程` |
| `設定頁` | `設定` |

每個函式共需替換 6 處（menu 3 項 × visible text + sidebar 3 項 × visible text + sidebar 3 項 × title 屬性，部分重疊）。

### Item 5：HTML meta 標籤替換

`index.html` 直接修改對應行的字串值，不改動任何 HTML 屬性名或結構。`edit.html` 僅改 `<title>` 標籤文字。

### 測試更新

`tests/e2e/edit-page.spec.js` 第 204 行的斷言 `expect(settingHref).toContain('設定頁')` 需改為 `expect(settingHref).toContain('設定')`，以符合新的 menu 連結文字。

其他 E2E 測試描述字串（`test('選單項目含行程頁/編輯頁/設定頁連結', ...)`、`test('側邊欄選單含行程頁/設定頁連結', ...)`）為測試說明文字，不影響執行結果，可視情況一併更新，但非必要。

## Files Changed

| 檔案 | 變更說明 |
|------|---------|
| `js/app.js` | `buildMenu()`：menu section 行程頁→我的行程、編輯頁→編輯行程、設定頁→設定（×2 每項）；sidebar section 同上含 title 屬性（×2 每項含 title） |
| `js/edit.js` | `buildEditMenu()`：menu section 及 sidebar section 同上三項文字與 title 屬性替換 |
| `js/setting.js` | `buildSettingMenu()`：menu section 及 sidebar section 同上三項文字與 title 屬性替換 |
| `index.html` | line 7 meta description 移除沖繩改為通用文字；line 9 og:title 改為「Trip Planner」；line 10 og:description 改為通用文字；line 13 title 改為「Trip Planner」 |
| `edit.html` | line 8 title 從「AI 修改行程 — Trip Planner」改為「編輯行程 — Trip Planner」 |
| `tests/e2e/edit-page.spec.js` | line 204 斷言 `toContain('設定頁')` 改為 `toContain('設定')` |
