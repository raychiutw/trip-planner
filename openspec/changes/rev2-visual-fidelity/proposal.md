# rev2 視覺保真 — 檢視方法 + 桌機/手機視覺修正

## Why

/qa 與 /design-review **連兩輪**宣稱「0 視覺偏離」,owner 一看又抓出一批明顯問題(功能 tab 一片白色、搜尋按鈕破版、timeline 破版、day tab 沒在中欄置中、捲動時 day tab 沒與 header 保持間距、地圖載入失敗整塊 error 佔版)。

根因不是單一 bug,是**檢視方法不成系統**:只截部分視窗(多截桌機或多截手機、不是兩者)、不逐元件放大看、不把 `getComputedStyle` 實測值對 DESIGN.md token / mockup、看到異常就合理化成「async 慢載 / 環境問題 / intended」。結果 health score 綠燈但視覺沒對到 SoT。

此變更做兩件事:(a) 把「正確看截圖 + 深度比對」定成**可重複的視覺保真檢視方法**(寫進 DESIGN.md + OpenSpec spec,當 /qa /design-review 的 SoT);(b) 依該方法找出並修掉這輪的 6 項問題,每項附根因(source + computed 實測)。

## What Changes

- **新增視覺保真檢視方法**(DESIGN.md + `openspec/specs/visual-fidelity-review/spec.md`):雙視窗必截(手機=iOS HIG / 桌機=macOS HIG,兩者渲染不同)、逐頁態、逐元件 3× zoom + computed-style dump、mockup 並排比對、sticky 捲動態、禁止把偏離合理化。
- **修 6 項視覺問題**(根因見 design.md 對照表):
  1. 行程一覽 filter tabs(`.tp-trips-tabs`)對比不足、like「一片白色」— 比對 mockup 對齊 segmented control。
  2. 搜尋按鈕破版 — collapsed `.tp-trips-search` 36px 寬、內容區僅 18px(padding 10+8)卻塞 24px toggle → `overflow:hidden` 裁掉、icon 偏左上。改 collapsed 為 44×44 置中圓。
  3. 行程頁 timeline 破版 — 已 pinpoint:長 entry(時間**區間**+時數+評分)副標超 390px → `★ 4.1` 整組換行、第一行尾掛孤懸 `·`(`.tp-rail-sub` 分隔符是獨立 flex child)。修 = 分隔符綁進 token 為 nowrap 單位。
  4. day tab 沒在中欄置中 — `.tp-map-day-tabs` `margin: 6px 12px 8px`(靠左),改 `margin: auto` 置中。
  5. 捲動時 day tab 沒與 header 間距 — `--sticky` `top: var(--titlebar-h)` 緊貼玻璃 titlebar 無 gap,加間距 + 處理玻璃層疊。
  6. 地圖 auth 失敗(localhost referer)整塊 Google error 佔版 — try/catch + `window.gm_authFailure` → set loadError → 頁面內顯「地圖暫停服務」placeholder,頁面其餘正常。
  7. 桌機 favorites 重複搜尋 — titlebar 🔍 + 頁內 search bar 同時存在(computed 皆 true)→ 擇一。(方法主動掃描新找到)

**稽核完成 — `visual-fidelity-audit` workflow(11 sonnet,34 畫面)+ 主迴圈 computed 驗證,新增(全表見 design.md B3):**
  8–12. **新破版**:op-edit 桌機 DAY tab 蓋 day-header 標題 / 桌機操作頁浮動 nav 被 stack panel 切 182px(系統性)/ favorites 卡片動作列參差未底對齊(y 412/483/433)/ login·signup 裝飾圓 edge 橫切 hero 標題 / new-trip 底部 nav bleed 重影。
  13–17. **concrete HIG 違規**:⋮ kebab → iOS `…` / 44pt 觸控區(explore +·♥、nav 三控、trip-notes)/ signup 密碼常駐 helper / op-changepoi disabled 鈕對比 / tripdetail nav bar 控制過擠壓標題。
  **owner 決策的 HIG 偏離(tasks §10,先不動)**:桌機底部浮動 tab bar 非 macOS(9 agent 一致最強項,但 rev2 canonical、mockup sign-off)、操作 sheet ‹+✕ 雙 dismiss、sidebar deep cocoa 非 vibrancy、macOS 窄置中欄、macOS 子頁 back-chevron。

> **偽陽性(computed 推翻,不修)**:account 底 row 未被 nav 蓋(真 max scroll 登出 row bottom=691 < navTop=880)。**修正上輪自誤判**:favorites 真問題是動作列未底部對齊(#10),非「卡片等高」(上輪選錯元件)。

## Capabilities

### New Capabilities
- `visual-fidelity-review`: /qa /design-review 的視覺保真檢視方法 — 雙視窗、逐元件 zoom+computed、mockup/token 並排、scroll 態、不合理化偏離。

### Modified Capabilities
<!-- 6 項為既有 UI 的視覺對齊修正,不改互動語意;spec 層只新增 review 方法 capability。 -->

## Impact

- `DESIGN.md`:新增「Visual Fidelity Review(視覺保真檢視方法)」段。
- `openspec/specs/visual-fidelity-review/spec.md`:新 capability spec。
- `src/pages/TripsListPage.tsx`:filter tabs(#1)+ 搜尋按鈕(#2)scoped styles。
- `css/tokens.css`:`.tp-map-day-tabs`(#4 置中)+ `.tp-map-day-tabs--sticky`(#5 間距)。
- `src/components/trip/TimelineRail.tsx`:timeline 副標分隔符綁 nowrap(#3,已 pinpoint)。
- `src/hooks/useGoogleMap.ts` + `src/components/trip/TpMap.tsx`:地圖 auth 失敗降級(#6)。
- favorites 頁 search 元件:桌機重複搜尋擇一(#7)。
- **待併入**:`visual-fidelity-audit` workflow 的破版 + HIG findings(完成後統整驗證加進 tasks/design）。
- 每項雙視窗 before/after 截圖 + computed-vs-token 驗證。UI 改動同步 DESIGN.md / mockup。
