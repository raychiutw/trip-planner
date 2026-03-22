## 1. Zen Dark 降飽和度

- [x] 1.1 修改 `css/shared.css` body.theme-zen.dark：調整 background/secondary/tertiary/hover/foreground/muted/border 為更灰的暖色值

## 2. Forest Dark 微調

- [x] 2.1 修改 `css/shared.css` body.theme-forest.dark：微調 background/muted 讓綠色更明顯

## 3. Elevated Surface（所有 dark 主題）

- [x] 3.1 在 `css/style.css` 新增 `body.dark .tl-card` 頂部微光 shadow
- [x] 3.2 新增 `body.dark .info-sheet-panel` accent tint 背景 + 頂部微光
- [x] 3.3 新增 `body.dark .quick-panel-item` inner highlight shadow

## 4. Shadow → Glow

- [x] 4.1 新增 `body.dark .edit-fab, body.dark .quick-panel-trigger` accent glow
- [x] 4.2 新增 `body.dark .info-sheet-panel, body.dark .quick-panel-sheet` 頂部邊線 + 深色投影

## 5. Separator 精緻化

- [x] 5.1 新增 `body.dark .tl-segment` 半透明白色邊線
- [ ] 5.2 新增 `body.dark .day-overview` 微光邊框（可選）

## 6. 測試

- [x] 6.1 執行 `npx tsc --noEmit` + `npm test` 確認全過
