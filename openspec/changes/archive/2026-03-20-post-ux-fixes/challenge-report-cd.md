# Challenge Report — Group C + D

## C.1–C.3 ThemeArt SVG（Forest / Sakura / Ocean）

### 2026-03-20 — Challenger: 效能

- **問題**：現有 3 主題（sun/sky/zen）× 4 藝術類型（Header/Divider/Footer/Nav）× 2 模式（light/dark）= 24 個 SVG 元件，ThemeArt.tsx 已達 **20 KB**。新增 3 主題將再加 24 個元件，預估檔案膨脹至 **~40 KB**。所有 SVG 都 inline 在 TSX 中，Vite 會把它們全部打包進 main chunk，即使使用者只選一個主題，其餘 5 主題的 SVG 仍會被下載和解析。
- **嚴重度**：🟡中
- **建議**：考慮按主題拆分為獨立檔案（`ThemeArt.sun.tsx`、`ThemeArt.forest.tsx`...），搭配 `React.lazy()` + `Suspense` 按需載入。或者至少將各主題的 SVG 抽為獨立模組，讓 tree-shaking 和 code splitting 能生效。

### 2026-03-20 — Challenger: 品質

- **問題**：18+ 個手繪 SVG 元件（C.1 Forest + C.2 Sakura + C.3 Ocean，每個需 Header/Divider/Footer × light/dark = 6 個，加上 NavArt 再 +6 = 共 **24 個新元件**）如何保證視覺一致性？目前沒有設計稿或 Figma 參考，全靠程式碼產生。SVG 的色彩、不透明度、比例是否有規範？
- **嚴重度**：🟡中
- **建議**：定義每個主題的色彩 palette 規範（主色、輔色、opacity 範圍），並在 code review 時搭配 Playwright 截圖比對，確保 light/dark 模式下的對比度和辨識度。

### 2026-03-20 — Challenger: 無障礙

- **問題**：所有 ThemeArt 元件已標記 `aria-hidden="true"`，這很好。但新增的 SVG 是否會影響低端裝置的渲染效能？24 個額外的 inline SVG DOM 節點（即使不可見的主題也會被 React 渲染後丟棄）。
- **嚴重度**：🟢低
- **建議**：目前的 Record lookup 模式只渲染選中的主題，不會產生多餘 DOM 節點。確認新主題沿用相同模式即可。

---

## C.4 InfoSheet 高度依內容 max 85%

### 2026-03-20 — Challenger: 程式

- **問題**：目前 InfoSheet 固定 `height: 75dvh`（CSS），任務要求改為「依內容高度，max 85%」。如何測量內容實際高度？
  - 若用 `ResizeObserver` 監聽 `.info-sheet-body`，初始渲染時內容尚未填入，可能先跳到 min-height 再彈到正確高度（**高度閃爍**）。
  - 若用 `max-height: 85dvh` + `height: auto`，需確認 CSS transition 對 `height: auto` 的支援（原生不支援 `auto` 到具體值的 transition）。
  - 拖曳手勢的 `currentStop()` 依賴 `panel.offsetHeight / window.innerHeight` 計算目前停靠點百分比，若高度改為動態，STOPS 數組的意義會改變。
- **嚴重度**：🔴高
- **建議**：
  1. 初始高度用 CSS `min(fit-content, 85dvh)` 搭配 `max-height: 85dvh`，避免 JS 測量。
  2. 開啟動畫改用 `transform: translateY()` 而非 height transition（現有做法已是如此，保持不變）。
  3. 拖曳 STOPS 邏輯需重新設計：動態初始高度 → STOPS 應基於絕對 px 而非固定百分比，或改為「當前高度 ± 步進」模式。

### 2026-03-20 — Challenger: 相容性

- **問題**：`dvh` 單位在 iOS Safari 15.3 以下不支援。目前已使用 `dvh`，但改為依內容高度後，`fit-content` 在 `height` 屬性中的瀏覽器支援需驗證。
- **嚴重度**：🟢低
- **建議**：加 fallback `max-height: 85vh; max-height: 85dvh;`，`fit-content` 有廣泛支援。

