## Approach

### Item 7 — 桌機 font-size 縮小一級（shared.css）

在 `css/shared.css` 末尾新增一個 `@media (min-width: 768px)` 區塊，在 `:root` 中覆蓋四個 font-size 變數。此方式不影響 mobile 任何宣告，桌機視窗下瀏覽器會自動套用覆蓋值。不修改現有 `:root` 基底宣告，確保回滾只需移除 media query 區塊即可。

對映關係（desktop override）：

| 變數 | mobile（:root）| desktop（media query）|
|------|---------------|----------------------|
| `--fs-display` | `2.5rem` | `2rem` |
| `--fs-lg` | `1.25rem` | `1.125rem` |
| `--fs-md` | `1.125rem` | `1rem` |
| `--fs-sm` | `0.875rem` | `0.8125rem` |

### Item 10 — Light mode day-header 背景色（style.css）

現有基底規則 `.day-header { background: var(--blue); color: var(--white); }` 在 dark mode 下呈現橘色（`#C4845E`），保留不動。新增一條 light mode 限定覆蓋，放在基底規則之後：

```css
body:not(.dark) .day-header {
    background: var(--card-bg);
    color: var(--text);
}
```

此策略避免拆分 dark/light 雙條規則，只需一條否定選擇器即可。若未來 dark mode 基底規則調整，light mode 覆蓋不受影響。

### Item 12 — Light mode 頁面底色微調（shared.css）

直接修改 `:root` 中的兩個變數值：
- `--white: #FAF9F5`（從 `#FFFFFF`）
- `--gray-light: #FAF9F5`（從 `#FAF9F7`）

兩值對齊後，`body`（引用 `var(--white)`）與使用 `var(--gray-light)` 的元素背景色一致，消除輕微色差。`--card-bg: #F5F0E8` 不動，與 `#FAF9F5` 底色形成 ΔE 足夠的視覺層次。`--bg` 也同步從 `#FFFFFF` 改為 `#FAF9F5`，確保所有引用 `var(--bg)` 與 `var(--white)` 的元素一致。

### Item 17 — Suggestion 優先度色彩（style.css）

三項修改均在 `css/style.css` 的 Suggestions 區塊：

1. 現有 `.sg-priority-high` / `.sg-priority-medium` 亮色背景 opacity 從 `0.08` 提高至 `0.15`
2. 新增 `.sg-priority-low` 規則，加入亮色背景 `rgba(34, 197, 94, 0.10)`（保留 `border-radius`、`padding` 與 high/medium 一致）
3. 將 `.sg-priority-low h4::before` 的 `background` 從 `#F97316` 改為 `#22C55E`
4. 在 `body.dark` 段落補充 `.sg-priority-low { background: rgba(34, 197, 94, 0.15); }`

### Item 18 — Light mode accent + send 按鈕（shared.css + edit.css）

**shared.css**：修改 `:root` 的 `--accent: #8B8580` 為 `--accent: #C4956A`。`body.dark` 的 `--accent: #C4845E` 不動。`--blue: var(--accent)` 別名保持，所有引用 `var(--blue)` 的選擇器自動繼承新值。

**edit.css**：`.edit-send-btn` 目前已是圓形（`border-radius: 50%`），只需調整：
- disabled 狀態（基底）：`background: var(--border)` 保持現有灰色
- enabled 狀態（`:not(:disabled)`）：`background: var(--accent)` 已存在，光是 `--accent` 值改變即可生效；確認 icon 使用箭頭上傳符號（HTML 層已有 SVG，CSS 不需額外修改）
- dark mode 覆蓋 `body.dark .edit-send-btn`：維持現有 `background: #3D3A37; color: #9B9590;` 不變

## Files Changed

| 檔案 | Items | 修改類型 |
|------|-------|---------|
| `css/shared.css` | 7, 12, 18 | 修改變數值、新增 media query |
| `css/style.css` | 10, 17 | 新增選擇器規則、修改色彩值 |
| `css/edit.css` | 18 | 確認 send 按鈕規則（accent 值繼承自 shared.css，不需另行修改） |
