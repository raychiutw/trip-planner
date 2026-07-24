# Tickets — Tripline Web Apple HIG 合規（v2 · 鏡像 app #82）

to-tickets 產物（本地 markdown）。每票＝可獨立 demo/驗收的一個 PR（tracer-bullet）。**取代**先前窄版 tickets（#1117-only）。

**順序**：W0 先 → **W1 IA foundation**（blocks 多數）+ **W4 色彩**（tokens 基礎）→ 其餘依相依/平行 → **W15 a11y 守衛**跨主題。
**模式**：**AFK**＝agent 可獨立實作（複審走 PR）；**HITL**＝需 owner 輸入。
**本 effort 不使用 mockup 流程**（owner 已豁免 `/tp-team` 與 mockup-first）；直接進 code、複審走 PR。

---

## ✅ 交付狀態 — effort 2026-07-24 收官（全 16 票 shipped）

所有 W 票已 ship + merge master + CF Pages 部署，能桌機/localhost 驗的皆已真瀏覽器驗證；手機軟鍵盤/實機 safe-area 待 owner 真機驗。

| 票 | 版本 | PR | 摘要 |
|---|---|---|---|
| W0 Governance | 2.57.20 | #1122 | Apple HIG 為 UI/UX SoT（CLAUDE.md / DESIGN.md banner） |
| W1 IA foundation | 2.57.20 | #1122 | 4-tab（帳號移出 → header 圓圈 + Account sheet、自有 stack、deep-link）、per-branch nav |
| W2 自適應 + keep-alive | 2.57.29 | #1131 | 跨 1024px 表單 keep-alive：`<Outlet/>` 單一 createPortal + stable fallback |
| W3 Header 慣例 | 2.57.27 | #1129 | 桌機 titlebar 恢復 icon + 可見 label（推翻 v2.31.90） |
| W4 色彩 → system + terracotta | 2.57.20 / .22 | #1122 / #1124 | 語意 token；W4r G8-G12 dark/hex→token 出清 |
| W5 材質 & icon | 2.57.33 | #1135 | 保留玻璃膠囊（owner）；G15 reduced-transparency 全玻璃面降級 + G16 底部列 offset |
| W6 行程選擇器 | 2.57.24 | #1126 | menuitemradio + checkmark + 長清單搜尋 + 聊天草稿分行程 |
| W7 搜尋 | 2.57.22 | #1124 | page-scoped-search-guard（地圖/聊天/帳號不顯 page-level 搜尋） |
| W8 composer | 2.57.34 | #1136 | 保留 Enter 送出（owner）；`useKeyboardInset` visualViewport 軟鍵盤上移 |
| W9 Day selector | 2.57.25 | #1127 | 抽 `useDayStripNav`：地圖 day strip 置中 + ArrowLeft/Right roving |
| W10 地圖 | 2.57.35 | #1137 | marker 編號/route 虛線（非純色）+ safe-area 已滿足；source-lock 鎖合規 |
| W11 表單 & picker | 2.57.28 / .31 / .32 | #1130 / #1133 / #1134 | ShareLinkModal + 表單/帳號 px→rem；TripTimePicker 12/24 跟系統（Intl hourCycle） |
| W12 刪除政策 | 2.57.21 | #1123 | ConfirmModal 預設焦點安全鈕 + 清死路由 restore/UNDO_EXPIRED |
| W13 拖拉 a11y | 2.57.23 | #1125 | ⋯ menu 上移/下移一格（抽 `applyReorder` 共用） |
| W14 狀態 + soft-refresh | 2.57.26 | #1128 | `RefreshContext` per-view soft-refetch（不再整頁 reload）+ 失敗態 |
| W15 Accessibility 守衛 | 2.57.30 | #1132 | `a11y-axe.spec.js` 掃 key 頁 + 修 2 處色彩對比 |

**W1d depth footgun**（2.57.36 #1138）：owner 選 A，保留 `location.state.depth`、加 `confirmBeforeBack` gate 修 depth>1 pop 跳過確認的 latent footgun（不做 store 重構）。

**刻意 defer / 未做**：Google zoom 鈕套樣式（W10，Google 內部 class fragile）；tokens.css hero/titlebar display 標題維持 px（mockup-parity 鎖、大文字 rem 價值低）；W1d in-memory store 重構（arguably 反效果，見 §W1d 決策）。

---

