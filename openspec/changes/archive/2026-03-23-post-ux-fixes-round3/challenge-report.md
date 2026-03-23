# Challenger Report — Round 3 Proposal 質疑

> Date: 2026-03-20
> Reviewed: proposal.md + tasks.md
> Code references: css/style.css, css/shared.css

---

## Q1. SpeedDial grid 向左擴展 — 會不會超出螢幕邊界？

**嚴重度: 🔴 HIGH RISK**

### 現況

```css
/* style.css:553 */
.speed-dial { position: fixed; bottom: ...; right: 20px; }
/* style.css:571-572 */
.speed-dial-items { position: absolute; bottom: ...; right: 0; }
/* style.css:602-603 */
.speed-dial-label { position: absolute; right: calc(100% + 8px); }
```

目前 grid 是 `right: 0` 對齊 FAB 右緣，label 以 `right: calc(100% + 8px)` 向左延伸。整個結構已經靠右邊界 20px。

### 風險

1. **iPhone SE (320px viewport)**：FAB 在 right: 20px，FAB 56px + grid 雙欄（每欄 44px + 12px gap）= 56 + 44 + 12 + 44 = 156px。加上 label 向左伸出 ~60px，總共約 216px。320 - 20（right）= 300px 可用，看起來剛好夠。**但 R3-10 說要「加大 grid 容器寬度或加 left padding」，如果再加 padding，就可能超出 320px viewport。**

2. **Label pill 樣式（R3-11）**：改回 pill 樣式意味著 label 有 `background + padding + border-radius + box-shadow`。pill 比純文字寬。如果 label 文字是 3 個中文字（如「建議」 = ~36px + padding），pill 可能推到螢幕左緣外。

### 建議

- R3-10 必須在 iPhone SE (320px) viewport 上截圖驗證，不能只測 390px
- 考慮在 320px 以下自動隱藏 label 或縮短 label
- 「向左擴展空間」的具體 px 值需要明確定義，不能用模糊描述

---

## Q2. 移除 Countdown + TripStatsCard — 桌面版 InfoPanel 會不會太空？

**嚴重度: 🟡 MEDIUM RISK**

### 現況

InfoPanel (`--info-panel-w: 280px`) 目前有 3 個區塊：
1. Countdown（倒數天數）
2. TodaySummary（今日行程摘要）
3. TripStatsCard（行程統計：天數、景點數、開車/電車/步行時間）

### 風險

R3-4 移除 Countdown + R3-5 移除 TripStatsCard = 只剩 TodaySummary。即使 R3-8 加入飯店資訊 + 當日交通摘要，InfoPanel 的內容量可能不足以填滿高螢幕。

具體計算：
- TodaySummary（7 行 x ~28px）= ~196px
- 新增飯店資訊（~60px）
- 新增當日交通（~40px）
- 合計 ~296px

在 1280x800 的 viewport 中（扣除 nav 48px），可視高度 752px。InfoPanel 只有 ~296px 內容，下方會有 **~456px 空白**。

### 建議

- 如果要移除 Countdown + TripStatsCard，R3-8 的新增內容必須同時實作，不能分批
- 或者保留 Countdown（它只是一行數字，佔空間小但有資訊價值）
- 考慮 TodaySummary 展開後是否能顯示更多資訊（如每項的備註）

---

## Q3. InfoPanel 加寬 + 加地圖連結 + 飯店 + 交通 — 會不會太擁擠？

**嚴重度: 🟡 MEDIUM RISK**

### 現況

```css
/* shared.css:134 */
--info-panel-w: 280px;
/* style.css:502 */
.today-summary-item { display: flex; gap: 8px; padding: var(--spacing-1) var(--spacing-2); font-size: var(--font-size-callout); }
```

目前 TodaySummary 每行是 `時間 + 行程名稱`，排版緊湊但清晰。

### 風險

R3-7 要在每項加入「Google Maps icon + Naver Map icon」+ map code。目前每行已經是：
```
10:45  抵達那霸機場
```
加入 map 連結後會變成：
```
10:45  抵達那霸機場  G  N  33 002 519*00
```
在 280px（即使加寬到 340-360px），這一行可能需要換行或截斷。

