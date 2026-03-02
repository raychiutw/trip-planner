# Tasks: pages-and-menu

## 統一選單結構

- [x] js/app.js `buildMenu()`：區段一加入行程頁/編輯頁/設定頁切換連結，區段二保留功能跳轉 + 列印模式，移除深色模式按鈕
- [x] js/edit.js `buildEditMenu()`：改為只有區段一（行程頁/編輯頁/設定頁），移除功能跳轉和深色模式
- [x] 新增 js/setting.js：buildSettingMenu() 同 edit 只有區段一
- [x] menu.css / shared.css：確保三頁選單樣式一致（sidebar + drawer）

## setting.html

- [x] 新增 setting.html：載入 shared.css + menu.css + setting.css + shared.js + menu.js + icons.js + setting.js
- [x] 新增 css/setting.css：setting 頁面樣式（行程清單卡片、色彩模式三選一卡片）
- [x] js/setting.js：讀取 trips.json 渲染行程清單，選中項目存 localStorage，標示當前選中
- [x] js/setting.js：色彩模式 Light/Auto/Dark 三選一卡片，Auto 使用 prefers-color-scheme media query
- [x] js/setting.js：選擇行程後更新 localStorage pref，頁面即時反映

## edit.html 重新設計

- [x] edit.html：移除舊版 edit-card 結構，改為 Claude 聊天風格佈局（spark icon + 問候語 + issue 列表 + 底部輸入區）
- [x] css/edit.css：重寫樣式 — 問候語區、issue 列表獨立捲動區、底部輸入卡片
- [x] js/edit.js：時段問候語（06-12 早安 / 12-18 午安 / 18-06 晚安）+ owner 名稱
- [x] js/edit.js：透過 GitHub API 拉取 trip-edit label 的 Issues，渲染在輸入框上方，顯示 open/closed 狀態
- [x] js/edit.js：issue 列表區域獨立 overflow-y scroll
- [x] js/edit.js：底部輸入區 — 行程名下拉切換、送出按鈕（空 → disabled 暗色，有字 → #C4704F 可按）
- [x] js/edit.js：移除 localStorage history 相關程式碼（getHistory/addHistory/renderHistory）

## 移除 switch

- [x] 刪除 switch.html、js/switch.js、css/switch.css
- [x] 更新所有引用 switch.html 的連結改為 setting.html
- [x] data/trips.json 引用不變，setting.js 直接讀取
