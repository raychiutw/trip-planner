## 1. Spring Easing Tokens

- [x] 1.1 在 `css/shared.css` 的 `:root` 新增 `--ease-spring`、`--ease-sheet-close`、`--duration-sheet-open`、`--duration-sheet-close` tokens

## 2. Container Scale-Down

- [x] 2.1 在 `css/shared.css` 或 `css/style.css` 新增 `.container.sheet-open` 的 scale-down + border-radius 樣式
- [x] 2.2 修改 `src/components/trip/InfoSheet.tsx`：open/close 時 toggle `.container` 的 `sheet-open` class
- [x] 2.3 修改 `src/components/trip/QuickPanel.tsx`：同上

## 3. Sheet 動畫 Easing

- [x] 3.1 修改 InfoSheet / QuickPanel 的 CSS transition 使用新的 spring easing tokens
- [x] 3.2 區分開啟（spring + 420ms）和關閉（ease-out + 280ms）的動畫

## 4. 測試

- [x] 4.1 執行 `npx tsc --noEmit` + `npm test` 確認全過