---

## C.5 InfoSheet body scroll lock

### 2026-03-20 — Challenger: 相容性

- **問題**：常見的 `document.body.style.overflow = 'hidden'` 在 iOS Safari 有已知問題：
  1. **底層頁面仍可捲動**：iOS Safari 不完全尊重 body overflow hidden，手指在 overlay 區域觸控仍會穿透捲動底層。
  2. **Scrollbar shift**：桌面瀏覽器在 `overflow: hidden` 時 scrollbar 消失，頁面會向右偏移（本專案 `html` 已有 `scrollbar-gutter: stable` 可緩解此問題，但 `overflow: hidden` 可能覆蓋 `scrollbar-gutter` 的效果）。
  3. **捲動位置遺失**：部分實作在設定 `overflow: hidden` 前需記錄 `scrollY`，否則頁面會跳到頂部。
- **嚴重度**：🔴高
- **建議**：
  1. 目前 InfoSheet 的 backdrop 已有 `onTouchMove={preventTouchScroll}` 和 `onWheel={preventWheelScroll}`（行 218-219），實際上已在事件層阻擋了穿透捲動。確認這是否已足夠，再決定是否需要額外的 body overflow lock。
  2. 若仍需 body lock，採用 `position: fixed; top: -${scrollY}px; width: 100%` 模式（iOS Safari 標準解法），關閉時恢復 scrollY。
  3. 需確認 `scrollbar-gutter: stable` 與 `overflow: hidden` 的交互：根據 CSS spec，`scrollbar-gutter` 在 `overflow: hidden` 時仍應保留 gutter 空間，但需實機驗證。

### 2026-03-20 — Challenger: 程式

- **問題**：InfoSheet 目前的 backdrop `onTouchMove` + `onWheel` 已經阻擋了大部分穿透捲動。那 C.5 的 scroll lock 是否重複？需釐清：現有方案在哪些情境下仍會穿透？
- **嚴重度**：🟡中
- **建議**：先用 QC 的 Playwright 測試確認現有 backdrop 事件攔截是否足夠，再決定是否需要實作 body scroll lock。避免過度工程。

---

## C.6 InfoSheet 手勢整合（內容到頂 → 縮小 panel）

### 2026-03-20 — Challenger: 程式

- **問題**：判斷「內容已到頂」的時機有 race condition 風險：
  1. `scrollTop === 0` 時使用者繼續下拉 → 應切換為「縮小 panel」手勢。但 `scrollTop` 的更新與 touchmove 事件不同步，可能在慣性捲動中誤判。
  2. 手指方向判斷：快速來回滑動時，如何區分「內容捲動中的慣性回彈」vs「使用者主動下拉要縮小 panel」？
  3. 現有手勢只在 `.sheet-handle` 和 `.sheet-header` 上監聽（行 235-237, 243-245），body 區域的 touch 事件只有 `stopPropagation`（行 183-185）。要整合「內容到頂 → 縮小 panel」需在 body 區域也加 touchstart/move/end 監聽，但不能干擾正常的內容捲動。
  4. **iOS rubber-band scrolling**：iOS Safari 在 scrollTop === 0 時繼續下拉會觸發 rubber-band 效果，此時 scrollTop 可能為負值或仍為 0，需要特別處理。
- **嚴重度**：🔴高
- **建議**：
  1. 在 body 的 `onTouchStart` 記錄 `initialScrollTop`。
  2. 在 `onTouchMove` 中：若 `initialScrollTop === 0` 且手指方向為向下（deltaY > 0），切換為 panel resize 模式，呼叫 `e.preventDefault()` 阻止原生捲動。
  3. 需設定明確的「切換閾值」（如向下移動 > 10px 才切換），避免誤觸。
  4. 考慮使用 `{ passive: false }` 的 touch listener 才能呼叫 `preventDefault()`，但這會影響捲動效能。需權衡。

### 2026-03-20 — Challenger: UX 設計

