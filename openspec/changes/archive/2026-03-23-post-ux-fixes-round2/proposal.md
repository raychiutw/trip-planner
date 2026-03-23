# UX 修復第二輪 — 提案

## 背景

第一輪 post-ux-fixes 完成後，Key User 實際操作線上版發現 22 項問題（QC + Challenger 線上驗證確認）。包含 bug 修復、SpeedDial 重設計、全站規範強化、InfoPanel 改善、交通統計重設計。

## 22 項問題清單

### Bug 修復（5 項 🔴）
1. ThemeArt SVG 不隨主題切換（content map lookup 問題）
2. FAB trigger icon 消失（expand_less 不在 Icon registry）
3. 「出發確認」SpeedDial 缺 icon
4. DayNav active label 看不到（overflow 裁切或定位問題）
5. Bottom Sheet drag handle 橫線消失

### SpeedDial 重設計（1 項 🔴）
6. 改回 4×2 雙欄垂直佈局：label 全放左邊、固定兩字、FAB 用 ▲ 三角形 hardcoded SVG（不用 Icon 元件）

### 移除/簡化（3 項）
7. 移除 useSwipeDay（不要左右滑動切天）
10. 行程頁 ← 返回箭頭刪除
16. InfoPanel 移除 4 個快速連結按鈕

### Bottom Sheet 修正（3 項）
9. X 關閉按鈕統一放大（同設定頁尺寸）
11. 匯出 4 選項改回舊版橫向排列 + 線條區隔
13. InfoSheet overscroll-behavior: contain

### DayNav 修正（2 項）
12. pill 加 aria-label="MM/DD 地點名稱"
14. Active label 字體/顏色加強可見性

### 全站規範（3 項）
15. 所有字級用 --font-size-* token，掃描並替換所有 hardcoded px
22. 所有可點擊元素 hover 色塊加 padding + negative margin + border-radius
8. SpeedDial label 用 font-size token

### InfoPanel 桌面版（3 項）
17. 今日行程可點擊 → scrollIntoView 對應 timeline entry
20. InfoPanel 加圓角 var(--radius-lg)
21. 倒數天數簡化：131天（數字 title1、天字 headline）

### 新功能（1 項）
18. 旅行當天自動定位到當前 entry（首次載入 switchDay + scrollIntoView）

### 交通統計重設計（1 項）
19. 手機版卡片式 / 桌面版表格式 + 時間格式 XhYYm + 開車 >2h 警告底色
