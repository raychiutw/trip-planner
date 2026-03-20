# Challenger Report — F-2 DayArt

> Date: 2026-03-20
> Based on: QC report (6/6 PASS), Reviewer report (BUG-1/BUG-2 fixed)
> Code reviewed: DayArt.tsx (407 lines), dayArtMapping.ts (119 lines)
> Visual verification: Playwright on localhost:3000

---

## 重點質疑

### Q1. 每天的 SVG 裝飾是否跟行程有關聯感？還是看起來隨機？
**🟢 PASS — 有明確關聯**

`extractArtKeys()` 從 entry titles 中提取關鍵字，透過 `KEYWORD_MAPPINGS` 對應到 art key。QC 驗證 5 天全部主題相符：

| Day | 區域 | 匹配的 art keys | 關聯性 |
|-----|------|----------------|--------|
| 1 | 北谷 | shopping + airport + rental | 美國村購物 + 抵達機場 + 取車 |
| 2 | 浮潛・瀨底 | snorkel + island + beach | 浮潛 + 瀨底島 + 海灘 |
| 3 | 水族館・古宇利 | aquarium + island + bridge | 水族館 + 古宇利島 + 大橋 |
| 4 | 來客夢 | shopping + rental + onsen | 來客夢購物 + 自駕 + 溫泉 |
| 5 | 首里城 | castle + airport + train | 首里城 + 回程機場 + 單軌 |

每天 3 個 art elements（`limit = 3`），且由 `KEYWORD_MAPPINGS` 的優先順序決定（water activities > culture > shopping > transport > nature > accommodation）。這保證了每天的 DayArt 反映該日最具特色的活動，而非隨機。

截圖：`ch-dayart-d1.png`

### Q2. 26 種 SVG 元素的藝術品質？
**🟢 PASS — 品質一致且風格統一**

26 種 art element（含 default 指南針）均使用：
- 統一的色彩系統：light/dark 各一套，5 個主色（`#2A8EB0` 海藍、`#E86A4A` 珊瑚、`#7A6A56` 棕、`#4A8C5C` 綠、`#FFD080` 金）
- 兩檔 opacity：`lo`（light 0.20 / dark 0.10）和 `hi`（light 0.30 / dark 0.15）
- 風格統一的簡筆線條插畫：幾何形狀（rect, circle, ellipse）+ 路徑曲線
- 合理的 viewBox 定位：3 個 slot position（x=130, 55, 10）從右到左排列

每個 SVG 元素平均 5-10 個 SVG primitive，視覺複雜度適中。代表性元素品質評估：
- `snorkel`：潛水鏡 + 呼吸管 + 珊瑚 — 辨識度高
- `aquarium`：鯨鯊 + 小魚 — 辨識度高
- `castle`：城堡輪廓 + 屋頂層疊 — 辨識度中（較抽象）
- `nightmarket`：燈籠 + dark mode 發光效果 — 辨識度高且有創意
- `default`（指南針）：簡潔實用的 fallback

### Q3. extractArtKeys 的 includes 比對修正後是否還有誤觸風險？
**🟡 MEDIUM — 有 2 個潛在誤觸，但實務影響低**

`extractArtKeys` 使用 `title.includes(keyword)` 做子字串匹配。已知的潛在誤觸：

| keyword | 預期匹配 | 可能誤觸 | 風險 |
|---------|---------|---------|------|
| `'湯'` | 溫泉/温泉の湯 | 味噌湯、拉麵湯頭 | LOW — 餐廳名稱中「湯」字少見於 entry title |
| `'塔'` | 東京塔、燈塔 | 不太可能誤觸 | VERY LOW |
| `'城'` | 首里城、大阪城 | 城市、城堡 | LOW — 現有行程 title 中不含「城市」 |
| `'島'` | 瀨底島、古宇利島 | 理論上無 | NONE — 已有 `古宇利` 和 `瀨底` 精確匹配在前 |

**板橋行程的 `橋` 誤觸已修正**：BUG-2 將 `'橋'` 改為精確匹配 `'大橋'`、`'新月橋'`、`'古橋'`、`'Bridge'`，避免「板橋」誤觸 bridge art。QC 確認板橋 Day 1 顯示指南針（default）而非橋。

