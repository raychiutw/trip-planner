# Challenger Report — F-1 DestinationArt

> Date: 2026-03-20
> Based on: QC report (5 PASS / 1 FAIL), Reviewer report (REQUEST CHANGES -> BUG-1 fixed)
> Visual verification: Playwright on localhost:3000, viewports 390x844
> Trips tested: okinawa-trip-2026-Ray, busan-trip-2026-CeliaDemyKathy

---

## 11 視角質疑

### V1. DestinationArt 在不同行程是否有足夠差異感？
**🟢 PASS**

實測兩個不同目的地的 SVG 結構：

| 目的地 | SVG 子元素數 | 主要元素 | opacity 範圍 |
|--------|------------|---------|-------------|
| Okinawa | 6 | 波浪路徑(2) + 太陽/島嶼(4 groups) | 0.15-0.35 |
| Busan | 4 | 幾何線條(1 line group) + 波形(1 path) + 裝飾(2 groups) | 0.12-0.20 |

- Okinawa：海洋主題（波浪 + 圓形太陽 + 船帆），顏色偏藍綠 `#2A8EB0`/`#40C0D8`
- Busan：城市幾何主題（直線 + 不同波形），顏色偏藍 `#2870A0`/`#2A8EB0`

截圖目視：兩者在 DayNav 背景中有明顯不同的紋理感。沖繩偏流動（曲線波浪），釜山偏幾何（直線+曲線混合）。

Reviewer 確認 7 個行程全部有對應目的地主題（4 okinawa + 1 busan + 1 kyoto + 1 banqiao）。

截圖：`ch-okinawa-light.png`、`ch-busan-light.png`

### V2. SVG 背景有沒有影響 DayNav 可讀性？
**🟢 PASS**

z-index 分層正確：
- `.destination-art` → `z-index: 0; pointer-events: none`
- `.sticky-nav > :not(.destination-art)` → `position: relative; z-index: 1`

DayNav pills 在 SVG 之上（z-index 1 > 0）。截圖目視：pill 文字（7/29、7/30 等）在所有測試情境下清晰可讀。SVG 作為淡色裝飾背景不干擾前景互動元素。

`aria-hidden="true"` + `pointer-events: none` 確保 SVG 不影響可及性和互動。

### V3. Okinawa opacity 0.35 是否太高？
**🟡 LOW — 可接受但值得留意**

Okinawa 的波浪路徑 `<path>` 使用 opacity 0.35，是所有目的地中最高值。

實測對比：
| 元素 | Okinawa Light | Okinawa Dark | Busan Light |
|------|-------------|-------------|-------------|
| 最高 opacity | 0.35（波浪） | 0.20（波浪） | 0.20（波形） |
| 最低 opacity | 0.15 | 0.08 | 0.12 |

截圖目視：在 Sunshine 主題（暖色調）的淺色背景上，0.35 的藍色波浪是隱約可見但不搶眼的。在 Deep Ocean 主題（冷色調）的淺色背景上可能稍微明顯一些，因為 SVG 顏色 `#2A8EB0` 與主題色接近。

**但不構成功能問題** — DayNav pill 的背景填色和文字對比度仍然足夠。如果未來使用者反映 DayNav 背景太花，可考慮將 0.35 降至 0.25。

### V4. dark mode 下 SVG 是否正確降低 opacity？
**🟢 PASS — QC 的 FAIL 為 false positive**

**QC FAIL 原因**：QC 手動設定 `data-theme="dark"` 屬性，但 app 的 dark mode 是透過設定頁切換，添加 `body.dark` class。

**我的驗證方法**：透過設定頁 → 深色 Dark → 回到行程頁。

**實測結果**：
- `body.dark` class 已正確套用
- SVG opacity 成功從 light 值降低到 dark 值：

| 元素 | Light opacity | Dark opacity | 降幅 |
|------|-------------|-------------|------|
| 波浪 path 1 | 0.35 | 0.20 | -43% |
| 波浪 path 2 | 0.20 | (merged) | — |
| Group 1 | 0.18 | 0.10 | -44% |
| Group 2 | 0.15 | 0.08 | -47% |
| Group 3 | 0.18 | 0.10 | -44% |
| Group 4 | 0.15 | 0.12/0.15 | -20% |