### W0 · Governance — 採 HIG 為 SoT
**依賴**：無（先做）｜**AFK**（docs）
- `CLAUDE.md`：SoT 宣告 → 「Apple HIG 是 UI/UX SoT；`DESIGN.md` 衍生、須對齊」
- `DESIGN.md`：加「品牌保留例外」段（terracotta tint / Inter / editorial）；HIG-conformance pass（system 色、刪除政策、IA 4-tab、`:138`/`:287`/`:385`/`:143`…）；記 grill v2 五決策
- memory：`feedback_design_source_of_truth` 標「HIG 為上位 SoT」；`feedback_mockup_source_of_truth` 退役（不再用 mockup）
- **驗收**：diff 一致、無殘留舊 SoT/5-tab/undo/mockup 宣告。

### W1 · IA foundation — 4-tab + 帳號 sheet + 每-branch stack
**依賴**：無 ｜**blocks W2/W3/W6/W8** ｜**AFK**｜**最高風險**
- 4 root tab（聊天/行程/地圖/收藏）；**帳號退出 tab → header 圓圈 + Account sheet（自有 stack、關閉回原狀態、deep-link 相容）**
- **depth 契約重構**：移出 `location.state` → stack context store（`OperationShell:68`）；**每 branch 保留 Navigation Stack**；tab reselect（detail 回根、根捲頂、不清篩選）；吸收 P3-1 死路
- **驗收**：切 tab 返回續原工作；帳號 sheet 不破壞當前頁；既有 ‹/✕ e2e 綠；切 tab 狀態（Day/搜尋/篩選/捲動）不失。

