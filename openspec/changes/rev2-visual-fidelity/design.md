# Design — 視覺保真檢視方法 + 深度比對findings

## A. Visual Fidelity Review Method（正確看截圖 + 深度比對）

連兩輪 /qa /design-review 宣稱「0 偏離」卻漏掉一批明顯視覺問題,原因是「看截圖」憑印象、非系統。定成以下**必做流程**(SoT,寫進 DESIGN.md + spec):

1. **雙視窗必截**:手機 `390×844`(= iOS HIG)+ 桌機 `1440×900`(= macOS HIG)。本 app 兩視窗**渲染完全不同**(trips = 手機卡片 vs 桌機三欄;操作 = 全頁 vs 右欄堆疊)——只截一個必漏另一個的問題。桌機三欄尤其常被漏。
2. **逐頁態**:每頁的實際狀態都截(trips / trip detail / 操作頁 / chat / favorites / 地圖),含空/錯誤/載入態。
3. **逐元件 3× zoom + computed**:每個互動元件(按鈕 / tab / 搜尋 / 膠囊 / sticky strip)`browse screenshot --clip` 3× 放大 **並** `getComputedStyle` dump 實測值(width/height/background/border/padding/對齊)。對三把尺:①44pt tap 區 ②DESIGN.md token(`--blur-glass`、spacing、字級)③水平/垂直置中。
4. **mockup 並排**:`browse goto file://.../docs/design-sessions/<相關>.html` 截同一元件,逐項比 layout/間距/對齊/色/字級/形制。找不到 mockup 就對 DESIGN.md 條文。
5. **sticky 捲動態**:sticky 元件(day tab、titlebar)**捲動後**再截,查與上層的間距/重疊/穿透(靜態截圖看不出)。
6. **禁止合理化偏離**:任何與 mockup/token 不符都是 finding。不准用「async 慢載 / 環境問題 / intended」打發——除非**查證** token 值/程式註解確認確為 intended(如深色 sidebar `--color-sidebar-bg:#2A1F18` 註解「deep cocoa」)。
7. **computed 勝過肉眼**:置中/尺寸/對比都用實測值判,不憑印象估。

## B. 本輪深度比對 findings（現況 → 根因 → 修法）

| # | 問題(owner 描述) | 現況/computed 實測 | 根因(source) | 對照(token/mockup) | 修法 |
|---|---|---|---|---|
| 1 | 一覽 功能 tab 一片白色 | `.tp-trips-tabs` bg `--color-secondary`(250,244,234)容器低對比;`is-active` = `--color-background` 白 pill + shadow | `TripsListPage.tsx:253/274` — 容器 cream-on-cream、active 白 pill 突兀 | segmented control 應清楚分段(待 mockup 對) | 提高容器對比 / 對 mockup 調 active thumb |
| 2 | 搜尋按鈕破版 | collapsed `.tp-trips-search` `width:36px` + `padding:4px 8px 4px 10px`(內容區僅 18px)+ `overflow:hidden`,塞 24px `.tp-trips-search-toggle` → icon 被裁、偏左上 | `TripsListPage.tsx:310-334` | 44pt tap 區 + icon 應置中 | collapsed 改 44×44 圓、`place-items:center`、icon 置中;展開維持 220px |
| 3 | timeline 破版 | 待逐元件 pinpoint(非上輪 ★ 孤行) | `TimelineRail.tsx`(待定位) | `2026-07-17-...timeline-route-spine.html` | 依方法定位後修 |
| 4 | day tab 沒在中欄置中 | `.tp-map-day-tabs` `margin:6px 12px 8px`(靠左);桌機 dayTabLeft=268、midCol 216–823 → 非置中(置中應 ≈343) | `tokens.css:1349` | fit-content 膠囊在寬欄應置中 | `margin:6px auto 8px`(必要時 media query 手機靠左) |
| 5 | 捲動 day tab 沒與 header 間距 | `.tp-map-day-tabs--sticky` `top:var(--titlebar-h)` 緊貼 titlebar 底、無 gap;titlebar 現為玻璃(z=200)、day-tab z=199 | `tokens.css:1399` | sticky 二層應有間距、不穿透玻璃 | `top:calc(var(--titlebar-h)+Npx)` 加 gap + 檢查玻璃層疊 |
| 6 | 地圖 error 整塊佔版 | localhost referer → Google Maps JS 自畫「糟糕!出了點狀況」overlay 進容器;app `loadError` 未被設(promise resolve) | `useGoogleMap.ts:105` 無 `.catch` + 未接 `gm_authFailure` | 頁面應正常 + 顯「地圖暫停服務」 | `.catch()` + `window.gm_authFailure` → setLoadError → `TpMap` render placeholder、不掛地圖容器 |

## B2. 主動掃描結果（2026-07-18，照方法逐畫面 × 雙視窗,非只修 owner 指出的）

掃描範圍：trips / trip detail / chat / favorites / account,各手機 390 + 桌機 1440。

**確認為真（照 source + computed）：**
- #1–#6 owner 指出的全部成立（根因見 B 表）。#3 timeline 已 pinpoint：長 entry（時間**區間** 14:30–15:30 + 時數 + 評分）副標超過 390px → `★ 4.1` 整組換到第二行、第一行尾巴掛一個 `·`（分隔符是獨立 flex child 會孤懸）。上輪只綁 ★+4.1 不拆、沒解決整行 wrap。
- **#7（新找到）**：桌機 favorites 有**重複搜尋**——titlebar 有 🔍 按鈕、頁內又有整條 search bar（computed: titlebarSearch + inlineSearchBar 皆 true）。擇一。

**方法自我修正（肉眼誤報、被 computed 推翻）：**
- account 底部 row 被 nav 蓋 → **偽**：捲到底時最後可點 row（登出）bottom=691、navTop=880、padding-bottom=88px → 在 nav 上方。我看到的是**捲動中途**（內容從玻璃 nav 下流過＝刻意），非 max scroll 被蓋。
- favorites 卡片同列不等高 → **偽**：computed 三張皆 227px、等高;肉眼把「內容填充不同」誤讀成「卡高不同」。

→ 印證方法第 3、7 條（computed 勝肉眼）：既抓漏、也擋誤報。

## C. 決策

- 檢視方法放 DESIGN.md(UI/UX SoT 的一部分)+ OpenSpec spec(可 validate、可被 skill 引用),並回灌記憶 `feedback_qa_visual_fidelity_blindspot`。
- 6 項為視覺對齊、不改互動語意;#3 需先 pinpoint 再定確切修法(避免又憑印象)。
- 地圖降級用 Google 官方 `gm_authFailure` callback(比 try/catch 更準:auth 失敗時 promise 仍 resolve、只有此 callback 會 fire)。
