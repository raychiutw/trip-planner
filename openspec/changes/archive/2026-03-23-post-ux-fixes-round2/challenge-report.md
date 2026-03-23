# UX 修復第二輪 — Challenge Report

**日期**: 2026-03-20
**Challenger 對象**: proposal.md + tasks.md（22 項修改）

---

## Bug 修復（#1-#5）

### 2026-03-20 — Challenger: 💻 程式 + 📋 需求

#### #1 ThemeArt content map 修正

- **問題**: Proposal 描述為「content map lookup 問題」，但 ThemeArt.tsx 的 content map 實際上是正確的。`DayHeaderArt` (L344) 用 `` `${theme}-${dark ? 'dark' : 'light'}` `` 組合 key，而 `ColorTheme` 型別只有 `sun | sky | zen | forest | sakura | ocean` 六個值，對應 content map 的 12 個 key 完全匹配。**根因不明確**。第一輪 challenge-live-report 記載「KU-1 ThemeArt 6 主題共用同一 SVG」，但程式碼中每個主題都有獨立的 SVG 元件。可能是：(a) worktree 沒合併導致 build 產物過時；(b) runtime 傳入的 `theme` 值不在預期範圍（例如 class 名稱 `theme-sun` 而非 `sun`）；(c) 純粹是 build cache 問題。若沒有明確的 repro 步驟，工程師可能無從修起。
- **嚴重度**: 🔴
- **建議**: 先在線上版 console 執行 `document.body.className` 確認傳入 ThemeArt 的 theme 值是否正確。若 key 完全匹配，則問題可能是 build 產物未更新（需重新 deploy），不是程式碼 bug。務必在 tasks.md 加入「先確認根因再修」的步驟。

#### #2 FAB trigger 改回 hardcoded SVG

- **問題**: 改回 hardcoded SVG 是正確方向（`expand_less` 不在 Icon registry 是已知 regression）。但 tasks 只說「改回 hardcoded SVG 三角形」，沒指定 path data。上一輪的原始 path 是 `<path d="M12 8l-6 6h12z" />`（三角形指向上方），需確認這個 path 在 viewBox 內渲染正確。
- **嚴重度**: 🟢
- **建議**: 直接使用原始 `<path d="M12 8l-6 6h12z" />` + `viewBox="0 0 24 24"` + `fill="currentColor"`。

#### #3 出發確認 SpeedDial 缺 icon

- **問題**: `DIAL_ITEMS` 中 checklist 的 icon 為 `'checklist'`。需確認 `Icon.tsx` 的 ICONS 物件是否有 `checklist` 這個 key。若沒有，會跟 #2 一樣 return null。
- **嚴重度**: 🟡
- **建議**: 工程師修復前先列出所有 DIAL_ITEMS 的 icon name，逐一比對 Icon registry，一次修完所有缺失的 icon。

#### #4 DayNav active label 看不到

- **問題**: `dn-active-label` (style.css L117-129) 用 `position: absolute` + `top: calc(100% + 4px)` 定位在 pill 下方。`.dh-nav` 設了 `overflow-x: auto`（L54），但 `overflow-y` 未明確設定（默認 auto → 因 overflow-x 為 auto 而變成 auto）。label 位於 pill 下方、超出 `.dh-nav` 區域，會被 `overflow: auto` 裁切。第三輪 engineer 已修復過（task #21），但 round2 proposal 又列為問題，**是否代表修復無效或被覆蓋？**
- **嚴重度**: 🟡
- **建議**: 確認 task #21 的修復是否已 merge 到 master。若已 merge 但線上仍不可見，需用 DevTools 檢查是否有其他 overflow ancestor 在裁切。

#### #5 Bottom Sheet drag handle 橫線消失

- **問題**: `.sheet-handle` (style.css L639-648) 使用 `background-clip: content-box` 和 `padding: 20px 0`。handle 的可見部分只有 content area 的 4px 高度橫線。若任何祖先設了 `overflow: hidden` 或 handle 的 `opacity: 0.35` 在某些背景色下太淡，可能「看起來消失」。需確認是真的 DOM 缺失還是視覺不可見。
- **嚴重度**: 🟢
- **建議**: 在線上版 inspect `.sheet-handle` 確認是否存在於 DOM。若存在，可能只是 opacity 太低 + 背景色接近，調高 opacity 即可。

---

## SpeedDial 重設計（#6）

### 2026-03-20 — Challenger: 🎨 UX 設計 + 🌐 相容性

