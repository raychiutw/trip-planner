# F-1 DestinationArt Code Review Report

**Reviewer**: Code Reviewer
**Date**: 2026-03-20
**Scope**: DestinationArt 新元件 + sticky-nav 嵌入 + CSS 分層

## 驗證結果

- `npx tsc --noEmit` — 0 errors (已在 R3 review 中確認)
- `npm test` — 440 passed, 0 failed (已在 R3 review 中確認)

---

## REQUEST CHANGES

### BUG-1: `.sticky-nav { position: relative; }` 破壞 sticky nav

**嚴重度: HIGH**

**問題**: style.css L44 新增 `.sticky-nav { position: relative; }`。

shared.css `@layer base` 定義 `.sticky-nav { position: sticky; top: 0; ... }`。style.css 是 un-layered（非 `@layer`），cascade 優先級高於 `@layer base`。因此 L44 的 `position: relative` **覆蓋** `position: sticky`，導致導覽列不再固定在頂部，會隨頁面捲動消失。

**原因分析**: 工程師想讓 `.sticky-nav` 成為 `.destination-art`（`position: absolute; inset: 0`）的 containing block。但 `position: sticky` 本身就建立 containing block（CSS spec: sticky positioning creates a stacking context and containing block），不需要額外設 `position: relative`。

**修復方案**: 刪除 style.css L44 `.sticky-nav { position: relative; }`。`position: sticky` 已經為 absolutely-positioned children 建立 containing block。

---

## 9 項標準審查

### 1. 正確性 + 可讀性 + 測試覆蓋

#### Q1: SVG viewBox 480x48 配合 sticky-nav?
- **分析**: sticky-nav 高度由 `padding: 12px 16px` + 內容決定（約 48-56px）。`viewBox="0 0 480 48"` + `preserveAspectRatio="xMidYMid slice"` 讓 SVG 填滿容器寬度並居中裁切高度。`width: 100%; height: 100%` 配合 `.destination-art { inset: 0 }` 讓 SVG 精確覆蓋 nav 區域。**正確。**

#### Q2: z-index 分層
- `.destination-art { z-index: 0; pointer-events: none }` — art 在底層，不攔截互動
- `.sticky-nav > :not(.destination-art) { position: relative; z-index: 1; }` — nav 內容提升到 art 之上
- **正確**（前提是 BUG-1 修復後 sticky-nav 仍為 containing block）

#### Q3: tripId mapping 是否涵蓋全部 7 個行程?
- `okinawa` → 匹配 `okinawa-trip-2026-Ray`, `okinawa-trip-2026-HuiYun`, `okinawa-trip-2026-RayHus`, `okinawa-trip-2026-AeronAn` (4 個)
- `busan` → 匹配 `busan-trip-2026-CeliaDemyKathy` (1 個)
- `kyoto` → 匹配 `kyoto-trip-2026-MimiChu` (1 個)
- `banqiao` → 匹配 `banqiao-trip-2026-Onion` (1 個)
- **全部 7 個行程都有對應的目的地主題。正確。**

#### Q4: memo 使用
- `memo(function DestinationArt({ tripId, dark }))` — 依賴 `tripId` 和 `dark` 兩個 primitive props。只在行程切換或 dark mode toggle 時 re-render。**正確。**

#### Q5: dark mode opacity
- Light: 0.12-0.35 (Okinawa 最高)
- Dark: 0.06-0.20 (整體降低)
- Dark mode 降低 opacity 防止在深色背景上過於搶眼。**合理。**
- **注意**: Okinawa light 最高 opacity 0.35 可能在某些 theme 的 accent-bg 色上略顯搶眼，建議 QC 在 6 theme x 2 mode 做截圖驗證。

#### 其他正確性
- `resolveDestination` 是 named export，方便測試。**好。**
- SVG 元素使用 hardcoded color（如 `#2A8EB0`）而非 CSS variable — 因為 SVG inline fill/stroke 無法直接引用 CSS `var()`（除非用 `currentColor` + `color` 屬性）。**可接受，但意味著 SVG 顏色不會隨 theme 變化**（只有 dark/light 兩套）。這是 by design。

### 2. 架構影響評估

| 修改 | 影響範圍 | 評估 |
|------|---------|------|
| 新檔案 DestinationArt.tsx | 無既有程式受影響 | OK |
| TripPage.tsx import 新增 | 僅新增一行 import + JSX 嵌入 | OK |
| style.css `.destination-art` | 新 class，無衝突 | OK |
| style.css `.sticky-nav { position: relative }` | **破壞 sticky 行為** | BUG-1 |
| style.css `.sticky-nav > :not(.destination-art)` | 新規則，不影響既有 DOM（非 aria-hidden 子元素無副作用） | OK |

### 3. 效能影響分析

