## 0. 建立視覺保真檢視方法（先做，之後每項都照它驗）

- [ ] 0.1 在 `DESIGN.md` 新增「Visual Fidelity Review」段：雙視窗必截（手機 390 = iOS HIG / 桌機 1440 = macOS HIG）、逐頁態、逐元件 3× zoom + `getComputedStyle` dump（寬高/bg/border/padding/對齊 vs 44pt tap 區 + DESIGN.md token）、mockup 並排、sticky 捲動態、禁止把偏離合理化。
- [ ] 0.2 建 `openspec/specs/visual-fidelity-review/spec.md`（capability spec：SHALL 雙視窗 / SHALL 逐元件 computed 對 token / SHALL mockup 並排 / SHALL 捲動態 / SHALL NOT 合理化偏離）。
- [ ] 0.3 更新記憶 `feedback_qa_visual_fidelity_blindspot`：把此方法納入（連兩輪漏 → 方法化）。

## 1. 搜尋按鈕破版（#2，根因已確認）

- [x] 1.1 `.tp-trips-search` collapsed 態改 44×44（或 40×40）圓、icon 置中（拔不對稱 padding / `place-items:center`），展開態維持 220px；`.tp-trips-search-toggle` 不再被 `overflow:hidden` 裁。
- [x] 1.2 雙視窗 3× zoom 驗證 icon 置中、tap 區 ≥44、展開輸入正常。

## 2. filter tabs「一片白色」（#1）✅