- **問題**: 改回 4x2 垂直佈局（2 欄 x 4 行 = 8 按鈕）。目前每個 `speed-dial-item` 的 `min-height: 44px`（`--tap-min`），加上 gap 12px，4 行的總高度 = `(44 * 4) + (12 * 3) = 212px`，加上 FAB 本身 56px + 16px 間距 = **284px**。FAB 的 `bottom: max(88px, calc(68px + env(safe-area-inset-bottom)))`，所以 SpeedDial items 頂端距離螢幕底部約 `88 + 56 + 16 + 212 = 372px`。在 iPhone SE（螢幕高度 667px）上，items 頂端在 `667 - 372 = 295px` 的位置，**尚可接受但很緊湊**。若 label 導致 item 高度超過 44px（例如「航班資訊」四個中文字），實際高度可能更多。
- **嚴重度**: 🟡
- **建議**: (1) label 固定兩字是好的方向，但 proposal 的「固定兩字」需確認 DIAL_ITEMS 中 `'AI 建議'`、`'今日路線'`、`'交通統計'` 都是四字，需要截斷或重新命名。(2) 建議在 iPhone SE 尺寸模擬器中實測，若超出可視區域，可考慮 3 行底部捲動或改為 2x3 + 2x1 混合佈局。

### 2026-03-20 — Challenger: ⚡ 效能

- **問題**: Staggered animation 從底部往上（task 6.4），目前 CSS 已有 8 個 `nth-child` delay（30ms 間隔，最長 210ms）。若改為「從底部往上」，delay 順序需反轉（child 1 最慢、child 8 最快），確認動畫方向與視覺預期一致。
- **嚴重度**: 🟢
- **建議**: 確認「從底部往上」指的是視覺上哪個方向。在 2 欄佈局中，child 1-2 是最上面那行還是最下面那行？需明確定義 DOM 順序與視覺順序的關係。

---

## 移除/簡化（#7, #10, #16）

### 2026-03-20 — Challenger: 📋 需求

#### #7 移除 useSwipeDay

- **問題**: `useSwipeDay` 已在 TripPage.tsx:628 使用中，且有完整的 swipe threshold 設計（最小距離 50px、速度閾值 0.3px/ms、方向比例 1.2）。此功能在第一輪被視為需要修復的 feature（task #6 修了 closure bug），現在要完全移除。**是否有使用者已經習慣此手勢？** 行程有 7 個 trip owner，若其中有人習慣滑動切天，移除後可能造成困擾。此外，`useSwipeDay` 使用 passive event listener，對效能無負面影響。
- **嚴重度**: 🟡
- **建議**: 建議 PM 確認 Key User 是否明確要求移除（而非「不需要」）。若只是因為不常用，可保留但預設 disabled，避免 regression。移除的程式碼量不大（~80 行），但功能復原需要重寫。

#### #10 行程頁移除返回箭頭

- **問題**: 需確認「返回箭頭」指的是哪個元素。目前 `.nav-back-btn` 在 shared.css 中定義，但 TripPage 的 sticky-nav 主要顯示 DayNav pills。若行程頁有返回箭頭，移除後使用者如何回到行程列表？是否依賴瀏覽器返回鍵？
- **嚴重度**: 🟢
- **建議**: 確認移除後的替代導航路徑。

#### #16 InfoPanel 移除 QuickLinks

- **問題**: `quick-links-row` 和 `quick-link-btn` (style.css L479-490) 有完整的 CSS 定義。移除元件後需同時清理 CSS，避免 dead code。
- **嚴重度**: 🟢
- **建議**: 一併移除 CSS。

---

## Bottom Sheet 修正（#9, #11, #13）

### 2026-03-20 — Challenger: ♿ 無障礙 + 🎨 UX 設計

#### #9 X 關閉按鈕統一放大

- **問題**: `.sheet-close-btn` 目前已設 `width/height: var(--tap-min)` (44px)。Proposal 說「同設定頁 40px tap target」，但 40px < 44px，這是要**縮小**嗎？Apple HIG 建議觸控目標 ≥ 44pt。若設定頁的是 40px，應該是設定頁需要放大，而非 Bottom Sheet 縮小。
- **嚴重度**: 🟡
- **建議**: 統一為 44px（`--tap-min`），不要低於 Apple HIG 標準。

#### #11 匯出選項改回橫向排列

- **問題**: `.download-sheet-options` 目前是 `flex-direction: column`。改為橫向排列 + 線條區隔，需要新的 CSS 和可能的 HTML 結構變更。4 個選項橫向排列在手機上可能文字被截斷（寬度 = `(screen - padding) / 4`，在 375px 寬的 iPhone 上每個選項只有 ~80px）。
- **嚴重度**: 🟡
- **建議**: 確認 4 個選項的文字長度是否適合橫向排列。若太長，考慮 2x2 grid 而非 4x1 row。

