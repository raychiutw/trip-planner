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
  3. 行程頁 timeline 破版 — 依方法逐元件 pinpoint 後修(執行時定位確切破點)。
  4. day tab 沒在中欄置中 — `.tp-map-day-tabs` `margin: 6px 12px 8px`(靠左),改 `margin: auto` 置中。
  5. 捲動時 day tab 沒與 header 間距 — `--sticky` `top: var(--titlebar-h)` 緊貼玻璃 titlebar 無 gap,加間距 + 處理玻璃層疊。
  6. 地圖 auth 失敗(localhost referer)整塊 Google error 佔版 — try/catch + `window.gm_authFailure` → set loadError → 頁面內顯「地圖暫停服務」placeholder,頁面其餘正常。

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
- `src/components/trip/TimelineRail.tsx`(或相關):timeline 破版(#3,待 pinpoint)。
- `src/hooks/useGoogleMap.ts` + `src/components/trip/TpMap.tsx`:地圖 auth 失敗降級(#6)。
- 每項雙視窗 before/after 截圖 + computed-vs-token 驗證。UI 改動同步 DESIGN.md / mockup。
