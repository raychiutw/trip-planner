# F-2 DayArt Code Review Report

**Reviewer**: Code Reviewer
**Date**: 2026-03-20
**Scope**: DayArt 動態 Day Header SVG + dayArtMapping 關鍵字映射

## 驗證結果

- `npx tsc --noEmit` — 0 errors
- `npm test` — 440 passed, 0 failed

---

## REQUEST CHANGES

### BUG-1: `includes('橋')` 誤觸板橋行程（MEDIUM）

**問題**: `{ keyword: '橋', art: 'bridge' }` 使用 `String.includes()` 比對。板橋行程（`banqiao-trip-2026-Onion`）的許多標題包含「板橋」（如「板橋車站商圈」「板橋慈惠宮」），會誤觸為 `bridge`。板橋 15 天行程中大量 day header 會顯示橋的 SVG，而非實際 POI 的裝飾。

**實測數據**:
- `板橋車站商圈` → 匹配 `橋` → bridge (錯誤)
- `板橋慈惠宮` → 匹配 `橋` → bridge (錯誤)
- `新月橋` → 匹配 `橋` → bridge (正確)

**修復方案**: 將 `橋` 改為更明確的關鍵字，或排除已知地名：
- 方案 A：改 keyword 為 `大橋`、`古橋`、`新月橋` 等具體橋名
- 方案 B：加入排除規則（但會使邏輯變複雜）
- 方案 C：將 `橋` 的 priority 降低到最後，讓其他更具體的關鍵字優先匹配

### BUG-2: `includes('山')` 誤觸釜山相關標題（LOW）

**問題**: `{ keyword: '山', art: 'mountain' }` 匹配到「山佳車站」和「釜山塔」「ARTE Museum 釜山」。

**實測數據**:
- `山佳車站` → 匹配 `山` → mountain (錯誤 — 山佳是地名)
- `釜山塔` → 匹配 `山` → mountain (錯誤 — 釜山是城市名)

**嚴重度**: LOW — 因為這些誤觸只會讓 header 顯示山的裝飾圖而非完美匹配，視覺上不突兀。山佳車站只出現在板橋 Day 12。釜山行程的 `山` 誤觸因為 KEYWORD_MAPPINGS 順序，`市場` 和 `水族館` 等關鍵字優先匹配。

**修復方案（非必要）**: 將 `山` 改為 `登山` 或更具體的山名。

---

## 9 項標準審查

### 1. 正確性 + 可讀性 + 測試覆蓋

#### Q1: extractArtKeys 的 includes 比對是否有誤觸？

**有誤觸，詳見 BUG-1 和 BUG-2。** 完整分析：

| 關鍵字 | 意圖 | 實際誤觸 | 嚴重度 |
|--------|------|---------|--------|
| `橋` | 橋樑 | `板橋車站商圈`、`板橋慈惠宮` | **MEDIUM** — 板橋行程大量受影響 |
| `山` | 山脈 | `山佳車站`、`釜山塔` | LOW — 偶發且不突兀 |
| `城` | 城堡 | `首里城公園` | 正確 — 首里城是城堡 |
| `島` | 島嶼 | `瀨長島` | 正確 — 瀨長島是島 |
| `塔` | 塔 | `古宇利海洋塔`、`釜山塔` | 正確 |
| `寺` | 寺廟 | `承天禪寺`、`金閣寺` | 正確 |
| `市場` | 市場 | `錦市場`、`扎嘎其市場` | 正確 |
| `湯` | 溫泉 | `万座深海の湯` | 正確 — 且 `溫泉` 已先匹配 |

**注意**: `首里城` 有獨立的更具體映射（L40），但因為 `城` (L39) 在列表中更早出現，會先被 `城` 匹配。由於兩者都映射到 `castle`，結果正確，但 `首里城` 的獨立條目是多餘的。

#### Q2: DayHeaderArt 是否完全被取代？ThemeArt import 清理？

- **TripPage.tsx L22**: import 改為 `{ DividerArt, FooterArt, NavArt }`，已移除 `DayHeaderArt`。OK。
- **ThemeArt.tsx**: `DayHeaderArt` 仍然 exported (L343)。不再被任何檔案 import，成為 dead code。
- **建議**: 後續清理 PR 移除 `DayHeaderArt` 及相關 CSS。

