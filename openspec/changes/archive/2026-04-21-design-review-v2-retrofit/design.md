## 動機

Design review v1（2026-03）對 Tripline 的評分較為保守。使用者回饋「字體太小、FAB 操作不直覺、FAB 與功能頁風格與主風格不一致」，要求以更嚴格的挑戰者視角重新稽核。

Design review v2（`design-audit-v2-strict.md`，2026-04-21）以量測為基礎，發現：Design Score 從 B+ 降至 C+，Typography D，Material consistency D。核心問題是：「一個 desktop 版做得很好的 editorial 行程頁，硬塞進 mobile 後變成 3 層導航 + 3 種 glass + 非 token 字級的混血體」。

本 change 基於 10 問 + 4 個補充問題的決策，分 3 個 PR 循序解決。

---

## 關鍵決策

### Q1：刪 desktop sidebar？
**選項**：A 刪 sidebar + 右欄換 sticky map rail / B 保留 sidebar / C 各自設計

**用戶選 A**：刪 sidebar（progress / 今日行程 / 住宿三張小卡），右欄改 `TripMapRail` sticky Leaflet 地圖。

**理由**：editorial direction 認 sidebar 三張卡片是 chrome 而非核心內容；全行程地圖在桌機 ≥1024px 永遠可見，比三張卡片提供更高價值的空間感知。test：把 sidebar 刪掉，mobile 版 IA 依舊完整可用，驗證 sidebar 確實是多餘的。

**Trade-off**：「今日路線 / AI 建議 / 航班」三個 sheet 入口在 desktop 暫時消失（PR 1 tech debt），需在 PR 3 的 `OverflowMenu` 補回。

---

### Q2：Mobile type scale
**選項**：A 在 DESIGN.md 加 mobile column + token override / B 縮小整體 / C 整體放大對齊 DESIGN.md token

**用戶選 C**：整體放大對齊 DESIGN.md 現有 token，DESIGN.md 新增 `## Type Scale (Mobile ≤760px)` section 明確化。

**理由**：選 A 需要整套 token 重新定義；選 C 是最小工：直接修 `em` 繼承問題、改整數 px、對齊現有 token，再補文件。760px 斷點刻意設在 iPad mini portrait (744px) 以下，tablet ≥768px 維持 desktop scale。

**Trade-off**：mobile 字型放大後部分 eyebrow label 佔用更多行高，需確認 DayNav pill 等間距是否被撐開。

---

### Q3：MobileBottomNav 5→？tab
**選項**：A 砍掉 bottom nav / B 4-tab route-based / C 其他

**用戶選 B**：4 tab route-based，`行程 / 地圖 / 訊息 / 更多`。

**理由**：選 A 過激，失去 mobile 快速導航能力；選 B 保留 tab bar 同時解決「5 種行為混血」問題，每個 tab 對應獨立路由，符合 iOS HIG 原則。

**Trade-off**：新增 `/trip/:id/map` route（地圖 tab 的目的地），需確保 active 判斷 regex 嚴格，不誤觸 `/manage/map-xxx` 路徑。

---

### Q4：InfoSheet default
**選項**：A 預設關閉 / B peek 88px / C 維持現狀

**用戶選 A**：預設關閉。

**理由**：使用者開啟行程頁，第一眼應該是行程內容，不是 75% viewport 的 sheet。選 A 是最保守、最直接的修法；選 B（peek 88px）需要 InfoSheet 支援多 detent，有架構成本且 peek 高度需協商。

**Trade-off**：使用者需要主動觸發才能看到「今日快覽」sheet；如果 sheet 內容是高價值資訊，可後續考慮 peek 模式。

---

### Q5：Icon edit/menu 缺
**選項**：A 是 bug，補 icon / B 是 design

**用戶選 A**：是 bug，補 icon。

**理由**：DESIGN.md 沒有「某些 tab 不需要 icon」的明文規定；5 tab 中 3 個有 icon+label、2 個只有 label，視覺高度不均是明確的視覺 bug，不是設計意圖。

