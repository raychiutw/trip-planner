# UX 修復第二輪 — 任務清單

## Bug 修復
- [ ] 1. ThemeArt content map 修正（確認 lookup key 與 theme class 對應）
- [ ] 2. FAB trigger 改回 hardcoded SVG 三角形（不用 Icon 元件）
- [ ] 3. 出發確認 SpeedDial item 補 icon
- [ ] 4. DayNav active label 修正可見性（overflow/定位）
- [ ] 5. Bottom Sheet drag handle 橫線修正

## SpeedDial 重設計
- [ ] 6.1 CSS 改回垂直佈局：2 欄 × 4 行，從 FAB 往上展開
- [ ] 6.2 Label 全放左邊、固定兩字、font-size: var(--font-size-footnote)
- [ ] 6.3 Label pill 樣式：背景 + 圓角 + shadow（同舊版）
- [ ] 6.4 Staggered animation 從底部往上

## 移除/簡化
- [ ] 7. 移除 useSwipeDay hook 及 TripPage 中的呼叫
- [ ] 10. 行程頁移除 ← 返回箭頭
- [ ] 16. InfoPanel 移除 QuickLinks 元件

## Bottom Sheet 修正
- [ ] 9. X 關閉按鈕統一放大（同設定頁 40px tap target）
- [ ] 11. 匯出選項改回橫向排列 + 線條區隔
- [ ] 13. .info-sheet-body 加 overscroll-behavior: contain

## DayNav 修正
- [ ] 12. 每個 pill 加 aria-label（格式：MM/DD 地點名稱）
- [ ] 14. Active label 加強：字體 caption → footnote、顏色 muted → foreground

## 全站規範
- [ ] 15. 掃描全部 CSS 的 hardcoded font-size px → 替換為 --font-size-* token
- [ ] 22. 全站可點擊元素 hover 色塊加 padding + negative margin + border-radius
- [ ] 8. SpeedDial label 確認用 font-size token

## InfoPanel 桌面版
- [ ] 17. 今日行程每項加 onClick → scrollIntoView 對應 timeline entry
- [ ] 20. .info-panel 加 border-radius: var(--radius-lg)
- [ ] 21. Countdown 簡化：數字 var(--font-size-title1) + 「天」var(--font-size-headline)

## 新功能
- [ ] 18. TripPage useEffect：首次載入 todayDayNum → switchDay + scrollIntoView .tl-now

## 交通統計重設計
- [ ] 19.1 時間格式改為 XhYYm（移除中文）
- [ ] 19.2 手機版 <768px 改為卡片式垂直排列
- [ ] 19.3 桌面版 >=768px 改為表格式
- [ ] 19.4 開車 >2h 加 warning 底色 var(--color-warning-bg)
- [ ] 19.5 合計列 >2h 同樣加 warning
