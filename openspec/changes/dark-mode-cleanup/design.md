## Context

深色模式透過 `body.dark` class 切換（JS 控制 + localStorage 儲存），CSS 變數在 `shared.css` 的 `body.dark` 中覆蓋。目前 `--card-bg` 未在 `body.dark` 中定義，導致使用 `var(--card-bg)` 的元素在深色模式顯示亮色底 `#EDE8E3`。此外，亮色模式多處硬編碼 `#C4704F`，迫使深色模式需額外寫覆蓋規則。

深色模式色階層次：

```
Layer 0  #1A1816  ── 頁面底色（body.dark background）
Layer 1  #292624  ── 卡片底色（--white / --card-bg）
Layer 2  #302A25  ── 巢狀區塊（--blue-light）
Layer 3  #3D3A37  ── 控件/強調（hw-block、input、sidebar toggle hover）
```

## Goals / Non-Goals

**Goals:**

- 修復深色模式卡片白底問題（補 `--card-bg`）
- 亮色模式硬編碼 `#C4704F` 改為 `var(--blue)`，讓深色自動切換
- 刪除與 CSS 變數值重複的 `body.dark` 覆蓋規則，從約 44 條瘦身至約 23 條
- 視覺效果完全不變（亮色和深色模式的最終渲染色應與修正後一致）

**Non-Goals:**

- 不重新設計深色模式色階（保留現有暖色調）
- 不引入新的 CSS 變數（除了 `--card-bg` 的 dark 覆蓋）
- 不修改 JS / HTML / JSON

## Decisions

### Decision 1: `--card-bg` 深色值設為 `#292624`（與 `--white` 同值）

**選擇**：`--card-bg: #292624`

**理由**：亮色模式中 `--card-bg`（`#EDE8E3`）與 `--white`（`#FFFFFF`）不同，卡片比頁面暗一階。但深色模式頁面底色是 `background: #1A1816`（非 `--white`），而 `--white: #292624` 已經是「比頁面亮一階」的效果，與 `--card-bg` 的語義一致。現有 `body.dark .info-card { background: #292624 }` 也證實此值正確。

**替代方案**：設為不同於 `--white` 的值（如 `#2D2A28`），但會引入第五層色階，增加複雜度且無明顯視覺收益。

### Decision 2: 在各 CSS 檔案中就地修改，不集中搬遷

**選擇**：保持現有的 CSS 拆分架構（shared / style / menu / edit / setting），各檔案內分別修正。

**理由**：遵循既有架構慣例，每個 CSS 檔案自行管理其 dark mode 覆蓋。搬遷會產生大量不必要的 diff。

### Decision 3: 保留具差異性的 dark mode 覆蓋規則

以下規則的硬編碼值不等於任何現有 CSS 變數，是刻意的視覺差異，必須保留：

| 規則 | 值 | 理由 |
|------|-----|------|
| `.hw-block { bg: #3D3A37 }` | ≠ `--white` | 天氣區塊刻意比卡片亮 |
| `.info-box.* { bg: #302A22/25 }` | 微調暖褐 | info-box 無亮色背景，深色才加 |
| `.menu-drawer { bg: #1A1816 }` | ≠ `--gray-light` | 手機 drawer 用頁面底色 |
| `.map-link:hover` 系列 | 專屬 hover 色 | hover 狀態需獨立控制 |
| `.edit-add-btn / .edit-trip-select { bg: #3D3A37 }` | ≠ `--gray-light` | 控件刻意比卡片亮 |
| `.color-mode-card { bg: #292624 }` | ≠ `--gray-light` | 設定頁卡片用 Layer 1 色 |

## Risks / Trade-offs

- **風險**：將 `#C4704F` 改為 `var(--blue)` 後，未來若 `--blue` 被修改，所有引用處會連動變色 → **緩解**：這正是使用 CSS 變數的目的，屬正向效果
- **風險**：刪除冗餘規則後可能遺漏某些瀏覽器的 CSS 繼承差異 → **緩解**：所有目標元素都直接使用 `var()` 引用，不依賴繼承；且 pre-commit 有 E2E 測試