### W2 · 自適應 compact/regular + split view
**依賴**：blocked-by W1 ｜**AFK**
- compact（手機）：底 4-tab bar + 單欄 push｜regular（桌機 ≥1024）：**sidebar + split view**（清單+detail 並排）
- resize 保留內容/選取；landscape **safe-area**（inset top/bottom/**left/right**，`max(16px,env())`）
- **驗收**：桌機清單+detail 並排；resize 不重設；橫向無裁切。

### W3 · Header 慣例
**依賴**：blocked-by W1 ｜**AFK**
- **inline nav title（無 Large Title）**；leading 只放返回/關閉/取消；trailing ≤1 主要動作 + ⋯ overflow + 帳號圓圈；完成/取消/儲存文字鈕；icon 動作 ≥44 + label
- 桌機：trailing hover 態、⋯ 支援右鍵 contextual；chevron 文字字元 → `<Icon>` SVG（G6）
- **驗收**：所有頁 header 一致；無 Large Title；action 44pt+label。

### W4 · 色彩系統 → system + terracotta tint
**依賴**：無（tokens 基礎）｜**AFK**｜**高影響**
- `tokens.css`：背景/表面/label/separator/fill → **system 語意色**（light/dark/高對比自適應）；terracotta 只當 tint
- 語意色獨立：`--color-info` → 系統藍（≠accent，G14）；destructive → 系統紅、dark 可辨識（G11）
- **dark 5 修**：ChatPage phantom error token（G8）、ShareLinkModal 無 dark（G9，或併其重寫）、座標 chip（G10）、toast 綁 OS media→body.dark（G12）
- **驗收**：對比 AA（雙軌）；色彩 audit bug 清零；dark 邊角解。

### W5 · 材質 & icon 系統
**依賴**：軟依 W4 ｜**AFK**
- glass chrome + **reduced-transparency/高對比 fallback 覆蓋全玻璃面**（G15）；tab bar 選中 → **tonal**（非實心膠囊，G1/V1）；sidebar → **macOS 扁平**（去浮動玻璃膠囊，G2/V6）；chrome 材質一致 StackPanelHeader↔TitleBar（G13）
- **icon 系統統一 SF-風描邊**（去 Material 填色混用）；桌機底部列 `left:240→var(--sidebar-width)`（G16）
- **驗收**：reduced-transparency 全面生效；tab/sidebar 符 HIG；icon 一致。

### W6 · 行程選擇器
**依賴**：blocked-by W1 ｜**AFK**
- Header 顯目前行程名 → 點開切換 selection sheet（checkmark+全名/長清單搜尋/單一停用隱 chevron/無行程建立入口）；切換留同 section、Day 保留規則、地圖清選取、聊天草稿分行程存
- **驗收**：切行程留 section；地圖不混兩行程資料。

### W7 · 搜尋 inline scoped
**依賴**：無 ｜**AFK**
- inline search（行程列表、收藏內容頂）；地圖/Day/聊天/Account 不顯；scoped task（加 POI）內才搜；清除/取消可逆不改其他篩選；鍵盤 Search 執行不清 query
- **驗收**：搜尋只作用當頁；可逆。

### W8 · 底部 accessory + 聊天 composer
**依賴**：blocked-by W1 ｜**AFK**
- 同畫面**最多一個 bottom accessory**；tab bar 與 accessory 兩層級
- composer：固定底、1→4 行成長後內捲、空白麥克風/有字送出、⌘Return 送出、鍵盤上方 + tab bar 隱、切 tab/暫離留草稿
- **驗收**：無多 accessory 相撞；草稿不失。

### W9 · Day selector
**依賴**：無 ｜**AFK**
- 水平捲（時間軸 Day1–N；地圖 全部+Day1–N）；selected 置中可見、邊緣露下一項；**滑動只瀏覽、點擊才切**；宣告序號/總數/selected；鍵盤左右方向鍵；捲動保持（memory scroll-restore）
- **驗收**：切 Day 不誤切；selected 不滑出；捲動不彈回。

### W10 · 地圖
**依賴**：無 ｜**AFK**
- 保留原生 pan/zoom/rotate/double-tap；點定位控制才請求位置權限；切全部/Day 同步 marker/route/POI；**marker/route 非純色區分**（形狀/標籤）
- POI accessory：有 POI 顯卡片列、marker↔卡片雙向同步、無 POI 隱+空狀態、外部 POI 暫代並可恢復、外部 POI 須明確加入才進行程
- **🔴 /map safe-area**（header 讓 status bar、carousel 吃 home indicator + `--nav-overlay-h`）；Google zoom 鈕套樣式
- **驗收**：地圖手勢不被攔；marker 色覺無礙；/map 不壓 status bar/home indicator。

### W11 · 表單 & picker
**依賴**：無 ｜**AFK**
- 系統 date picker（locale 日期順序/週首日）、不合法停用/取消不改值；時間只時分+**5 分間隔**、**12/24 跟系統**（`Intl` hourCycle）、錯誤顯欄旁
- 容器：短 sheet/長 push；取消 leading、完成 trailing；未存關閉前確認捨棄；儲存中阻重複、成功才關、失敗保留輸入；鍵盤 Next/Done
- 固定高 chrome 裁字修（`height→min-height`+line-height）；px font-size→rem（ShareLinkModal 併重寫）；加 zoom/reflow 測試
- **驗收**：日期/時間符系統；表單無資料遺失；200% 不裁字。

### W12 · 刪除政策〔#82〕
**依賴**：無 ｜**AFK**
- 所有刪除 → 同一不可復原確認（對象名/影響/「無法復原」、**安全預設焦點**、破壞鈕寫「刪除」）；swipe 只揭露不執行；**server-confirm-before-remove**、失敗保留+重試；收藏取消同確認**無 undo**；不提供 restore；刪帳號 **reauth**
- **code 連帶**：移除 `poi-favorites/[id]/restore.ts`+`UNDO_EXPIRED`+companion；查改樂觀刪除站點
- **驗收**：破壞鈕開啟按 Enter 不刪；網路失敗資料不假消失；無 restore 路徑殘留。

### W13 · 拖拉排序
**依賴**：無 ｜**AFK**
- 明確 drag handle（不與 tap/menu 衝突）；同/跨 Day 拖放；跨 Day 一次同步源+的；失敗完整還原；a11y 上移/下移/移至他 Day actions；leading-edge 返回手勢維持
- **驗收**：拖放失敗不破壞行程；不靠拖曳也能排；系統返回不被擋。

### W14 · 狀態（載入/離線）+ soft-refresh
**依賴**：無 ｜**AFK**（架構）
- 首載 skeleton；refresh 保留舊內容；行程/收藏 pull-to-refresh；離線顯快取+持續狀態+重試
- `AppShell:245` `location.reload()` → **per-view refetch 契約** + 失敗態（保留 input guard）
- **驗收**：下拉刷當頁留原地；離線有回饋。

### W15 · Accessibility 守衛〔跨主題，折入 #1117〕
**依賴**：軟依各功能票 ｜**AFK**
- **focus ring** 補回 + 恢復守護測試（T4）；**44pt** hit-slop 全站 + 稽核測試（T5）；**對比 AA** 雙軌 unit+e2e axe（T4）；**VoiceOver** Space 鍵/對話框名/backdrop role（T8）；**reduce-motion** JS scroll 走 `src/lib/motion.ts`（T8）；**axe** 40 頁+75 元件 unit + e2e 全路由，解 chrome mock（T9）；Dynamic Type rem（T6）
- **驗收**：a11y 測試為 **release gate**（比照 #82）。

---

### 緩做 / Out of scope
- 鍵盤全域快捷鍵註冊機制（⌘/Ctrl 跨平台）—— 另立 effort
- ShareLinkModal 全頁重寫（吸收 dark/字級/G9）
- #1118 iOS 26.5 實機驗證 14 項（owner-only HITL）
- 原生專屬（真 haptic / 可 scrub 返回轉場 / Share Target / 背景同步）—— web 做不到
- 品牌保留例外（terracotta tint / Inter / editorial no-glass）—— 不對齊
