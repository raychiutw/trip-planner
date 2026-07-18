## 0. 建立視覺保真檢視方法（先做，之後每項都照它驗）

- [ ] 0.1 在 `DESIGN.md` 新增「Visual Fidelity Review」段：雙視窗必截（手機 390 = iOS HIG / 桌機 1440 = macOS HIG）、逐頁態、逐元件 3× zoom + `getComputedStyle` dump（寬高/bg/border/padding/對齊 vs 44pt tap 區 + DESIGN.md token）、mockup 並排、sticky 捲動態、禁止把偏離合理化。
- [ ] 0.2 建 `openspec/specs/visual-fidelity-review/spec.md`（capability spec：SHALL 雙視窗 / SHALL 逐元件 computed 對 token / SHALL mockup 並排 / SHALL 捲動態 / SHALL NOT 合理化偏離）。
- [ ] 0.3 更新記憶 `feedback_qa_visual_fidelity_blindspot`：把此方法納入（連兩輪漏 → 方法化）。

## 1. 搜尋按鈕破版（#2，根因已確認）

- [ ] 1.1 `.tp-trips-search` collapsed 態改 44×44（或 40×40）圓、icon 置中（拔不對稱 padding / `place-items:center`），展開態維持 220px；`.tp-trips-search-toggle` 不再被 `overflow:hidden` 裁。
- [ ] 1.2 雙視窗 3× zoom 驗證 icon 置中、tap 區 ≥44、展開輸入正常。

## 2. filter tabs「一片白色」（#1）

- [ ] 2.1 開 mockup（`docs/design-sessions/terracotta-preview-v2.html` 或 trips list 相關）截 filter tabs，比對現況 `.tp-trips-tabs`（`--color-secondary` 容器 + `is-active` 白 pill）對比與 segmented control 形制。
- [ ] 2.2 依 mockup 調整（容器對比 / active thumb / 間距），使其為清楚 segmented control 而非「白色色塊」。同步 DESIGN.md/mockup。

## 3. 行程頁 timeline 破版（#3，待 pinpoint）

- [ ] 3.1 依方法逐元件放大 timeline（手機 + 桌機）:標題/副標/dot/dash 脊線/travel pill/展開明細,找出確切破點（不是上輪修過的 ★ 孤行，是新的）。
- [ ] 3.2 對照 mockup（`2026-07-17-v3-desktop-timeline-route-spine.html`）+ DESIGN.md timeline 段修正，雙視窗 before/after 驗。

## 4. day tab 中欄置中（#4，根因已確認）

- [ ] 4.1 `.tp-map-day-tabs` `margin: 6px 12px 8px` → 置中（`margin: 6px auto 8px`；如需手機靠左/桌機置中則加 media query）。
- [ ] 4.2 桌機截圖驗證 day-tab pill 在中欄水平置中（computed: pill 中心 ≈ 中欄中心）。

## 5. 捲動時 day tab 與 header 間距（#5，根因已確認）

- [ ] 5.1 `.tp-map-day-tabs--sticky` `top: var(--titlebar-h)` → 加 gap（`top: calc(var(--titlebar-h) + Npx)`），確保捲動時與（玻璃）titlebar 有可見間距、不被玻璃層蓋/透。
- [ ] 5.2 捲動態截圖驗證（sticky 後 day-tab 與 titlebar 間有間距、無重疊/穿透）。

## 6. 地圖 auth 失敗優雅降級（#6）

- [ ] 6.1 `useGoogleMap`：`Promise.all([...])` 補 `.catch()` set loadError；註冊 `window.gm_authFailure = () => setLoadError(...)`（Google referer/key 失敗的官方 callback）。
- [ ] 6.2 `TpMap`：`loadError` 時 render 頁面內「地圖暫停服務」placeholder（乾淨、非 Google 灰底 error、非 ErrorBoundary 紅屏），地圖容器不掛載（避免 Google 自畫 error overlay）。文案對齊 DESIGN.md Empty/error 語氣。
- [ ] 6.3 桌機 + 手機驗證：localhost 下右欄/地圖頁顯「地圖暫停服務」、頁面其餘（行程/timeline）完全正常可用。

## 7. 收尾

- [ ] 7.1 每項雙視窗 before/after 截圖歸檔;computed-vs-token 對齊表更新。
- [ ] 7.2 UI 改動同步 DESIGN.md + 對應 mockup（同 PR）。
- [ ] 7.3 `openspec validate rev2-visual-fidelity --strict` 過;tsc + 相關 unit/token-gate 測試綠。