**結論**：`'湯'` 是最可能的誤觸源，但因為 `KEYWORD_MAPPINGS` 有優先順序（`溫泉` 在 `湯` 前面，且 `湯` 在列表較後），實務上不太可能被錯誤觸發。如果未來新增京都行程含「湯豆腐」等 title，才需要注意。

### Q4. DayArt + DestinationArt 兩層背景是否衝突？
**🟢 PASS — 空間分離，不衝突**

兩者的 DOM 位置和視覺範圍完全分離：

| 特性 | DestinationArt | DayArt |
|------|---------------|--------|
| 父容器 | `.sticky-nav` | `.day-header` |
| 位置 | 固定在 nav bar 頂部 | 在每天的 day header 區塊 |
| viewBox | `0 0 480 48`（扁長） | `0 -10 200 100`（正方偏） |
| 覆蓋範圍 | `inset: 0`（全 nav） | `right: 0; width: 80%`（右側 80%） |
| preserveAspectRatio | `xMidYMid slice` | `xMidYMid meet` |
| z-index | 0（nav 內） | 無（day-header 內） |

DestinationArt 在 sticky-nav 中，DayArt 在 day-header 中。兩者在不同的 DOM 層級，視覺上不重疊（nav 在頁面最頂部，day-header 在內容區）。

唯一可能的「視覺重疊」發生在捲動時 — sticky-nav 浮在 day-header 上方。但 DestinationArt opacity 0.15-0.35 + DayArt opacity 0.10-0.30，兩者都極淡，即使視覺上有重疊也不會產生「太花」的感覺。

---

## 其他視角

### V5. DayArt 在 Day Header 中的定位
**🟢 PASS**

- `position: absolute; right: 0; top: 0; width: 80%; height: 100%` — 靠右定位，留出左側 20% 給 "Day X 區域名" 標題
- `pointer-events: none; aria-hidden: true` — 不影響互動和可及性
- 截圖確認標題文字不被 SVG 遮擋

### V6. memo + useMemo 效能
**🟢 PASS**

- `DayArt` 用 `memo` 包裹，依賴 `entries` 和 `dark`
- `artKeys` 用 `useMemo` 快取，依賴 `[entries]`
- `extractArtKeys` 是 O(mappings * titles)，約 96 * 7 = 672 次比較，微乎其微

### V7. Dark mode opacity 降低
**🟢 PASS**

- `lo`: 0.20 → 0.10（-50%）
- `hi`: 0.30 → 0.15（-50%）
- 部分元素有額外 dark mode 效果（如 `nightmarket` 的燈籠發光 glow circle）

### V8. Default fallback
**🟢 PASS**

- 當沒有任何 keyword 匹配時，回傳 `['default']`（指南針圖案）
- 板橋行程的通用天已確認 fallback 到指南針

### V9. 型別安全
**🟢 PASS**

- `ArtKey` 為 string literal union type，26 種 + `'default'`
- `artElement` 的 switch 覆蓋所有 case + default fallback
- `extractArtKeys` 回傳 `ArtKey[]`

### V10. 跨行程差異
**🟢 PASS**

QC 確認沖繩 Day 1 vs 釜山 Day 1 的 SVG 路徑完全不同。因為 `extractArtKeys` 依賴各行程的 entry titles，不同行程自然產生不同的 art keys。

### V11. 320px 小手機
**🟢 PASS**

DayArt 使用 `width: 80%` 相對寬度，不會超出容器。`preserveAspectRatio="xMidYMid meet"` 確保 SVG 縮放不變形。

---

## 總結

| 視角 | 結果 | 說明 |
|------|------|------|
| Q1 行程關聯感 | 🟢 PASS | keyword 匹配 + 優先順序，5 天全部主題相符 |
| Q2 SVG 藝術品質 | 🟢 PASS | 26 種統一風格，複雜度適中 |
| Q3 includes 誤觸 | 🟡 MEDIUM | `'湯'` 有風險但實務影響低，`橋` 已修正 |
| Q4 兩層背景衝突 | 🟢 PASS | 空間完全分離（nav vs day-header） |
| V5-V11 | 🟢 全 PASS | 定位、效能、dark mode、fallback、型別安全 |

**APPROVE — F-2 DayArt 通過質疑。10 PASS / 1 MEDIUM（非阻擋）。**