#### Q3: memo + useMemo 使用正確？

- `DayArt` 使用 `memo(function DayArt({ entries, dark }))` — `entries` 是陣列 reference，`dark` 是 primitive。當 DaySection re-render（例如 theme 變化），DayArt 的 memo 會比較 `entries` reference 和 `dark` value。若只有 theme 變化（`dark` 不變），`entries` reference 不變（來自 `day?.timeline ?? []` 在 DaySection 內），所以 DayArt 不會 re-render。**正確。**
- `useMemo` 在 L378: `extractArtKeys` 依賴 `[entries]`。若 `entries` reference 不變則跳過計算。**正確。**
- **注意**: `entries.map((e) => e.title || '')` 在 useMemo 內，每次都建新陣列傳給 `extractArtKeys`，但這是 O(n) 且在 memo 保護下不會頻繁觸發。OK。

#### Q4: 26 種 SVG 元素的 viewBox 和 slot 定位是否正確？

- **viewBox**: `0 -10 200 100` — 與原 DayHeaderArt 相同。
- **SLOT_X**: `[130, 55, 10]` — 從右到左分佈 3 個元素。在 viewBox 200 寬度下：slot0 佔 x:130-190，slot1 佔 x:55-115，slot2 佔 x:10-70。重疊少，分佈合理。
- **preserveAspectRatio**: `xMidYMid meet` — SVG 會等比縮放到容器大小，居中顯示。與 DestinationArt 的 `slice` 不同（meet 保持完整可見）。
- **容器 style**: `position: absolute; right: 0; top: 0; width: 80%; height: 100%` — 佔據 day-header 右邊 80%，左邊 20% 留給 Day 標題文字。

**潛在問題**: 部分 SVG 元素的座標超出 viewBox。例如 `beach` 的 `<rect x="8" y="24" width="5" height="40">` 在 `translate(x,8)` 下，底部到 y=8+24+40=72。viewBox 是 `0 -10 200 100`（y 範圍 -10 到 90），72 在範圍內。`airport` 的 `scale(1.6)` + `translate` 可能讓飛機尾翼超出左邊界，但 SVG 會 clip，不影響功能。**OK。**

#### Q5: dark mode 色彩切換邏輯？

- 每個 `artElement` case 內部用 `dark ? darkColor : lightColor` 做條件切換。
- Light: 使用飽和色（`#2A8EB0`, `#E86A4A`, `#7A6A56` 等），opacity 0.20-0.30
- Dark: 使用亮色調（`#7EC0E8`, `#F4A08A`, `#D4A88E` 等），opacity 0.10-0.15
- `lo` / `hi` 全域 opacity 在 `artElement` 頂部計算：`dark ? 0.10/0.15 : 0.20/0.30`。
- **正確且一致。** dark mode 降低對比度避免干擾文字可讀性。

### 2. 架構影響評估

| 修改 | 影響範圍 | 評估 |
|------|---------|------|
| 新檔案 dayArtMapping.ts | 無既有程式受影響 | OK |
| 新檔案 DayArt.tsx | 無既有程式受影響 | OK |
| TripPage.tsx DayHeaderArt → DayArt | DaySection 內部 | OK — 介面相容（`themeArt.dark` 傳遞） |
| ThemeArt import 移除 DayHeaderArt | tree-shaking 會移除 | OK |

### 3. 效能影響分析

- **artElement switch-case**: 每次 DayArt render 只執行 1-3 個 case，不建構不需要的 SVG。比 F-1 DestinationArt 的 content map 更高效。**好。**
- **extractArtKeys**: O(K*T) 其中 K=50 個 keyword, T=timeline entries 數量。最多 50*~15=750 次 `includes` 比對。在 `useMemo` 保護下僅在 `entries` 變化時執行。**可忽略。**
- **SVG 元素量**: 每個 art 約 5-15 個 SVG primitive，3 個 art 最多 ~45 個元素。day-header 數量 = day 數量（5-15），總計 ~225-675 SVG 元素。在 scroll 時不 re-render（memo），**無效能問題。**

### 4. 安全性審查