#### #13 InfoSheet overscroll-behavior: contain

- **問題**: 直接加 `overscroll-behavior: contain` 是正確做法，單純 CSS 一行修改。
- **嚴重度**: 🟢
- **建議**: 無額外風險。

---

## DayNav 修正（#12, #14）

### 2026-03-20 — Challenger: ♿ 無障礙

#### #12 pill 加 aria-label

- **問題**: 格式 `MM/DD 地點名稱`。需確認 day data 中是否有「地點名稱」欄位。若每天有多個地點，取哪個？建議取第一個 timeline entry 的標題或 day header 的文字。
- **嚴重度**: 🟢
- **建議**: 確認資料來源。可能需要從 day JSON 的第一個 entry 取 title，或直接用 day overview 的地區名。

#### #14 Active label 加強可見性

- **問題**: 從 `caption → footnote`（0.75rem → 0.8125rem）、`muted → foreground`。這是合理的可見性改善。但需確認改完後 label 是否超出 `max-width: 120px` 限制而被截斷。
- **嚴重度**: 🟢
- **建議**: 無重大風險。

---

## 全站規範（#15, #22, #8）

### 2026-03-20 — Challenger: ⚡ 效能 + 🐛 漏洞

#### #15 全站 font-size token 掃描

- **問題**: 掃描結果顯示 `css/` 目錄下的 `.css` 檔案已經沒有 hardcoded `font-size: Npx` 的寫法（grep 回傳空結果）。**font-size token 化可能已經完成**。如果範圍擴及 `src/` 的 inline style 或 `dist/` 的 build 產物，需要確認搜尋範圍。此外，`style.css` 中有 `width: 28px; height: 28px`（SpeedDial trigger SVG 尺寸），這些是 icon 尺寸而非 font-size，不應被掃描替換。
- **嚴重度**: 🟡
- **建議**: (1) 明確搜尋範圍（只搜 `css/*.css` 還是包含 JSX inline style？）。(2) 排除非 font-size 的 px 值（如 width、height、padding）。(3) 若 CSS 已完成 token 化，可降低此項優先級或直接跳過。

#### #22 全站 hover 色塊加 padding + negative margin

- **問題**: **這是此提案中影響範圍最大的項目。** 「所有可點擊元素 hover 色塊加 padding + negative margin + border-radius」涉及全站所有 button、a、`[role="button"]` 元素。negative margin 的風險：(a) 在 flex/grid container 中，negative margin 可能造成元素重疊或超出容器邊界；(b) 在 `overflow: hidden` 的祖先中，padding 擴展的 hover 區域會被裁切，造成不對稱的視覺效果；(c) 與現有的 `padding` 值衝突（例如 `.map-link` 已有 `padding: 8px 12px`，再加 padding 會使元素過大）。
- **嚴重度**: 🔴
- **建議**: (1) 不應一次性套用到「所有可點擊元素」，應逐一評估哪些元素需要 hover 擴展。(2) 建議用 `::before` pseudo-element 實現 hover 區域擴展，而非 padding + negative margin，避免佈局偏移。(3) 此項應拆分為獨立的小型修改，每修一類元素就測試一次，不要批次套用。

#### #8 SpeedDial label 用 font-size token

- **問題**: `.speed-dial-label` 目前使用 `var(--font-size-caption2)`（0.6875rem），已經是 token。Proposal 說「用 font-size token」但目前已經是 token。Tasks 中寫「確認用 font-size token」，可能只是驗證步驟而非實際修改。
- **嚴重度**: 🟢
- **建議**: 若已是 token，標記為 no-op 即可。

---

## InfoPanel 桌面版（#17, #20, #21）

### 2026-03-20 — Challenger: 💻 程式

#### #17 今日行程可點擊 → scrollIntoView

- **問題**: `.today-summary-item` 已有 `cursor: pointer` 和 hover 樣式（style.css L494-495），但目前沒有 onClick handler。加入 `scrollIntoView` 需要能從 InfoPanel 存取 tripContent DOM 中的 timeline entry 元素。需要透過 ref 或 DOM query（`document.querySelector('.tl-event[data-entry-id="..."]')`）。若 data-entry-id 不存在於 DOM 中，需要先在 build 或 render 時加上。
- **嚴重度**: 🟡
- **建議**: 確認 timeline entry DOM 上是否有可供 query 的 unique identifier（如 `id` 或 `data-*` 屬性）。