**技術細節**：`edit` SVG = 鉛筆形（斜 45° 菱形頭 + 長柄 + 底線），stroke 1.75px；`menu` SVG = 三條橫線（y: 6/12/18），stroke 1.75px，對齊 DESIGN.md icon grid。

---

### Q6：AI pill accent
**選項**：A 接受 AI 專用色，加 DESIGN.md 條文 / B 改 Ocean fill pill

**用戶選 B**：改 Ocean fill pill。

**理由**：cyan `#48CAE4` 是 DESIGN.md 的 dark-mode accent，在 light-mode 下使用是跨模式語彙混用；DESIGN.md 核心原則「單一 Ocean accent」選項 B 直接回歸，比選項 A（加例外條文）更乾淨。

**Trade-off**：AI 功能不再視覺「特殊化」，使用者可能較難第一眼識別。未來若需要 AI 強調，可考慮 icon 差異化（星星 / 閃電 icon）而非用色。

---

### Q7：Glass blur 統一
**選項**：A 統一 14px / B 各自保留

**用戶選 A**：統一 14px。

**理由**：DESIGN.md Material section 只定義 topbar blur 14px，bottom nav 12px 和 sheet 28px 都是各 component PR 自行發明的無 token 強度。統一 14px 加單一 `--blur-glass` token 是「回歸設計系統原則」的最直接做法。

**技術細節**：sheet `saturate(1.8)` 同步移除；sheet bg opacity 88%→94% 以維持邊緣可見度。

---

### Q8：AdminPage × 按鈕
**選項**：A 拿掉 ×，改 TriplineLogo 成 Link / B 改成 `<` back

**用戶選 A**：拿掉 ×，TriplineLogo 改 `<Link to="/">`。

**理由**：`/admin` 是獨立路由，× 按鈕暗示「這是 modal」，mental model 錯亂。選 A 最乾淨：`PageNav.onClose` 改 optional，standalone page 省略即可；所有頁面左上 logo 統一可點回首頁（對齊 Airbnb / NYTimes editorial 慣例）。

**Trade-off**：使用者習慣按 × 關閉，改成 logo 點擊需要一點學習成本。

---

### Q9：Topbar dead tabs
**選項**：A 連到正確 route / B 視覺 disabled / C 砍掉

**用戶選 C**：砍掉。

**理由**：「路線 / 航班 / AI 建議」三個 tab 在 router 無對應 route，是視覺 affordance 有但 behavioral 未定義的「謊言 UI」。選 C 最乾淨；這三個功能的入口在 bottom nav（手機）或 OverflowMenu（桌機）都有。

---

### Q10：產品方向（讀 vs 做）
**選項**：A 讀為主 editorial / B 做為主 AI editor

**用戶原選 B，後改回 A**：讀為主 editorial。

**理由**：DESIGN.md 定義「旅伴可以瀏覽精美行程表」，讀是核心使用者行為。現有 editorial 排版（大 hero / 時間軸 / 優雅字型）都是讀優化的設計，若改為做優化需要大量 IA 重構。維持 A 讓現有設計系統更有一致性。

**Trade-off**：AI 編輯功能不被弱化，但在 UI 層級降低（不占 topbar 最高優先級），作為 `/manage` 聊天頁功能保留。

---

### Q-A：inline day map 去留
**選項**：A 刪 + 加「看地圖」chip / B 保留

**用戶選 A**：刪 inline day map，加「看地圖」chip。

**理由**：每天嵌一張 OceanMap 佔用大量垂直空間，且全行程地圖由桌機 map rail + 行動端 map tab 承擔，inline 小地圖是重複且低解析度的；「看地圖」chip 提供明確的 CTA，導到 MapPage 的當天 fitBounds 視圖，體驗更好。

---

### Q-B：10 色 palette 來源
**選項**：A 自定義 hex palette / B 語義色延伸 / C Tailwind -500