- **SVG 大小**: 每個目的地 ~30-50 個 SVG 元素，極輕量，不影響 render 效能。
- **memo 正確**: 避免滾動期間無意義 re-render。
- **content object**: 在 render 函式內建構 `content` map 且包含 JSX。每次 render 都會建立所有 5 個目的地的 light + dark 共 10 個 React element，但只使用其中 1 個。**LOW 效能問題** — 可以改為 switch-case 只建構需要的那一個。不過因為 memo 包裝且 SVG 元素極輕，實務影響微乎其微。

### 4. 安全性審查

- 無使用者輸入。tripId 從 URL/localStorage 來，但 `resolveDestination` 只做 `startsWith` 比對，不會注入任何值到 DOM。
- SVG 全部 inline，無 external resource loading。
- **安全。**

### 5. 向後相容

- 新增元件，無既有 API 變更。
- BUG-1 除外（改變了 sticky-nav position），修復後無相容性問題。

### 6. Design Pattern 建議

- `content` map 可改為 `switch` 或 lazy lookup 以避免建構不必要的 JSX node。但因 memo + SVG 極輕，不急。**LOW — 可選優化。**

### 7. 技術債標記

| 項目 | 嚴重度 | 說明 |
|------|--------|------|
| SVG hardcoded colors 不隨 theme 變化 | LOW | 僅 dark/light 切換，不隨 6 主題顏色切換。by design 但未來新增主題時需注意。 |
| `content` map 每次 render 建構 10 個 JSX node | LOW | memo 保護下無實質影響 |

### 8. 跨模組 side effect

- `.sticky-nav > :not(.destination-art) { position: relative; z-index: 1; }` — 這會讓 sticky-nav 內所有非 destination-art 的直接子元素（包括 nav-brand、DayNav、NavArt）都獲得 `position: relative; z-index: 1`。`NavArt` 已有 `aria-hidden="true"`，會被 `.sticky-nav > [aria-hidden="true"]` 的 mask-image 規則套用。因為 `:not(.destination-art)` 也匹配 NavArt，NavArt 會同時得到 `z-index: 1` 和 mask-image。**不衝突，但應確認 NavArt 視覺正常。**

### 9. /tp-code-verify + /tp-ux-verify

#### Code 驗證
- **命名規範**: `destination-art` kebab-case，OK。`DestinationArt` PascalCase component，OK。`resolveDestination` camelCase function，OK。
- **CSS HIG**: `.destination-art` 使用 `inset: 0`（shorthand for top/right/bottom/left），OK。無 hardcoded font-size。新 CSS 在 style.css 非 `@layer`，與既有 pattern 一致。

#### UX 驗證
- **可及性**: `aria-hidden="true"` 正確 — decorative content 不應被 screen reader 讀取。
- **pointer-events: none** — 不攔截使用者互動。OK。
- **mask-image 套用**: `.sticky-nav > [aria-hidden="true"]` 匹配 `.destination-art`（因為有 `aria-hidden="true"`），邊緣漸層會讓 art 兩側自然淡出。**好的設計。**

---

## 重點問題回答

### Q1: SVG viewBox 480x48 配合 sticky-nav?
**正確。** 480:48 比例搭配 `xMidYMid slice`，在任何寬度下都能居中填滿。48px 與 nav 高度相近，不會有明顯比例失真。

### Q2: z-index 分層是否正確?
**邏輯正確，但實作有 BUG。** `z-index: 0`（art）< `z-index: 1`（nav content）的分層設計正確。但 `.sticky-nav { position: relative }` 破壞了 sticky 行為（BUG-1）。修復：刪除此行，`position: sticky` 本身即為 containing block。

### Q3: tripId mapping 是否涵蓋全部 7 個行程?
**全部涵蓋。** 4 個 okinawa + 1 busan + 1 kyoto + 1 banqiao = 7 個。`startsWith` 正確匹配 prefix。

### Q4: memo 使用是否正確?
**正確。** 兩個 primitive props，淺比較即可。

### Q5: dark mode opacity 設定?
**合理。** Dark mode 整體降低 40-60%，避免在深色背景上過亮。Okinawa light 的 0.35 是最高值，建議 QC 驗證是否影響 DayNav pill 可讀性。

### Q6: /tp-code-verify + /tp-ux-verify
**通過（除 BUG-1 外）。** 命名、token、a11y 皆合規。

---

## 裁決

### REQUEST CHANGES

**必修**:
1. **BUG-1**: 刪除 style.css `.sticky-nav { position: relative; }` — 破壞 sticky nav，`position: sticky` 已建立 containing block

**建議**（不阻擋）:
- QC 在 6 theme x 2 mode 驗證 Okinawa 0.35 opacity 是否影響 DayNav 可讀性
- 未來可將 `content` map 改為 switch-case 減少無用 JSX 建構