#### #20 InfoPanel 加圓角

- **問題**: 單純 CSS 修改，無風險。
- **嚴重度**: 🟢
- **建議**: 無。

#### #21 倒數天數簡化

- **問題**: 將數字用 `--font-size-title1`，但 shared.css 的 `@theme` 中沒有 `--font-size-title1` 這個 token（有 `title`、`title2`、`title3`，沒有 `title1`）。需要確認是要新增 token 還是使用現有的 `--font-size-title`。
- **嚴重度**: 🟡
- **建議**: 使用現有的 `--font-size-title`（1.75rem）或 `--font-size-title2`（1.375rem），不要新增 token。

---

## 新功能（#18）

### 2026-03-20 — Challenger: 🌐 相容性 + 📋 需求

#### #18 旅行當天自動定位

- **問題**: Tasks 寫 `todayDayNum → switchDay + scrollIntoView .tl-now`。
  1. **時區問題**: `todayDayNum` (TripPage.tsx L603-607) 用 `new Date().toISOString().split('T')[0]` 取得「今天」。`toISOString()` 回傳 **UTC 時間**。若使用者在 UTC+9（日本）的下午 3 點查看，`toISOString()` 是正確日期；但若在 UTC+9 的凌晨（例如 0:00-9:00），`toISOString()` 會回傳前一天的 UTC 日期，導致定位到**前一天**。沖繩行程使用者在早上 8 點（UTC-1=前一天 23:00 UTC）開啟 app，會被帶到前一天的行程。
  2. **首次載入行為**: 若使用者用 `#day3` URL 直接進入，auto-locate 不應覆蓋 URL hash 的意圖。需確認 hash 優先於 auto-locate。
  3. **`.tl-now` 元素可能不存在**: 若還沒到第一個景點的時間，整天都沒有 `.tl-now`，`scrollIntoView` 會失敗（silent failure 或 null reference）。
- **嚴重度**: 🔴
- **建議**: (1) 改用 `new Date().toLocaleDateString('sv-SE')` 或 `Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo' }).format(new Date())` 取得目的地當地日期。(2) 加入 hash 優先判斷。(3) 加入 `.tl-now` 存在性檢查。

---

## 交通統計重設計（#19）

### 2026-03-20 — Challenger: 🎨 UX 設計 + 🌐 相容性

- **問題**: 手機版卡片式 / 桌面版表格式，切換斷點 768px。
  1. **768px 合理性**: iPad Mini 縱向 744px（< 768px，顯示卡片式），iPad 10.2" 縱向 810px（≥ 768px，顯示表格式）。iPad Mini 使用者看到卡片式而非表格式，這合理嗎？768px 是 `--padding-h` 變化的斷點（shared.css L696-698），但交通統計的內容密度與其他元素不同。若表格有 5+ 欄，在 768-900px 之間可能太擠。
  2. **XhYYm 格式**: `2h05m` 或 `0h30m`？需統一格式。0 分鐘顯示 `Xh00m` 還是 `Xh`？不到 1 小時顯示 `0h30m` 還是 `30m`？
  3. **開車 >2h 警告底色**: `var(--color-warning-bg)` 在不同主題下的可見性需要測試。某些深色主題的 warning-bg 是半透明 rgba，可能在卡片背景上不明顯。
- **嚴重度**: 🟡
- **建議**: (1) 考慮用 900px 而非 768px 作為表格/卡片切換點，確保表格在較寬螢幕才出現。(2) 明確定義時間格式規則（例如: `≥ 1h → XhYYm`、`< 1h → YYm`）。(3) 在所有 6 個主題的 light/dark 模式下測試 warning-bg。

---

## 嚴重度彙總

| 嚴重度 | 數量 | 項目 |
|--------|------|------|
| 🔴 高 | 3 | #1 ThemeArt 根因不明（可能非程式碼 bug）、#18 時區問題會定位到錯誤日期、#22 negative margin 全站套用佈局風險 |
| 🟡 中 | 9 | #3 icon registry 未逐一驗證、#4 修復是否已 merge、#6 iPhone SE 高度+label 截斷、#7 使用者習慣未確認、#9 tap target 方向錯誤（40<44）、#11 橫向排列文字截斷、#15 範圍不明+可能已完成、#17 需要 DOM identifier、#21 token 不存在 |
| 🟢 低 | 10 | #2 path data 明確、#5 可能只是 opacity、#8 已是 token、#10 確認替代路徑、#12 資料來源、#13 一行 CSS、#14 合理改善、#16 記得清 CSS、#20 無風險、#19.stagger 方向確認 |
