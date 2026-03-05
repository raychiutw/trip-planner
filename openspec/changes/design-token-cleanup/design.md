## Design: design-token-cleanup

### D1：變數重命名策略

現有 `:root` 與 `body.dark` 中存在以 `--blue`、`--sand` 命名的茶赭色別名，語意錯誤。

**遷移對映表：**

| 舊變數 | 新變數 | 說明 |
|--------|--------|------|
| `--blue` | `--accent` | 移除別名，直接引用 `--accent` |
| `--blue-light` | `--accent-light` | 淺色背景版本 |
| `--sand` | （刪除） | 與 `--accent` 值相同，無存在意義 |
| `--sand-light` | `--accent-muted` | Light 值 `#F5EDE0`，Dark 值 `#302A22` |

**具體色值：**

| 變數 | Light 值 | Dark 值 |
|------|----------|---------|
| `--accent` | `#C4704F`（已存在） | `#D4845E`（已存在） |
| `--accent-light` | `#F5EDE8` | `#302A25` |
| `--accent-muted` | `#F5EDE0` | `#302A22` |

**執行方式：**
1. 在 `:root` 與 `body.dark` 中新增 `--accent-light` 與 `--accent-muted` 定義，同時刪除 `--blue`、`--blue-light`、`--sand`、`--sand-light`。
2. 在所有 CSS 檔案中全域取代 `var(--blue)` → `var(--accent)`、`var(--blue-light)` → `var(--accent-light)`、`var(--sand)` → `var(--accent)`、`var(--sand-light)` → `var(--accent-muted)`。

---

### D2：Info Box 深色模式統一選擇器

**問題：** 目前深色模式僅覆蓋 4 種 info-box 型別：

```css
body.dark .info-box.reservation,
body.dark .info-box.parking,
body.dark .info-box.souvenir,
body.dark .info-box.restaurants { background: var(--blue-light); }
```

`.info-box.shopping` 與 `.info-box.gas-station` 未被覆蓋。

**解法：** 改用通用選擇器，對所有 `.info-box` 一次設定：

```css
body.dark .info-box { background: var(--accent-light); }
```

這樣新增任何 info-box 型別時都自動支援深色模式，不需再逐一補加。

---

### D3：Shadow Token 定義與替換對映

在 `css/shared.css` 的 `:root` 新增以下四個 shadow token：

| Token | 值 | 用途 |
|-------|----|------|
| `--shadow-sm` | `0 1px 4px rgba(0,0,0,0.06)` | 輕量浮升（訊息氣泡） |
| `--shadow-md` | `0 4px 12px rgba(0,0,0,0.12)` | 中等浮升（input card、FAB） |
| `--shadow-lg` | `0 6px 16px rgba(0,0,0,0.2)` | 強浮升（FAB hover、sidebar） |
| `--shadow-ring` | `0 0 0 2px var(--accent)` | 焦點環（focus-visible、hw-now） |

**硬寫值替換對映：**

| 原硬寫值 | 替換為 |
|----------|--------|
| `0 1px 4px rgba(0,0,0,0.06)` | `var(--shadow-sm)` |
| `0 2px 12px rgba(0,0,0,0.07)` | `var(--shadow-md)` |
| `0 2px 12px rgba(0,0,0,0.25)` | `var(--shadow-md)` |
| `0 4px 12px rgba(0,0,0,0.2)` | `var(--shadow-md)` |
| `0 6px 16px rgba(0,0,0,0.2)` | `var(--shadow-lg)` |
| `0 6px 16px rgba(0,0,0,0.3)` | `var(--shadow-lg)` |
| `0 0 0 2px var(--blue)` | `var(--shadow-ring)` |
| `0 0 0 2px var(--accent)` | `var(--shadow-ring)` |

---

### D4：Border-Radius Token 定義與替換對映

在 `css/shared.css` 的 `:root` 新增以下三個 radius token：

| Token | 值 | 用途 |
|-------|----|------|
| `--radius-sm` | `8px` | info-box、status-tag、map-link、警告區塊、小元件 |
| `--radius-md` | `12px` | section card、info-card、nav-pill（`.dn`）、trip-btn |
| `--radius-full` | `99px` | pill tags（`.hl-tag`） |

**硬寫值替換對映：**

| 原硬寫值 | 替換為 | 適用元素 |
|----------|--------|----------|
| `6px` | `--radius-sm` | `.trip-warnings`、`.trip-warning-item`（原 6px） |
| `8px` | `--radius-sm` | `.info-box`、`.status-tag`、`.tl-head`、`.hotel-sub`、多處 |
| `10px` | `--radius-sm` | `.ov-card`、`.hw-block`（視覺接近 8px） |
| `12px` | `--radius-md` | `section`、`.info-card`、`.dn`、`.trip-btn`、`.flight-row` 等 |
| `99px` | `--radius-full` | `.hl-tag` |

> **例外保留**：圓形元素（`border-radius: 50%`）不替換；`.info-sheet-panel` 的 `16px 16px 0 0` 屬 UI 特殊形狀，不納入 token 化。

---

### D5：Priority 色彩 Token 定義

**問題：** 建議卡片使用 Tailwind 原始色碼硬寫，不支援深色模式：

```css
.sg-priority-high   { background: rgba(239, 68, 68, 0.15); }
.sg-priority-medium { background: rgba(234, 179, 8, 0.15); }
.sg-priority-low    { background: rgba(34, 197, 94, 0.10); }
```

**解法：** 定義 CSS 變數，Light / Dark 分別設值：

| Token | Light 值 | Dark 值 |
|-------|----------|---------|
| `--priority-high-bg` | `rgba(239, 68, 68, 0.15)` | `rgba(239, 68, 68, 0.22)` |
| `--priority-high-dot` | `#EF4444` | `#FCA5A5` |
| `--priority-medium-bg` | `rgba(234, 179, 8, 0.15)` | `rgba(234, 179, 8, 0.22)` |
| `--priority-medium-dot` | `#EAB308` | `#FDE047` |
| `--priority-low-bg` | `rgba(34, 197, 94, 0.10)` | `rgba(34, 197, 94, 0.15)` |
| `--priority-low-dot` | `#22C55E` | `#86EFAC` |

Dark 模式下適度提高不透明度（0.15 → 0.22、0.10 → 0.15），確保在深色背景上的對比度。