- [x] 2.1 根因確認：`.tp-trips-tabs` 容器 `--color-secondary`(#FAF4EA) 與 active thumb `--color-background`(#FFFBF5) 幾乎同色，只靠弱 shadow-sm 分隔 → 整條像白塊。
- [x] 2.2 修：容器改暖底 track（`--color-hover` + inset border 界定）+ thumb 明顯浮起陰影 → 清楚 segmented control。真瀏覽器驗 active pill 浮起。commit d1b0ae76。

## 3. 行程頁 timeline 破版（#3，已 pinpoint）

- [x] 3.1 已定位：長 entry（時間區間 + 時數 + 評分）副標超 390px → `★ 4.1` 整組換行 + 第一行尾掛孤懸 `·`。根因 = `.tp-rail-sub` 分隔符是獨立 flex child。
- [x] 3.2 修法：把每個「`·` + token」綁成 nowrap 單位（分隔符不再獨立孤懸），或副標超長時的 graceful 收斂（對 `2026-07-17-...timeline-route-spine.html` mockup）。雙視窗 before/after 驗（含長 entry 3 那種）。

## 6b. 桌機 favorites 重複搜尋（#7，新找到）✅

- [x] 6b.1 實情：titlebar 的是「探索」按鈕但用了 search 放大鏡 icon，與頁內真 search bar 的放大鏡撞（像兩個搜尋）。修：探索鈕 icon 改 `sidebar-explore`（非放大鏡），保留頁內 search bar。commit d1b0ae76。

## 4. day tab 中欄置中（#4，根因已確認）

- [x] 4.1 `.tp-map-day-tabs` `margin: 6px 12px 8px` → 置中（`margin: 6px auto 8px`；如需手機靠左/桌機置中則加 media query）。
- [x] 4.2 桌機截圖驗證 day-tab pill 在中欄水平置中（computed: pill 中心 ≈ 中欄中心）。

## 5. 捲動時 day tab 與 header 間距（#5，根因已確認）

- [x] 5.1 `.tp-map-day-tabs--sticky` `top: var(--titlebar-h)` → 加 gap（`top: calc(var(--titlebar-h) + Npx)`），確保捲動時與（玻璃）titlebar 有可見間距、不被玻璃層蓋/透。
- [x] 5.2 捲動態截圖驗證（sticky 後 day-tab 與 titlebar 間有間距、無重疊/穿透）。

## 6. 地圖 auth 失敗優雅降級（#6）✅

- [x] 6.1 `useGoogleMap` 已有 `.catch` + loadError；補註冊 `window.gm_authFailure`（referer/key 失敗官方 callback）→ setLoadError + setMap(null)；`authFailed` flag 雙向 gate .then setMap race；unmount 還原；加 Window.gm_authFailure 型別宣告。
- [x] 6.2 `TpMap` loadError overlay 文案改「地圖暫停服務」+ 授權失敗專屬訊息（行程其他功能正常）；map 容器 visibility:hidden + PageErrorState overlay 覆蓋（Google 灰底不外露）。
- [x] 6.3 真瀏覽器驗（localhost /map，非授權 referer）：顯「地圖暫停服務」+ 重試，sidebar/day tabs/entry cards 全正常，無 Google overlay、無紅屏。一併根治 memory local_dev_gmaps_referer_crash。commit 0e46a9cd。

## 8. workflow 稽核新確認的破版（computed 驗過）

- [ ] 8.1 op-edit 桌機 DAY tab 蓋 day-header:中欄 DAY 膠囊列與「DAY 01/日期」標題重疊 → **待最終 workflow audit 於 d-addentry 截圖確認**（與 #5 同源 sticky 機制；#5 已修，此為操作狀態下複驗）。
- [x] 8.2 桌機操作頁浮動 nav 被 stack panel 切 → **§10.1 已解**（桌機膠囊整個隱藏、nav 在 sidebar，不再有浮動 nav 被 panel 切問題）。
- [x] 8.3 favorites 桌機卡片動作列底部對齊 → `.poi-actions` `margin-top:auto` pin 卡底，grid 等高。真瀏覽器驗動作列齊底。commit d1b0ae76。
- [x] 8.4 login/signup 裝飾圓 edge 橫切標題 → 圓改 radial-gradient 淡出（軟 glow 無硬 edge）。commit 17d5a31c。
- [x] 8.5 new-trip 桌機底部 sticky 列後 nav bleed → **§10.1 已解**（桌機膠囊隱藏，無 nav bleed）。

## 9. concrete HIG 違規（要修）

- [x] 9.1 ⋮ kebab → iOS `…`:新增 `ellipsis` icon（水平三點），more-menu trigger（TripCardMenu/TimelineRail/TripsListPage 3 處）由 `more-vert` 改 `ellipsis`。commit 17d5a31c。
- [x] 9.2 44pt 觸控區:explore POI 卡 `❤`/`➕` 36px→`--spacing-tap-min`(44)。commit 6225776e。op-overflow nav 三控 = StackPanelHeader `‹`/`✕` 已 44pt(G-H6a)。**trip-notes trash/chevron 待最終 audit 於 d-notes 複驗**。
- [x] 9.3 signup 密碼規則改常駐 helper（`.tp-hint` + aria-describedby）。commit 17d5a31c。
- [x] 9.4 op-changepoi disabled 主鈕:原 opacity:0.5（白字對比不足）→ 顯式 disabled（淡 tan 底 + muted 深字）。commit 6225776e。
- [x] 9.5 tripdetail nav bar 精簡:「新增景點」改 icon-only，讓長標題可讀（切換/⋯ 保留）。commit 054ed142。

## 10. HIG 偏離 — rev2 owner 決策

**owner 2026-07-18 決議（§10.2-10.5 已拍板，收斂進 §10.1 桌機 shell mockup）：** §10.2 維持 ‹+✕（已驗證合 iOS 堆疊慣例、免改）· §10.3 桌機 sidebar **改 vibrancy** 半透明毛玻璃 · §10.4 account/new-trip 桌機 **改用滿橫向** · §10.5 collab/explore 子頁導覽併入 §10.1 mockup 一起定。§10.3/§10.4/§10.5 全在 §10.1 mockup + 實作內一次做完。

**owner 2026-07-19 mockup sign-off：** mockup `docs/design-sessions/2026-07-19-rev2-desktop-macos-sidebar.html`（6 board）已截圖 sign-off。決議：sidebar 材質 **A · 暖奶油 vibrancy**（淺暖半透明 + blur，最貼 macOS 淺色 app；非深棕、非 accent-tint）· 整體方向（nav 搬進 sidebar / 表單滿寬 / 子頁 toolbar 返回）**全部通過、進 code**。

- [ ] 10.1 **桌機導覽改 macOS sidebar/toolbar**（owner 2026-07-18 **拍板要改**:9 HIG agent 一致點名底部浮動 tab bar 是桌機最大 macOS 違規）。**獨立工作線、踩 mockup-first hard gate（≥1 layout 變化）**。mockup 需同時涵蓋 §10.3 vibrancy 材質 + §10.4 滿寬表單頁 + §10.5 子頁導覽:
    - [x] 10.1a 產桌機 macOS sidebar 導覽 mockup:4-tab（聊天/行程/地圖/收藏）從底部玻璃膠囊搬進**左 sidebar**;**手機維持底部 tab bar 不動**。sidebar 用 **vibrancy 半透明毛玻璃（§10.3）**、account/new-trip **滿橫向版面（§10.4）**、collab/explore 子頁導覽方式一併設計（§10.5）。✅ 已產 6-board mockup + 截圖 sign-off；**owner 選材質 A（暖奶油 vibrancy）+ 整體方向全過**。mockup 存 `docs/design-sessions/2026-07-19-rev2-desktop-macos-sidebar.html`。
    - [x] 10.1b sign-off 後改 code:`AppShell`（桌機 @≥1024 隱藏膠囊 + 移除膠囊 padding）+ `DesktopSidebar`（加 4-tab 主導覽 + vibrancy 材質）+ `navItems.ts`（抽單一來源）+ account/new-trip 桌機滿寬 + collab/explore 子頁 toolbar 返回;手機分支不變。同步 DESIGN.md + mockup。✅ commit 5dfdfbbd（sidebar+vibrancy）+ 本批（表單+子頁）。
    - [x] 10.1c 桌機各頁雙視窗驗:✅ 真瀏覽器 1440 驗 /trips /chat（nav 在 sidebar、無膠囊、內容不被遮）+ /account（滿寬 2-col）+ /explore（toolbar 返回）。**桌機底部 nav 相關破版（#9 操作頁 nav 被 panel 切、底部 nav 遮內容）一併解**（膠囊桌機隱藏）。手機 op-page 走 OperationShell 本就不顯 nav。
- [x] 10.2 操作 sheet 手機 ‹+✕ 雙 dismiss → **維持 rev2 StackPanelHeader**（owner 決；已驗證 code:‹ 只在 depth>1/L3+ 出現負責退一層、L2 只給 ✕，兩者語意不同、正是 iOS 堆疊慣例，非冗餘 → 免改）。
- [x] 10.3 桌機 sidebar vibrancy → **改 vibrancy 半透明毛玻璃**（暖奶油 color-mix + blur30，走主 app token 自動 light/dark adapt）。✅ commit 5dfdfbbd。
- [x] 10.4 account/new-trip 桌機用滿橫向 → ✅ account 設定分區桌機 2-col grid（hero 收窄置中）；new-trip 桌機加寬 880px（線性表單不 full-bleed，右側 live-preview 面板列為後續可選增強）。
- [x] 10.5 collab/explore 子頁導覽 → ✅ 加 `TitleBar backLabelVisible`（macOS toolbar 式「‹ <label>」可見文字，opt-in 不動行程詳情 icon-only back）；explore/collab 啟用。

## 7. 收尾

- [ ] 7.1 每項雙視窗 before/after 截圖歸檔;computed-vs-token 對齊表更新。
- [ ] 7.2 UI 改動同步 DESIGN.md + 對應 mockup（同 PR）。
- [ ] 7.3 `openspec validate rev2-visual-fidelity --strict` 過;tsc + 相關 unit/token-gate 測試綠。