同時 R3-8 要加飯店資訊 + 當日交通摘要，InfoPanel 變成 4 個區塊，資訊密度大增。

### 建議

- R3-6（加寬）必須在 R3-7/R3-8 之前實作，否則新內容在 280px 中必然擠爆
- map code（如 33 002 519*00）在 InfoPanel 中可能不需要——使用者看 InfoPanel 是快速瀏覽，不是導航
- 考慮 map 連結只在 hover/click 時展開，而非常駐顯示
- 加寬到多少需要明確數字。目前 `content-max-w: 720px` + `info-panel-w: 280px` + gap = ~1020px（在 1200px breakpoint 中已偏大）

---

## Q4. hover padding 加大 — 跟 Round 2 的 negative margin 問題會不會重現？

**嚴重度: 🔴 HIGH RISK**

### 現況

目前 `.today-summary-item`、`.col-row`、`.hw-summary` 都使用相同的 negative margin pattern：

```css
/* style.css:502 */
.today-summary-item { padding: var(--spacing-1) var(--spacing-2); margin: 0 calc(-1 * var(--spacing-2)); }
/* style.css:179 */
.col-row { padding: var(--spacing-1) var(--spacing-2); margin: 0 calc(-1 * var(--spacing-2)); }
```

`padding: 4px 8px` + `margin: 0 -8px` = hover 背景從容器邊緣到邊緣。

### 風險

R3-9 說「hover padding 加大：var(--spacing-1/2) -> var(--spacing-2/3)」。這裡的 `--spacing-1/2` 和 `--spacing-2/3` 不是現有 token 名稱。token 系統是：
```
--spacing-half: 2px
--spacing-1: 4px
--spacing-2: 8px
--spacing-3: 12px
```

如果意圖是 `padding: var(--spacing-2) var(--spacing-3)` (8px 12px)，則 negative margin 需同步改為 `margin: 0 calc(-1 * var(--spacing-3))` (-12px)。

**問題**：
1. **負 margin 超出父容器 padding**：如果父容器的 padding 只有 8px（`--spacing-2`），而 negative margin 是 -12px，hover 背景會溢出 4px。這正是 Round 2 中發生過的問題。
2. **全站影響**：R3-9 說「全站 hover padding 加大」。`.col-row`（飯店摺疊行）、`.hw-summary`（天氣）、`.today-summary-item`（InfoPanel）全部使用同一 pattern。改動影響範圍大。
3. **token 不存在**：`--spacing-1/2` 和 `--spacing-2/3` 不是現有的 CSS custom property。tasks.md 必須明確定義要改成什麼值。

### 建議

- 必須明確寫出目標 padding 和 negative margin 的具體 token 值
- 每個使用 negative margin pattern 的元素都要驗證其父容器 padding 是否足夠
- 建議先只改 InfoPanel 的 `.today-summary-item`，確認安全後再推廣到全站
- 應該有測試案例驗證 hover 背景不溢出（可用 `overflow: hidden` 在父容器上，但要確認不裁切其他內容）

---

## 總結

| 項目 | 嚴重度 | 核心風險 |
|------|--------|---------|
| Q1 SpeedDial 向左擴展 | 🔴 HIGH | iPhone SE 320px 可能超出螢幕 |
| Q2 移除 Countdown+Stats | 🟡 MEDIUM | 桌面版 InfoPanel 下方 ~456px 空白 |
| Q3 InfoPanel 加寬+加內容 | 🟡 MEDIUM | 280px 內塞不下 map 連結 + map code |
| Q4 hover padding 加大 | 🔴 HIGH | negative margin 溢出 + token 不存在 + 全站影響 |

**兩個 🔴 HIGH 建議在實作前解決：**
1. Q1：明確定義 320px viewport 的 SpeedDial 行為，tasks.md 加 iPhone SE 截圖驗證步驟
2. Q4：明確定義目標 token 值，逐元素驗證父容器 padding，先 InfoPanel 再全站