- **問題**：「到底 → 放大 panel」的操作直覺性存疑。使用者捲到底部時，繼續向上滑的預期行為是「繼續嘗試捲動」而非「放大 panel」。這個手勢可能造成困惑。
- **嚴重度**：🟡中
- **建議**：僅實作「到頂 → 縮小/關閉」（這符合 iOS 原生 sheet 行為），「到底 → 放大」可延後或取消。如果要保留，需加明確的視覺反饋（如 panel 邊框 glow 或 handle 動畫）提示使用者正在調整大小。

---

## D.1 Sticky nav 提高背景不透明度

### 2026-03-20 — Challenger: 品質

- **問題**：任務標註「需實機驗證」，但沒有具體的目標不透明度值或驗收標準。在不同主題 × light/dark 下，需要的不透明度可能不同。
- **嚴重度**：🟢低
- **建議**：定義具體的目標值（如 `backdrop-filter` 強度或 `background-color` alpha 值），並在 6 主題 × 2 模式 = 12 種組合下都通過 Playwright 截圖驗證。

---

## D.2 Sentry CSP connect-src 加 ingest domain

### 2026-03-20 — Challenger: 資安

- **問題**：
  1. CSP 分散在 **4 個 HTML 檔案**（index.html、setting.html、manage/index.html、admin/index.html）的 `<meta>` 標籤中，各自維護。修改 connect-src 時必須同步更新所有 4 個檔案，遺漏任一個都會導致該頁面的 Sentry 失效。
  2. 目前 `VITE_SENTRY_DSN` 尚未設定（`sentry.ts` 行 6 被註解），Sentry 實際上未啟用。在 DSN 確定前加 CSP 規則是否有意義？
  3. Sentry SDK 除了 `connect-src`（XHR/fetch 傳送事件），還可能需要 `script-src`（若啟用 session replay 或 loader script）和 `worker-src`（若使用 web worker 傳送）。目前 `tracesSampleRate: 0.1` + 無 replay，應該只需 `connect-src`，但未來擴充時可能再次踩到 CSP。
- **嚴重度**：🟡中
- **建議**：
  1. 將 CSP 集中管理：要嘛用 Cloudflare Pages 的 `_headers` 檔案統一設定（優先於 `<meta>`），要嘛抽為 build-time 變數由 Vite 注入。目前 4 個 HTML 各自 hardcode 是維護地雷。
  2. 確認 Sentry DSN 的 ingest domain 格式（通常是 `https://*.ingest.sentry.io` 或 `https://*.ingest.us.sentry.io`），避免用太寬鬆的 wildcard。
  3. 暫時不加 CSP 規則，等 DSN 確定後再一併處理。或先加上被註解的備註，提醒日後 DSN 啟用時需更新 CSP。

### 2026-03-20 — Challenger: 成本

- **問題**：Sentry 免費方案的 quota 限制（5K errors/月、10K transactions/月）。`tracesSampleRate: 0.1` 在流量增加時是否足以控制在 quota 內？
- **嚴重度**：🟢低
- **建議**：在 Sentry 正式啟用前評估預期流量，必要時降低 `tracesSampleRate` 或設定 `beforeSend` filter。

---

## 總結

| 項目 | 🔴 高 | 🟡 中 | 🟢 低 |
|------|:-----:|:-----:|:-----:|
| C.1–C.3 ThemeArt SVG | — | 2 | 1 |
| C.4 InfoSheet 動態高度 | 1 | — | 1 |
| C.5 InfoSheet scroll lock | 1 | 1 | — |
| C.6 InfoSheet 手勢整合 | 1 | 1 | — |
| D.1 Sticky nav 不透明度 | — | — | 1 |
| D.2 Sentry CSP | — | 1 | 1 |
| **合計** | **3** | **5** | **4** |

**3 項 🔴 高嚴重度問題**需要在實作前釐清方案：
1. **C.4** — 動態高度與拖曳 STOPS 邏輯的衝突
2. **C.5** — iOS Safari body scroll lock 的已知陷阱
3. **C.6** — 內容捲動 vs panel resize 手勢的 race condition