Dark mode 整體降低 opacity 約 40-47%，與 Reviewer 預期（40-60%）一致。截圖確認深色背景上 SVG 幾乎不可見，僅有極淡的裝飾效果。

截圖：`ch-okinawa-dark.png`

### V5. sticky-nav 修復後是否正常？
**🟢 PASS**

- BUG-1（`position: relative` 覆蓋 `position: sticky`）已修復
- 實測 `getComputedStyle(.sticky-nav).position === 'sticky'`
- `top: 0px` 確保固定在頂部
- QC 捲動測試確認 `stickyRect.y = 0`

### V6. SVG viewBox + preserveAspectRatio 是否正確？
**🟢 PASS**

`viewBox="0 0 480 48"` + `preserveAspectRatio="xMidYMid slice"`：
- 480:48 比例近似 10:1，適合窄長的 nav bar
- `slice` 確保 SVG 填滿容器寬度，多餘高度裁切
- `width: 100%; height: 100%` + `.destination-art { inset: 0 }` 完整覆蓋

### V7. 7 個行程 tripId mapping 完整性
**🟢 PASS**

Reviewer 逐一確認：
- `okinawa` prefix → 4 個行程（Ray, HuiYun, RayHus, AeronAn）
- `busan` prefix → 1 個行程（CeliaDemyKathy）
- `kyoto` prefix → 1 個行程（MimiChu）
- `banqiao` prefix → 1 個行程（Onion）
- `resolveDestination` 使用 `startsWith` 匹配，全部 7 個行程涵蓋

### V8. SVG 顏色不隨主題變化
**🟡 LOW — by design 但需文件記錄**

SVG 使用 hardcoded fill/stroke 顏色（如 `#2A8EB0`），不引用 CSS `var()`。因此：
- 6 個色彩主題（Sunshine/Clear Sky/Japanese Zen/Deep Forest/Cherry Blossom/Deep Ocean）下 SVG 顏色相同
- 只有 light/dark 兩套 SVG

Reviewer 確認這是 by design（SVG inline 無法直接引用 CSS variable），但建議未來新增主題時注意。對於 Cherry Blossom 這種粉色系主題，藍色 SVG 可能與主題色調略有衝突，但因 opacity 極低，影響微乎其微。

### V9. 可及性
**🟢 PASS**

- `aria-hidden="true"` — 裝飾性內容不被 screen reader 讀取
- `pointer-events: none` — 不攔截使用者互動
- mask-image 邊緣漸層讓 SVG 兩側自然淡出

### V10. 效能
**🟢 PASS**

- `memo()` 包裹，只在 `tripId`/`dark` 變化時 re-render
- SVG 約 30-50 個元素，極輕量
- Reviewer 標記 `content` map 每次 render 建構 10 個 JSX node（LOW），但因 memo 保護無實質影響

### V11. 320px 小手機
**🟢 PASS**

QC 實測：
- `destArtRect: x=0, y=0, w=310, h=76, overflowsRight=false`
- SVG 完整在 sticky-nav 範圍內，無溢出

---

## 總結

| 視角 | 結果 | 說明 |
|------|------|------|
| V1 不同行程差異感 | 🟢 PASS | Okinawa 海洋 vs Busan 幾何，明顯不同 |
| V2 DayNav 可讀性 | 🟢 PASS | z-index 分層正確，pill 文字清晰 |
| V3 Okinawa 0.35 opacity | 🟡 LOW | 最高但不搶眼，可接受 |
| V4 dark mode SVG | 🟢 PASS | opacity 降低 40-47%，QC FAIL 為 false positive |
| V5 sticky-nav 修復 | 🟢 PASS | BUG-1 已修復，position: sticky 正確 |
| V6 viewBox 配合 | 🟢 PASS | xMidYMid slice 正確填滿 |
| V7 tripId mapping | 🟢 PASS | 7 個行程全覆蓋 |
| V8 SVG 不隨主題變 | 🟡 LOW | by design，opacity 低影響小 |
| V9 可及性 | 🟢 PASS | aria-hidden + pointer-events: none |
| V10 效能 | 🟢 PASS | memo + 輕量 SVG |
| V11 320px 小手機 | 🟢 PASS | 無溢出 |

**9 PASS / 2 LOW（非阻擋）**

**APPROVE — F-1 DestinationArt 通過質疑。**