- 無使用者輸入直接渲染。entry titles 來自 API 但只做 `includes()` 比對，不插入 DOM。
- SVG 全部 inline hardcoded。
- **安全。**

### 5. 向後相容

- `DayHeaderArt` 被 `DayArt` 取代。唯一呼叫端 DaySection 已同步更新。
- ThemeArt.tsx 的 `DayHeaderArt` export 保留（dead code），不影響其他 import。
- **無 breaking change。**

### 6. Design Pattern 建議

- `extractArtKeys` 是純函式，exported 且可獨立測試。**好的設計。**
- 建議加入 unit test 以驗證關鍵字映射正確性（尤其是誤觸問題）。

### 7. 技術債標記

| 項目 | 嚴重度 | 說明 |
|------|--------|------|
| ThemeArt.tsx `DayHeaderArt` dead code | LOW | 不再被 import，可安全移除 |
| `DaySectionProps.themeArt.theme` unused in DaySection | LOW | `theme` 僅供 memo key 使用，DayArt 不讀取 |
| `首里城` 映射條目多餘 | TRIVIAL | `城` 已先匹配到 castle，`首里城` 永遠不會被 hit |
| 無 unit test 覆蓋 extractArtKeys | MEDIUM | 應加測試確保誤觸修復後不回歸 |

### 8. 跨模組 side effect

- DayArt 的 `position: absolute; right: 0; top: 0; width: 80%; height: 100%` 是 inline style，不影響其他元素。
- `.day-header` 已有 `position: relative`（style.css L48），為 DayArt 的 absolute 定位提供 containing block。**OK。**

### 9. /tp-code-verify + /tp-ux-verify

#### Code 驗證
- **命名規範**: `dayArtMapping.ts` camelCase 檔名、`ArtKey` PascalCase type、`extractArtKeys` camelCase function、`KEYWORD_MAPPINGS` UPPER_SNAKE constant。全部合規。
- **CSS HIG**: DayArt 使用 inline style（`position: absolute` 等），不新增 CSS class。不違反 HIG（inline style 用於動態/一次性定位是合理的）。
- **React Best Practices**: memo + useMemo 使用正確。`key` prop 在 `artElement` 的 `<g key={key}>` 中正確設定。

#### UX 驗證
- **可及性**: `aria-hidden="true"` 正確。
- **pointer-events: none** — 不攔截使用者互動。OK。
- **day-header 文字可讀性**: DayArt 佔右側 80%，Day 標題在左側。opacity 0.10-0.30 作為背景裝飾，不應干擾標題。但需 QC 截圖驗證。

---

## 重點問題回答

### Q1: extractArtKeys 的 includes 比對是否有誤觸？
**有。** `橋` 誤觸 `板橋` 是 MEDIUM 問題（影響板橋行程整體）。`山` 誤觸 `山佳`、`釜山` 是 LOW 問題。詳見 BUG-1、BUG-2。

### Q2: DayHeaderArt 是否完全被取代？ThemeArt import 清理？
**是。** TripPage 不再 import DayHeaderArt，DayArt 完全取代。ThemeArt.tsx 中 DayHeaderArt 成為 dead code。

### Q3: memo + useMemo 使用正確？
**正確。** DayArt memo 防止 theme-only 變化觸發 re-render。useMemo 在 entries 依賴穩定。

### Q4: 26 種 SVG 元素的 viewBox 和 slot 定位？
**正確。** viewBox `0 -10 200 100` 配合 SLOT_X `[130, 55, 10]` 三欄分佈合理。preserveAspectRatio `xMidYMid meet` 保持完整。

### Q5: dark mode 色彩切換邏輯？
**正確且一致。** lo/hi opacity 全域定義，每個 case 內 dark ternary 切換色彩。dark mode 降低 40-50% opacity。

---

## 裁決

### REQUEST CHANGES

**必修**:
1. **BUG-1** (MEDIUM): `橋` 關鍵字誤觸板橋行程 — 需改為更具體的關鍵字

**建議（不阻擋）**:
- BUG-2: `山` 關鍵字考慮改為更具體的形式（LOW，可後續處理）
- 加入 `extractArtKeys` 的 unit test
- 後續清理 ThemeArt.tsx 中的 `DayHeaderArt` dead code
