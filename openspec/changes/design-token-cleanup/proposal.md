## Proposal: design-token-cleanup

### Why

現有 CSS 中累積了數個命名不一致與缺少設計 token 的技術債，導致：

1. **語意混淆**：`:root` 中定義了 `--blue` 與 `--sand` 作為 `--accent`（茶赭色 `#C4704F`）的別名，但程式碼中出現 `color: var(--blue)` 渲染出橘棕色，命名與視覺嚴重不符。
2. **深色模式漏洞**：`.info-box` 共有 6 種型別，但深色模式只覆蓋其中 4 種（`.reservation`、`.parking`、`.souvenir`、`.restaurants`），`.shopping` 與 `.gas-station` 未套用深色背景，造成視覺不一致。
3. **散落的陰影值**：全站 7 處以上 `box-shadow` 直接硬寫數值，無法統一調整，維護成本高。
4. **邊框半徑分散**：CSS 中出現 6px、8px、10px、12px 等多個接近的值，缺乏一致的層級語意。
5. **優先色硬寫 Tailwind 色碼**：建議卡片使用 `rgba(239, 68, 68, 0.15)` 等 Tailwind 原始色，未定義為 CSS 變數，無法支援深色模式。

本次變更為純粹的重構整理，**對使用者零視覺差異**。

---

### What Changes

| 項目 | 類型 | 說明 |
|------|------|------|
| 變數重命名 | 重構 | `--blue` → `--accent`，`--blue-light` → `--accent-light`，`--sand` 刪除，`--sand-light` → `--accent-muted` |
| Info box 深色修復 | Bug Fix | 統一 `.info-box` 深色選擇器，補上 `.shopping`、`.gas-station` |
| Shadow tokens | 新增 | 定義 `--shadow-sm/md/lg/ring`，取代散落的硬寫值 |
| Radius tokens | 新增 | 定義 `--radius-sm/md/full`，取代多個接近的硬寫值 |
| Priority 色彩 tokens | 新增 | 定義 `--priority-high/medium/low-bg` 含深色模式覆蓋 |

---

### Capabilities

| Capability | 變動類型 | 說明 |
|------------|----------|------|
| `design-tokens` | 新增 | 定義 shadow、radius、priority 色彩 token |
| `warm-neutral-palette` | MODIFIED | 變數重命名（`--blue` → `--accent`、`--blue-light` → `--accent-light` 等） |
| `semantic-colors` | MODIFIED | 語意色命名對齊，移除 `--blue` 別名，更新 info-box 深色選擇器 |

---

### Impact

- **範圍**：僅 CSS，不涉及 JS、HTML、JSON 或測試。
- **受影響檔案**：`css/shared.css`、`css/style.css`、`css/menu.css`、`css/edit.css`、`css/setting.css`
- **視覺影響**：零（陰影值、半徑值、色彩值均維持等效）
- **風險**：低。所有替換均為機械性一對一對應，無邏輯變更。