**用戶選 C**：Tailwind -500。

**理由**：選 C 的 10 色（sky / teal / amber / rose / violet / lime / orange / cyan / fuchsia / emerald）是 Tailwind v4 已有的語義色，直接使用不需維護 custom palette；這 10 色在 Data Visualization 例外允許的範圍內，UI chrome 仍嚴守 Ocean。

**技術細節**（hex 對照）：
| day | 色名 | hex |
|-----|------|-----|
| 1 | sky-500 | #0ea5e9 |
| 2 | teal-500 | #14b8a6 |
| 3 | amber-500 | #f59e0b |
| 4 | rose-500 | #f43f5e |
| 5 | violet-500 | #8b5cf6 |
| 6 | lime-500 | #84cc16 |
| 7 | orange-500 | #f97316 |
| 8 | cyan-500 | #06b6d4 |
| 9 | fuchsia-500 | #d946ef |
| 10 | emerald-500 | #10b981 |

超過 10 天 modulo wrap（`dayIndex % 10`）；day 0/負數/NaN/Infinity fallback 到 day 1 色（sky-500）。

---

### Q-C：左欄寬
**選項**：A `clamp(375px, 30vw, 400px)` / B 固定 400px / C 其他

**用戶選 A**：`clamp(375px, 30vw, 400px)`。

**理由**：clamp 讓左欄在中介螢幕（如 1024~1333px）適度縮窄，避免右欄（map rail）太小；1333px 以上固定 400px 提供穩定的閱讀寬度。375px 下限對齊 iPhone 標準視口，確保小螢幕不被壓爆。

---

### Q-D：2-col 斷點
**選項**：1 ≥1024px 單斷點 / 2 多斷點（768 / 1024 / 1440）

**用戶選 1**：≥1024px 單斷點。

**理由**：iPad Pro 13" portrait = 1024px，是最小的「桌機感」螢幕；iPad 11" portrait（812/820px）直接走 mobile single-column + map tab 全畫面，體驗更好。多斷點增加 CSS 複雜度，現階段無必要。

---

## 未選的替代（主要決策說明）

**Q1 未選 C（各自設計）**：sidebar 內容（progress / 今日 / 住宿）如果是「核心內容」應直接在 main timeline 呈現，如果是「chrome」就直接刪。C 選項會讓 desktop 與 mobile 維護兩套 IA，長期成本高。

**Q-B 未選 A（自定義 palette）**：自定義 hex 需要維護、文件化、與設計師同步，而 Tailwind -500 已是共識色，直接使用零維護成本。

**Q2 未選 A（完整 token override）**：選 A 需要在 tokens.css 對每個 token 都定義 `@media (max-width: 760px)` 版本，工作量是選 C 的 3-5 倍，且視覺效果差異有限（mobile body 仍然 16px）。

---

## 技術細節補充

- **`clamp(375px, 30vw, 400px)`**：CSS `grid-template-columns: clamp(375px, 30vw, 400px) 1fr` 左行程右 map rail。
- **Glass token**：`--blur-glass: 14px` in tokens.css；所有 backdrop-filter 改 `blur(var(--blur-glass))`。
- **Mobile type scale 斷點**：`@media (max-width: 760px)`，刻意在 iPad mini portrait (744px) 下、iPad 10/11 portrait (810/820px) 下，所有 tablet ≥768px 維持 desktop scale。
- **Day palette modulo**：`dayColor(n)` → `PALETTE[(n - 1 + PALETTE.length) % PALETTE.length]`；n ≤ 0 / NaN / Infinity fallback index 0（sky-500）。
- **Bottom nav active regex**：地圖 tab active = `/\/trip\/[^/]+\/map/`，嚴格比對，不誤觸 `/manage/map-xxx`。
- **TripMapRail 高度**：`calc(100dvh - var(--nav-h))`，map rail 跟隨 viewport 高度，左欄 scroll 時地圖固定不動。
