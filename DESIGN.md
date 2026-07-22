# Design System — Tripline（V2 柔褐三色）

## Product Context
- **What this is:** 行程共享網站 — 旅伴可以瀏覽精美行程表（時間軸、餐廳推薦、飯店、地圖導航）
- **Who it's for:** 旅伴（家人朋友），非技術人員，旅行中在手機上使用
- **Space/industry:** 旅行行程規劃，偏向個人/小團體（非商業旅遊平台）
- **Project type:** Mobile-first PWA（React SPA + Cloudflare Pages）

## Aesthetic Direction
- **Direction:** Warm editorial — 明信片／旅遊雜誌的暖色排版，cream-paper + 焦糖陶土
- **Decoration level:** Restrained — 靠排版、留白、hairline、柔褐三色（主柔褐 + sage + 粉）支撐畫面，不靠裝飾 SVG
- **Mood:** 旅途上的溫度、紙本旅遊書的安心感。奶油底（`#FFFBF5`）+ 柔褐 焦糖（`#A97A4A`）accent 把行程資訊保持主角，避免 SaaS 冷藍感
- **Differentiation:** 暖調 V2 柔褐三色（主柔褐 + sage 交通 + 粉 活動/收藏；非六主題切換、非冷色 Ocean）、Airbnb 式三層陰影但 rgba 用暖棕（`rgba(42, 31, 24, …)`）、Inter + Noto Sans TC 排版
- **Reference sites:** Airbnb（card + shadow）、Apple HIG（tap target、subheadline）、Anthropic Claude Design 稿（Okinawa Trip Redesign/Mobile）、`docs/design-sessions/mockup-trip-v2.html`（V2 canonical mockup）

> **⚠️ V3 Apple Music 改版進行中（2026-07-17，桌機 React）。** 語意三色（sage 交通 / 粉 收藏活動）**退場**。SoT 轉移到 `trip-planner.flutter/docs/discovery/design.md` §2 + 桌機 mockup `docs/design-sessions/2026-07-15-v3-apple-music-desktop.html`。**Phase 1（v2.55.88）已 ship**：`--color-accent-2/-3` 在 tokens.css 收斂成單一柔褐 accent（全站不再彩虹）+ dark mode 換中性深灰（**v2.56.4 owner「全黑太多、tab 也黑，參考 HIG」→ 整條 iOS system gray 往上抬一階**：base `#1C1C1E`/surface `#2C2C2E`/tertiary `#3A3A3C`/hover `#48484A` + accent `#CBA06E`，取代原近黑 `#121214` 系與下方舊暖褐 dark 表）。**卡片 neutral surface + 去封面/常駐 sidebar/單層 DAY selector 是後續 Phase**——下方三色表為歷史，逐 Phase 改寫。見 memory `project_v3_desktop_redesign`。

## Palette — V2 柔褐三色（canonical source: tokens.css `@theme`）
| Token | Hex | 用途 |
|-------|-----|------|
| `--color-accent` | `#A97A4A` | UI chrome 唯一主色（active state、CTA、link） |
| `--color-accent-deep` | `#8A6038` | hover / pressed |
| `--color-accent-subtle` | `#FBEEE4` | badge bg、selected row |
| `--color-accent-bg` | `#F7DFCB` | accent panel |
| `--color-background` | `#FFFBF5` | page bg |
| `--color-secondary` | `#FAF4EA` | card bg |
| `--color-foreground` | `#2A1F18` | body text |
| `--color-muted` | `#6F5A47` | secondary text |
| `--color-border` | `#EADFCF` | hairline |
| `--color-line-strong` | `#C8B89F` | divider strong |

> **Day palette exception**: 10 色 Tailwind -500（sky/teal/amber/rose/violet/lime/orange/cyan/fuchsia/emerald）**只用於地圖** — map polyline + Map page bottom day strip eyebrow + active underline。對應 Data Visualization 例外。**Trip 明細頁 day strip 嚴守 柔褐主色 accent**（idle eyebrow muted, active eyebrow + underline 用 `var(--color-accent)`），不套 dayColor。理由：多色服務於地圖 N 條線視覺區分需求；trip 明細頁不需要區分多 day，反而 chrome 一致性更重要。

## Typography

### Font Stack
- **Primary:** `Inter` — Web font，400/500/600/700 weight
- **CJK Secondary:** `Noto Sans TC` — 中文字體優先於系統字
- **Fallback:** `"PingFang TC", "Microsoft JhengHei", -apple-system, BlinkMacSystemFont, system-ui, sans-serif`
- **Rationale:** Inter 處理英文、數字、時間、UI label；Noto Sans TC 穩定中文顯示；系統字做最後 fallback
- **Loading:** `<link>` 預連線 + `display=swap`（不阻擋首屏）

### Type Scale

桌機與 compact 使用同一組 font family，但各自有一套角色型字級。所有頁面與元件應吃 token，不直接寫零散 `font-size`。

| Token | Desktop | Compact | Weight | 用途 |
|-------|---------|---------|--------|------|
| `titlebar` | 20px / 28px | 18px / 24px | 700 | Sticky titlebar 單行標題 |
| `page-title` | 28px / 36px | 24px / 32px | 700 | 內容區主標題、行程名稱 |
| `section-title` | 20px / 28px | 18px / 26px | 700 | 內容 section 標題 |
| `card-title` | 17px / 24px | 16px / 24px | 700 | 卡片標題、stop name |
| `body` | 16px / 26px | 16px / 26px | 400 | 主要中文內文 |
| `support` | 14px / 22px | 14px / 22px | 400 | 輔助文字、描述、提示 |
| `footnote` / `support` | 14px / 22px | 14px / 22px | 400 | 介於 body 與 label 之間（chat preview / list meta / micro UI），對齊 `--font-size-footnote`（tokens.css 0.875rem） |
| `label` | 12px / 16px | 12px / 16px | 600 | 表單 label、metadata、chip label |
| `sidebar-item` | 14px / 20px | n/a | 600 | Desktop sidebar nav |
| `bottom-nav-label` | n/a | 11px / 14px | 700 | Compact bottom nav label |
| `eyebrow` | 10px / 14px | 10px / 14px | 600 | 僅用於 uppercase label，例如 `DAY 01` |

### Weight Scale
| Token | Value | 用途 |
|-------|-------|------|
| normal | 400 | body 內文 |
| medium | 500 | 輕強調，少用 |
| semibold | 600 | 按鈕、nav、label |
| bold | 700 | 標題、日期數字、重要卡片標題 |
| heavy | 800 | 不作為中文常規字重；僅限極少數英文品牌字樣 |

### Specialised Patterns
- **Font family:** 桌機與 compact 不換 font family，避免品牌語氣分裂與載入成本增加。
- **Titlebar is chrome:** titlebar 不使用 page-title 字級。桌機 20px、compact 18px 是上限。
- **Chinese body:** 內文不低於 16px；中文行高保持 26px，手機也不壓縮。
- **Letter spacing:** 中文一律 `letter-spacing: 0`。Uppercase `eyebrow` 用 `0.12em`。**Latin uppercase 在 chip / pill / segmented label** 可用 `0.04–0.08em`（純拉丁字 / 數字 / 縮寫如 `DAY 01`、`HOTEL`、`SIGHT`），但中英混排或主要中文字段仍須 `0`。
- **Eyebrow / uppercase labels**：`font-size: 10px; line-height: 14px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase;`
- **Tabular numbers**：時間（16:30）、日期（7/2）一律 `font-variant-numeric: tabular-nums`

## Color

### Approach
**柔褐三色主題（2026-06 改版，tone v2.53）** — 暖奶油底上三色分區：主色柔褐 `#A97A4A`（景點·購物·活動、CTA、active、link、rating）+ 第二色 sage 綠 `#A8BAAA`（住宿·交通·停車、travel pill / connector）+ 第三色玫瑰粉 `#E78C99`（用餐·咖啡、備選、收藏／愛心）。記憶法：玩/看/買=柔褐、住/移動=sage、吃=粉。中性色維持暖奶油底。

行程表套色方式（canonical mockup：`design-sessions/2026-06-06-three-color-trip-theme.html`）：
- **卡片依類型上同色系淡底**：POI 卡 `data-tone`（accent／sage／pink／neutral）→ 對應色 `-subtle` 底 + `-bg` 邊。
- **icon 同色系階梯（ghost）**：卡片 `-subtle` → icon 底 `-bg` → glyph/描邊 `-deep`，同一色相由淺到深、icon 融入卡片，不填滿不洗版。
- **交通 pill 描邊式**：透明底 + sage `-deep` 邊框與文字（取代填滿）。
- 類型標籤文字同步上對應色；備選卡粉底（dark 用加強粉）；CTA 維持柔褐。

參考 mamahoikuen.jp 暖柔三色。完整 4 階色碼見下方 Light/Dark 表 + `design-sessions/2026-06-06-three-color-system.md`。

> **Dark mode 覆寫不得冗餘**：若 base 規則已用 `var(--token)` 且該 token 在 `body.dark` 已有覆寫值，就 SHALL NOT 再寫 `body.dark .class { property: var(--token) }` —— token 值會自動切換，重寫是死碼、且日後改 token 時容易漏掉這份重複。〔遷自已歸檔的 `css-hig-discipline` spec〕

### Light Mode (柔褐三色 — Default)
| Token | Hex | 用途 |
|-------|-----|------|
| accent（柔褐） | `#A97A4A` | 主強調：CTA、active、link、一般 POI icon/卡、rating |
| accent-deep | `#8A6038` | hover / pressed、icon glyph/描邊 |
| accent-subtle | `#F4EDE3` | 卡片淡底、hover、selected row、chip bg |
| accent-bg | `#E9DBC8` | icon 底、卡片邊、badge |
| accent-2（sage） | `#A8BAAA` | 交通：travel pill / connector / 交通類 POI |
| accent-2-deep | `#7E9580` | pill 描邊/文字、交通 icon glyph |
| accent-2-subtle | `#ECF0ED` | 交通卡淡底 |
| accent-2-bg | `#D4DDD5` | 交通 icon 底、卡片邊 |
| accent-3（玫瑰粉） | `#E78C99` | 活動、備選、收藏／愛心 |
| accent-3-deep | `#C66B78` | icon glyph/描邊、活動標籤 |
| accent-3-subtle | `#FAF1F3` | 活動/備選卡淡底 |
| accent-3-bg | `#F2DBE0` | icon 底、卡片邊 |
| background | `#FFFBF5` | page bg（暖奶油） |
| tertiary | `#F2EAD9` | recessed surface、input bg |
| foreground | `#2A1F18` | 主要文字 |
| muted | `#6F5A47` | 次要文字 |
| border | `#EADFCF` | hairline |
| line-strong | `#C8B89F` | 強分隔線、中性 icon 描邊 |

### Dark Mode (柔褐三色 Dark)
| Token | Hex | 用途 |
|-------|-----|------|
| accent（柔褐） | `#CBA06E` | 深色主 accent |
| accent-deep | `#E0BC90` | hover、icon glyph（深色更亮） |
| accent-subtle | `#33271A` | 卡片淡底、selected row |
| accent-bg | `#44341F` | icon 底、卡片邊、badge |
| accent-2（sage） | `#8FBE9C` | 交通 |
| accent-2-deep | `#A8D0B4` | pill 描邊/文字、交通 glyph |
| accent-2-subtle | `#243A2C` | 交通卡淡底 |
| accent-2-bg | `#2E3D30` | 交通 icon 底、卡片邊 |
| accent-3（玫瑰粉） | `#E8A0AB` | 活動、備選、收藏 |
| accent-3-deep | `#F0B8C0` | glyph/標籤（深色更亮） |
| accent-3-subtle | `#4A2A3A` | 活動/備選卡淡底（深色加強粉，避免太暗讀不出） |
| accent-3-bg | `#6B3F52` | icon 底、卡片邊（深色加強粉） |
| background | `#1A140F` | page bg |
| tertiary | `#2E2418` | recessed surface、input bg |
| foreground | `#F5EBDD` | 主要文字 |
| muted | `#B89E84` | 次要文字 |
| border | `#3D2D22` | hairline |
| line-strong | `#5A4634` | 強分隔線、中性 icon 描邊 |

### Semantic Colors
| Token | Light | Dark | 用途 |
|-------|-------|------|------|
| destructive | `#C13515` | `#E8A0A0` | 刪除、錯誤 |
| success | `#06A77D` | `#7EC89A` | 成功、確認 |
| warning | `#C88500` | `#E8B556` | 警告 |
| info | `#3B7EA1` | `#8FB8D1` | 資訊提示；不用 柔褐，避免和 CTA 混淆 |

### Stop Type Color Convention（三色 tone 對應）
POI 類型 → tone，由 `deriveTypeMeta` 決定，驅動卡片同色系淡底 + ghost icon + 類型標籤色：

| tone | 類型 | 色 |
|------|------|----|
| `accent`（柔褐） | 景點 attraction、購物 shopping、活動 activity | `--color-accent-*` |
| `sage`（綠） | 住宿 hotel、交通 transport、停車 parking、移動/開車 drive、步行 walk、飛行 plane | `--color-accent-2-*` |
| `pink`（粉） | 用餐 restaurant、咖啡 café、備選 alternate、收藏／愛心 | `--color-accent-3-*` |
| `neutral` | 休息 rest、未分類 fallback 歸 accent | `--color-line-strong` 中性描邊 |

> v2.53 tone 調整：用餐→粉、住宿→sage、活動→柔褐（café 跟用餐歸粉）。記憶法：**玩/看/買 = 柔褐、住/移動 = sage、吃 = 粉**。
> **展開明細同色**：stop 點開的 `.tp-rail-detail`（景點說明/備註/actions 面板）**自帶 `data-tone`**（它是 `.tp-rail-item` 的 sibling、非後代，繼承不到 item 的 `--tone-*`），背景 + 邊框用該 tone 的 `--tone-subtle/-bg`，與卡片同色系；neutral fallback secondary。travel pill / connector 永遠 sage。
> **tone 套用範圍（v2.54）**：時間軸卡 `.tp-rail-item` + 展開明細 `.tp-rail-detail` + 收藏頁卡 `.favorites-card`（`poiTypeToTone(poiType)` 驅動，因非 `TimelineEntryData`）。**收藏/愛心 affordance = 粉**：ExplorePage `.explore-poi-heart.is-saved` + `.poi-actions button.saved` → `--color-accent-3`（與卡片 tone 無關，永遠粉）。探索卡卡身（`.explore-poi-card`，v2.54.1）依 `poiTypeToTone` 上同色系淡底 + 類型標籤 tone 色。**cover 漸層（v2.54.11）**：從舊的 8 色 hash 裝飾改為**依 POI 類型三色**（`--tone → --tone-deep`，與行程一覽 cover 一致）—— /qa 三色比例稽核發現舊 8 色 cover（5/8 冷色）讓探索整頁像彩虹、非木棕主，故統一回三色。neutral 顯式回 accent。
> **編輯/輸入面（v2.54.2）**：分類選擇器 `CategoryPicker` 每格 tile 帶 `data-tone={poiTypeToTone(type)}`，**選中態**用該分類自己的 tone（picker = 三色 legend，選餐廳亮粉、住宿亮 sage、景點/購物亮柔褐）；加入行程精靈的 POI 摘要框 `.tp-form-poi-summary`（`AddPoiFavoriteToTripPage`）依加收藏 POI 類型上 tone。至此顯示面 + 編輯面皆涵蓋。
> **時間軸時間顯示（v2.55.14）**：timeline 卡 sub-line `.tp-rail-sub-time` 顯示**抵達–離開區間**（en-dash「–」，`formatTimeRange(start, end)`）+ 停留時數 `formatDurationCompact`，例「09:00–13:00 · 景點 · 4 hr · ★4.6」。只有抵達（無 end）→ 顯示單一時間不加區間；只有離開（罕見）→ 顯示離開時間。`endTime` 資料早存於 `trip_entries.end_time`、EditEntryPage 可編、用來算停留時數，v2.55.14 才在 timeline sub-line 把**離開時間絕對值**顯示出來（先前只顯示抵達）。列印行程表 `entry.time` 早已是 `start-end` 合成（`mapDay` composedTime，hyphen），故只改互動 timeline。mockup `tp-stop-v-time` 同步加區間（grid time col 60→88px 容納）。
> **正選細類 label（v2.55.75）**：timeline 卡展開的「景點說明」補上正選（master, `sortOrder=1`）POI 的**細類 label**（`.tp-rail-poi-type`，`poiCategoryLabel(master.category)` → 拉麵/神社/百貨），與 ExplorePage 卡、備選卡同源。**只取細類、不 fallback 粗類 type**：正選已有相鄰的 collapsed row 粗類 badge（`.tp-rail-sub-type` = `deriveTypeMeta`），若再 fallback 粗類會冒出重複回聲；故無 Google `primaryType` 時正選 pill 不顯示（備選卡無相鄰 badge，仍保留 `poi.type` fallback）。**粗類 vs 細類分工**：collapsed row 粗類 badge 驅動三色 tone（景點/用餐，不變）；細類只在展開明細＋探索卡顯示，屬純資訊 label、不影響 tone。修正 v2.30.14「master 升格景點說明」時漏掉細類、導致每日行程頁看不到 v2.55.73 新分類的缺口。

> **就地改起訖時間 + 備選升正選 + 依抵達重排（v2.55.51，mockup `docs/design-sessions/2026-07-10-entry-inline-time-promote.html`）**：
> - **起訖時間 chip（V2）**：sub-line 的時間從唯讀 `.tp-rail-sub-time` 改為可點的 `.tp-rail-time-chip`（柔褐 tonal 膠囊 + pencil；無時間 → 虛線「設定時間」）。點擊 → **portal 浮出**（逃離 `.tp-rail-content` 的 `overflow:hidden` 裁切，`position:fixed` 依 chip rect 定位、z 1000 低於內層 `.tp-time-popover` 1100）小 popup，內含**共用 `TripTimePicker`** 的抵達 / 離開兩欄 + 完成。**存檔於關閉時**（完成 / outside-click）：把 draft 與原值 diff，只送有變欄位、一次 PATCH `/entries/:eid { start_time?, end_time? }`（LWW，同 inline 備註；起訖同批 → 後端只重排一次、不每 pick 一發）。收合狀態亦可改、不必進全編輯頁。**a11y**：sub-line 內含可 focus 的 chip button；若 `.tp-rail-head` 掛 `role="button"`，其子孫依 WAI-ARIA 變 presentational → 吞掉 chip。故 head 保持無語意 `div`（onClick 供滑鼠整列點展），toggle 語意 + `aria-expanded` + 鍵盤 focus 移到獨立 caret `<button>`（`.tp-rail-caret`），chip 為正常曝露的 sibling。popup 為 `role="dialog" aria-modal="true"`；開啟時焦點移入容器（`tabIndex=-1`，否則鍵盤停在 chip、要 tab 過整頁才到 picker），Escape 關閉並存檔、焦點歸還 chip。
> - **備選一鍵升正選**：`.tp-rail-detail` 備選景點卡加「設為正選」鈕（柔褐 tonal，`swap-horizontal` icon，沿用 EditEntryPage `.set-master` 視覺）→ PATCH `/entries/:eid/master { poiId }`（後端 swap sort_order + mark segments stale）。timeline 資料不帶 `entry_pois_version` → **LWW**；需嚴格防丟更新 / 跨區距離提醒走全編輯頁。
> - **依抵達時間重排（後端 `functions/api/_entry_sort.ts::resortDayByArrival`）**：改景點時間（inline 或全編輯頁 PATCH `/entries/:eid`）或**互動新增景點**（POST `/days/:num/entries`、POST `/poi-favorites/:id/add-to-trip`）後，後端依 `start_time` 升冪重排當日 `sort_order`（無時間者殿後、同時間 stable、no-op 早退）。**手動拖曳**（走 `/entries/batch` 顯式 sort_order）與 **bulk 建立**（import / clone / copy）**不觸發**。重排改變相鄰 → 前端 dispatch `entryUpdated` + `requestTravelRecompute` 觸發車程重算。

### 非-POI 頁的分色（categorical / wayfinding 用色）

三色除了上面的 POI 語意用法，也可在**沒有 POI 分類的頁**當「分類辨識」用 —— 每個分類維度穩定對應一個 tone，幫 wayfinding。**注意這是 categorical 用色：同一個 tone 在此的意義 ≠ POI 語意**（例：行程一覽的 `粉` = 某個目的地，不是「吃/收藏」）。這是刻意的 context-dependent 用色，與上面的「Day palette 多色只給地圖」同精神（categorical encoding 的受控例外），不是矛盾。

**行程一覽 — 依目的地三色（v2.54.8，`TripsListPage`）**：行程卡依目的地上 tone，`destinationTone(countries)` 決定：
- 錨定常見國家：**日本=accent 柔褐、台灣=sage、韓國=pink**（沿用 `coverClass` 舊邏輯的 `.includes` + JP>KR>TW 優先序）。
- 其餘國家：deterministic hash → 三色輪替（每國穩定一色、可擴到任何國家、不退化成全 neutral；空/未知 → accent）。
- 視覺（mockup V3「整卡同色」）：cover 用 `--t → --t-deep` 漸層、卡身 `--t-subtle` 淡底、border/hover/選取框/選取點都跟 `--t`、avatar `--t-bg` 底。**字一律 `--color-foreground`/`--color-muted`**（不用 `--t-deep` 當字 —— light mode sage/粉 `-deep` 對 `-subtle` 對比 <4.5:1；色由 cover + 卡底承載）。canonical mockup：`design-sessions/2026-06-07-trips-list-by-destination.html`。
- 取代了舊的 `--color-cover-*` 國家別 cover 漸層 token（jp/kr/tw/other，v2.54.8 移除）。

**AI聊天 — 依角色三色（v2.54.9，`ChatPage`）**：聊天泡泡的 avatar 依「誰在說話」上 tone（mockup V1「輕觸」，只 avatar 上色、泡泡維持中性）：
- **你=柔褐**（`.tp-chat-avatar` base = `--color-accent`，右側、實心）、**AI 助理=sage**（`.is-ai` = `--color-accent-2-bg`）、**共編旅伴=pink**（`.is-other-user` = `--color-accent-3-bg`）。修掉原本 AI 與旅伴 avatar 撞色（都 secondary/foreground）分不出真人/AI 的問題。
- avatar 用 `--t-bg` 底 + `--color-foreground` 字（~7–12:1，light/dark 皆過）—— **不用 vivid `--color-accent-2/-3` 實心**（dark mode 對 foreground 字僅 1.78:1 fail）。canonical mockup：`design-sessions/2026-06-08-chat-tricolor-by-role.html`。

**帳號 — 依設定分區三色（v2.54.10，`AccountPage`）**：設定 hub 每個分區一色，由 `group.tone` 驅動 row icon chip（mockup V1「輕觸」，只 icon chip 上色）：
- **應用程式=accent 柔褐**（外觀/通知，你的偏好）、**共編 & 整合=sage**（連結 app/開發者）、**帳號=pink**（裝置/登出）。語意延伸（user 拍板，sage↔pink 與初版 mockup 對調）。**登出=destructive 紅**（`.is-danger` 覆寫、不混三色）。
- icon chip = `.tp-account-rows[data-tone]` 帶 `--t-bg` 底 + `--color-foreground` glyph（~11–12:1）；tone 規則用 `:not(.is-danger)` 排除登出，讓紅 icon 不被蓋。canonical mockup：`design-sessions/2026-06-08-account-tricolor-by-group.html`。
- **至此非-POI 頁三色收齊**：行程一覽（目的地）+ AI聊天（角色）+ 帳號（分區）。

### Data Visualization 例外

「柔褐三色 accent」原則有 **data visualization 例外**：地圖 polyline、chart series、時間軸 day separator 等 semantic encoding 可用 10 色 qualitative palette（Tailwind `{sky,teal,amber,rose,violet,lime,orange,cyan,fuchsia,emerald}-500`）。UI chrome（button、text、icon、active state）仍嚴守柔褐三色。

**地圖 chrome 子例外：** 在地圖相關頁面（`MapPage`、`TripMapRail`、`OceanMap`）的 **Day 指示 tab active state**（底線色、eyebrow `DAY NN` 文字色），可套用 `dayColor(N)` 作為 visual cueing，與 polyline 同色呼應。適用範圍僅限 Day 指示 tab；其他 chrome（返回鈕、主導航、title、overflow menu）仍嚴守 柔褐。

### 地圖 Polyline 規格（含飯店）

**hotel 是當日 polyline 的起點，必須入線。** 飯店在 timeline 中是出發地（早上從這裡走到第一個 entry）。視覺上飯店圖標若不連上第一條線段，使用者會誤以為「沒有起點」或「飯店是孤立 POI」。

規則：

- **每 day 一段獨立 polyline**：以該日 `pinsByDay.get(N)` 的全部 pins（hotel + entries）按 `sortOrder` 串接。`extractPinsFromDay` 已把 hotel 排在 `sortOrder` 最小（index=0），自然成為線首。
- **跨 day 不連線**：避免「飯店 A → 餐廳 → 飯店 B」這種視覺上不合理的長線。
- **單 trip 內 polyline 同色**：在 `OceanMap` 是單 trip 的 dayColor(N) 漸層；在 `GlobalMapPage`（cross-trip）每 trip 一個顏色，當天的線段共用該 trip 的色。
- **hotel marker 樣式不變**：仍用 ink 類 stop 顏色（per Stop Type Color Convention），只有 polyline 把它包進來。
- **hotel 缺座標時**：略過該日線首的 hotel 段，從第一個 entry 開始接，不報錯。

實作位置：`OceanMap`（per-trip overview）、`GlobalMapPage`（cross-trip 全域）。`MapPin.type === 'entry'` 不再做 polyline 的入線過濾條件 — 改用 day-grouped 全 pins。

## Spacing

### Base Unit
4px grid — 所有間距為 4 的倍數。

**Micro-spacing 例外**：chip / pill / icon-button 的 inner padding 可用 `6 / 10 / 14 / 18px` 等非 4-grid 值，因為這些元素的 typography（11-13px font + line-height）需要 fine-tuned padding 達到視覺均衡，硬套 4-grid 反而 padding 過鬆或過緊。例外限定 inner padding，外層 gap / margin 仍守 4-grid。

### Scale
| Token | Value | 用途 |
|-------|-------|------|
| half | 2px | 微調 |
| 1 | 4px | 最小間距 |
| 2 | 8px | 元素內 padding、titlebar gap |
| 3 | 12px | 小間隔、titlebar vertical padding |
| 4 | 16px | 標準 padding（= padding-h） |
| 5 | 20px | hero 內 padding（mobile） |
| 6 | 24px | section gap、body grid gap |
| 8 | 32px | hero horizontal padding（desktop） |
| 10 | 40px | desktop chrome horizontal padding |
| 12 | 48px | nav 高度 |
| 16 | 64px | 極大間隔 |

### Key Layout Measurements
| Token | Value | 用途 |
|-------|-------|------|
| padding-h | 16px compact / 24px desktop | 標準頁面水平 padding |
| tap-min | 44px | 最小觸控目標（Apple HIG） |
| page-max-w | 1440px | 桌面頁面最大寬 |
| content-max-w | 1040px | 一般內容頁最大寬度；地圖頁例外可 full bleed |
| info-panel-w | 320px | 桌面版側邊資訊欄參考寬度 |
| titlebar-h | 64px desktop / 56px compact | sticky page header 高度 |
| bottom-nav-h | 72-88px | compact bottom nav 高度，含 safe-area padding |
| day-chip-w | 160px | Day chip 寬度（desktop）、140/130 遞減 |
| stop-time-col | 68px | stop card 時間欄寬 |
| stop-icon-box | 48px | stop card icon 方塊（desktop） |
| fab-size | 56px | QuickPanel FAB |

## Layout

### Unified App Shell
> **⚠️ rev2 owner 2026-07-19（桌機 macOS sidebar，§10.1；mockup `docs/design-sessions/2026-07-19-rev2-desktop-macos-sidebar.html` sign-off）**：桌機 primary nav（聊天/行程/地圖/收藏）**搬回左欄 sidebar 頂部**（macOS Music/Mail 形制），**桌機隱藏底部浮動玻璃膠囊**（`AppShell` @≥1024 `.app-shell-bottom-nav display:none`）。sidebar 結構＝品牌 → **4-tab 主導覽** → 「我的行程」清單 → 帳號 chip 左下。**sidebar 材質改 vibrancy 半透明毛玻璃**（暖奶油：`color-mix(--color-background 72%)` + `backdrop-filter: blur(30px)`，走主 app token 自動 light/dark adapt，取代舊固定深棕 `--color-sidebar-*`）。primary IA + active 判定抽到 `navItems.ts` 單一來源（`GlobalBottomNav` 手機膠囊 + `DesktopSidebar` 共用，無漂移）。三欄 grid `216px 1fr 1fr`（`--grid-3pane-desktop`）。
- **Primary IA:** 聊天 / 行程 / 地圖 / 收藏 / **帳號** —— **5-tab**（單一來源 `navItems.ts` `PRIMARY_NAV_ITEMS`，手機膠囊與桌機 sidebar 共用）。**桌機（≥1024）：primary nav 在左欄 sidebar 頂部**（§10.1，另有「我的行程」清單與左下 account chip）；**手機（<1024）：底部浮動玻璃膠囊**（`GlobalBottomNav`）。
  - ⚠️ **帳號入口去重（2026-07-23 owner 裁定）**：帳號**保留為第 5 個 tab**（iOS HIG tab bar 語意：持久、可預測的目的地）。手機 header 右上的 `AccountCircle` 圓圈**判定退場** —— 它與帳號 tab 重複、且只有 30×30（低於 44pt）。〔`navItems.ts` 的舊註解「圓圈移除後帳號沒入口才加 tab」是寫在移除發生前；圓圈實際從未移除，仍掛在 5 頁。**code 移除另開 PR**，本輪只更正規範。〕
- **Operation drill-down（rev2，v2.55.97）:** 操作頁（見上 Operation stacking）桌機右欄 panel + **手機全頁下鑽**都用共用 `StackPanelHeader`（`‹` 前一頁 / `✕` 整個關閉，iOS Apple One `.dd-top`），非 TitleBar。完成鈕一律走 children 內 `.tp-page-bottom-bar`。「探索」自 v2.21.0 起降為 `/favorites` 頁右上 secondary action（ghost variant），保留路由 `/explore` 為次要 entry。`/explore` TitleBar 含**左側返回 button**（v2.23.7）→ `/favorites`；history-aware fallback `/favorites`。
- **Desktop shell（rev2 §10.1）:** 三欄 `216px 1fr 1fr` — 左欄 **macOS sidebar**（vibrancy：品牌 → 4-tab 主導覽 → 我的行程清單 → 帳號 chip 左下）｜ 中欄行程 ｜ 右欄地圖 + 堆疊面板；**桌機無底部膠囊**（primary nav 在 sidebar）。
- **子頁 toolbar 返回（rev2 §10.5）:** collab / explore 等從某頁進入的子頁，`TitleBar` 用 `backLabelVisible` → macOS toolbar 式「`‹` <backLabel>」可見文字返回（chevron + accent 文字，`.tp-titlebar-back--labeled`）；行程詳情維持 icon-only 44×44 back（`backLabelVisible` 預設 false）。
- **表單頁桌機滿寬（rev2 §10.4）:** account 設定分區桌機 2-col grid（`.tp-account-groups` @≥1024，hero 收窄置中）；new-trip 桌機加寬（線性表單不 full-bleed）。
- **Compact shell:** sticky page titlebar + right-side hamburger menu + bottom nav。**底部 tab 常駐，捲動不隱藏**（owner 2026-07-20 / 07-21 兩次要求；捲動隱藏的 scroll-direction 邏輯已於 2026-07-21 整個移除，見 `AppShell.tsx:232`）。
- **Header rule:** 所有主功能頁 titlebar 一律 sticky；桌機與 compact 都是單行標題，不放 eyebrow、meta、helper text。
- **Map exception:** 地圖頁可 full bleed，仍保留統一 sidebar / titlebar / bottom nav 行為。
- **Trip detail DayNav:** sticky 在 titlebar 下方，**常駐不隨捲動隱藏**（與 bottom nav 同 2026-07-21 決策）。
- **Trip detail source:** 行程明細頁 desktop / compact 必須共用同一個內容結構與狀態來源；只允許外層 layout responsive，避免兩套明細頁造成行為與 UI 漂移。
- **Operation stacking（rev2，v2.55.96）:** 6 條操作流程（加景點 / 新增 / 複製移動 / 換景點 / 編輯景點 / 編輯行程）在**桌機（≥1024）以右欄堆疊面板**呈現、**不是整頁**：`TripStackLayout`（pathless layout route，包 6 條操作路由）render 三欄 host（sidebar｜`<TripPage noShell>` 中欄行程詳情｜右欄 sheet = 操作面板），操作面板走 `OperationShell` bare 形態（`StackPanelHeader` = `‹` 前一頁 / `✕` 整個關閉），中欄詳情 context 全程保留。**堆疊層級語意（rev2 F9，mockup `layer.l2/l3`）**：桌機**第一層**（從 timeline / ⋯ menu 進的操作，L2 modal）**只給右上「✕」關閉、不給「‹」**；**從另一操作 push 進來**（如 編輯景點 →「變更景點」，L3+）才左上「‹」回前頁 + 右上「✕」。操作是 route-swap（`SheetStackContext` 只有 `inStack` boolean、無真 component stack），故靠 `navigate` 帶 `state.depth`（L3 push 時 +1；EditEntry→ChangePoi 帶 depth:2）標記層級；`OperationShell` 的 `showBack = !inStack || depth>1`（手機全頁下鑽一律 ‹+✕）。**‹ 的 Back 語意（G-S1「Back moves one level」）**：`depth>1` → `navigate(-1)` 退回上一操作頁（委派瀏覽器 history，與 back/forward 同步）；`depth≤1`（手機 L2 / deep-link 冷啟）→ 頁自帶 explicit `back`（回 trip，**不** navigate(-1) → 不踢出 app；depth gate 避開 v2.33.139 移除 blanket navigate(-1) 的 footgun）。`✕`=closeStack 回 trip。**`StackPanelHeader` ‹/✕ 皆 44pt**（G-H6a HIG 觸控區）。**手機（<1024）維持整頁 drill-down**（`OperationShell` render `AppShell + TitleBar`）。URL 不變（`/trip/:id/*`），deep-link 不破。
  - **手機的堆疊層級語意（2026-07-23 補齊；原本此段只規範桌機）**：手機不像桌機能「第一層只給 ✕」—— 因為整頁下鑽時使用者需要一個明確的返回。現況是 `showBack` 在手機恆真（‹ 與 ✕ 都顯），但**10/11 條操作路由的 ‹ 與 ✕ 落在同一個目的地**（都回 `/trips?selected=:id`，只差 push/replace），兩顆鈕語意無法區分。**判定為落差**（wayfinder map #1110，P0-5）：手機第一層應收斂為單一返回鍵（回行程詳情），只有從另一操作 push 進來（depth>1）才同時給「‹ 回上一操作」與「✕ 回行程」。**本輪只立規範，收斂實作屬後續變更**（會牽動 `OperationShell` 的 `showBack` 與各頁 explicit `back`）。新操作頁一律用 `OperationShell` 取代 hardcode `<AppShell>+<TitleBar>`，並把路由掛進 `TripStackLayout` group 才會有右欄堆疊行為。`.tp-page-bottom-bar` 在 sheet 內須 `sticky`（非整頁 `fixed`）以收進 panel 寬度。

### Content Width
- **Standard pages:** content wrapper `max-width: 1040px; margin-inline: auto; padding-inline: 24px` on desktop。
- **Compact pages:** full width + `16px` horizontal padding，並保留 bottom nav safe-area padding。
- **Avoid page-local widths:** chat / itinerary / explore / account 不再各自使用 `720/920/960px` 外層寬度；局部卡片或表單可在內部自行限制。
- **Map pages:** 地圖 canvas 和 map tool surface 例外，可占滿 shell available width。

### Responsive Model
| Mode | Rule | 版型 |
|------|------|------|
| compact | default | 手機與平板共用：titlebar + hamburger + bottom nav |
| desktop | `@media (min-width: 1024px) and (pointer: fine)` | 桌機（rev2）：三欄 `216 / 1fr / 1fr` — 左欄我的行程清單 sidebar + 底部浮動玻璃膠囊 nav（primary nav 已由 sidebar 移膠囊） |

不再維護 tablet-specific 斷點。任何不是 `min-width: 1024px` 且 `pointer: fine` 的環境都走 compact。

### Border Radius
| Token | Value | 用途 |
|-------|-------|------|
| xs | 4px | input、極小元素 |
| sm | 6px | 按鈕、小 icon box |
| md | 8px | 卡片（stop card、side card）、day chip |
| lg | 12px | hero、sidebar card |
| xl | 16px | 大型 panel（day-header fallback） |
| full | 9999px | FAB、pill |

## Material & Effects

- **Glass:** Titlebar、bottom-nav、sheet 統一使用 `backdrop-filter: blur(14px)`（`--blur-glass: 14px`）。三層 glass 元素保持一致強度，避免不同 blur 強度造成視覺雜亂。Sheet 不加 `saturate(1.8)` — 對齊 editorial clean direction，去除色飽和增強。不再給 timeline card 用（設計稿強調乾淨、無模糊）。**Small floating button 例外**：≤32px 的浮動按鈕（POI 卡 cover 漸層上的 `+ 加入` / `⋯` menu / `❤ 收藏 toggle`）可用 `blur(6px)` — 14px blur 在小元素上會 over-soften 邊緣，6px 給更 proportional 的玻璃感。**扁平卡（無 cover 圖）的 `⋯` 例外**（`TripsListPage` 行程卡 `TripCardMenu`）：**不做玻璃圓** — resting 透明只留字符、hover/focus 才淡底（44px tap 區保留）。實心玻璃圓在奶油卡上與卡片圓角相撞、像貼紙破版；扁平卡無 cover 需要對比，故走 iOS HIG 卡片 more-menu 輕觸慣例，對齊 `TimelineRail` 的 `.tp-rail-menu-trigger`（rev2 D-review 2026-07-18）。**桌機 sidebar vibrancy 例外（§10.1，2026-07-19）**：`DesktopSidebar` 是 macOS **vibrancy 材質**（非 chrome glass），用 `blur(30px) saturate(180%)` — 比 14px chrome glass 重，對齊 macOS NSVisualEffectView sidebar 材質的深毛玻璃感，屬刻意差異、不受 14px 一致性規則約束。
- **Photos（v2.55.78）：全站不做 POI 照片 / artwork / 縮圖。** `pois.photos` **從未有過任何資料** —— 0038 規劃的 Wikimedia backfill 從未執行（該 script 不存在），且從來沒有任何寫入路徑（`functions/api/pois/[id].ts` 的 `ALLOWED_FIELDS` 不含 photos），所以它與 POI 筆數無關、恆為 NULL。欄位本身由 migration 0086 DROP（**分開的後續 PR** —— CI 在 push 命中 `migrations/**` 時會自動 apply 且常搶在 CF Pages 部署之前，故 DROP 必須晚於「不再引用 photos 的 code」上線；該檔載有帶日期的實測數字與完整順序說明）。POI 卡的 `.explore-poi-cover` 是**依類型三色的漸層佔位**（v2.54.11，實作見 `ExplorePage.tsx` 的 `.explore-poi-cover`：`<div aria-hidden>` + `linear-gradient`，無 `<img>`），不是照片，不要當圖片容器用。要重開照片：Google Places API 的 `places.photos` 欄位本身不加價（現有 field mask 已含 Enterprise tier 的 `places.rating`），但**取圖是獨立計費的 Place Photos SKU，且不在 `scripts/lib/google-maps-quota.js` 的 FREE_CAP / PRICE_PER_1K 監控表內** —— 開之前先補監控，否則花費不可見。
- **Shadow specialized 例外**：地圖 markers 的 active state ring + drop shadow 可用 inline 多層 shadow（如 `0 0 0 4px rgba(217,120,72,0.3), 0 4px 12px rgba(42,31,24,0.45)`），因為 marker 浮在地圖背景上需要更強對比，token 三層 shadow 過弱。例外限定地圖 marker，其他 UI 一律用 token。
- **Shadow scale（Airbnb 三層）：**
  | Token | Value | 用途 |
  |-------|-------|------|
  | sm | `0 1px 2px rgba(0,0,0,0.04)` | 微妙抬升（input、chip） |
  | md | `0 6px 16px rgba(0,0,0,0.08)` | 卡片 |
  | lg | `0 10px 28px rgba(0,0,0,0.12)` | 浮層、toast、sheet |
- **Focus ring:** `0 0 0 2px accent` — 鍵盤導航可見性
- **Hairline borders:** `1px solid #EADFCF`（light）/`1px solid #3A3127`（dark）取代重邊線。卡片區分用 border 而非 shadow。

## Motion
- **Approach:** Intentional — Apple 風格流暢動效，不花俏但有質感
- **Easing:**
  - Apple curve: `cubic-bezier(0.2, 0.8, 0.2, 1)` — 標準 UI 過渡
  - Spring: `cubic-bezier(0.32, 1.28, 0.60, 1.00)` — sheet 開啟、彈性效果
  - Sheet close: `cubic-bezier(0.4, 0, 1, 1)` — 快速收合
- **Duration scale:**
  | Token | Value | 用途 |
  |-------|-------|------|
  | tap | 80ms | 按壓回饋 |
  | fast | 150ms | 微互動（toggle、hover、day chip） |
  | nav-fade | 200ms | 導航元素淡入淡出 |
  | normal | 250ms | 標準過渡 |
  | slow | 350ms | 入場動畫、skeleton |
  | sheet-close | 280ms | sheet 收合 |
  | indicator | 350ms | 指示器移動 |
  | sheet-open | 420ms | sheet 展開 |

## Components

### Page Titlebar（`TitleBar`）

唯一 page chrome primitive。所有 page（主功能 / settings 子頁 / form 全頁）皆用 `<TitleBar>`。

**幾何**
- Desktop ≥761px: height 64px / padding 0 24px / title 20px / 700
- Compact ≤760px: height 56px / padding 0 16px / title 18px / 700
- Sticky top 0 + glass blur 14px + 1px bottom hairline border
- Title ellipsis (`white-space: nowrap; overflow: hidden; text-overflow: ellipsis`)

**結構**
- 主功能 root (`/chat` `/trips` `/map` `/favorites` `/account`):
  - 左側: 無 back button
  - 中間: page identity (「聊天」/「行程」/「地圖」/「收藏」/「帳號」)
  - 右側: optional action (e.g.「+ 新增行程」/「探索」)。`/favorites` 頁右上 = `.tp-titlebar-action` ghost variant 「探索」（icon: search）→ navigate `/explore`。
- 第二層 (settings 子頁 / 從某頁進入的獨立子頁如 collab / explore):
  - 左側: 36×36 chevron-left back button + `aria-label`（或 §10.5 的 labeled 返回）
  - 中間: page identity (「共編設定」/「探索」)
  - 右側: optional primary confirm action (「儲存」/「完成」)
  - ⚠️ **操作面板（編輯行程 / 加景點 / 換景點…）已不走這套** —— 它們改用 `StackPanelHeader`（`‹` 前一層 / `✕` 整個關閉，兩者皆 44pt、無右側 confirm slot、完成鈕走 children 內 `.tp-page-bottom-bar`），見上「Operation stacking / Operation drill-down」段。此處「第二層 = form 全頁」的舊描述僅適用**未納入 `TripStackLayout` group 的獨立子頁**；納入 group 的操作以 Operation stacking 段為準（2026-07-23 標註分界）。

**Action button (`.tp-titlebar-action`)**
- 唯一合法 class，禁止自製 ad-hoc class
- **Ghost icon button family**：無 border、透明底、hover 出 `--color-hover` + accent text。對齊 Apple HIG / iOS toolbar 慣例，跟 `.tp-titlebar-back` 同 family。
- 兩 variant: default ghost / `.is-primary` accent filled (CTA 強調用，Tracerocta 實心)
- 桌機: rounded rect (radius-md 8px) + icon + 文字 label
- 手機: square 44×44 + radius-md + icon-only (label hidden via `.tp-titlebar-action-label` @media)
- 44×44 min tap target
- 多 action 水平排列, `.tp-titlebar-actions` wrapper, gap 6px

**Button family radius 統一規則**
所有 TitleBar button (含返回 / icon trigger / action) **一律 radius-md (8px)** — 不用 radius-full pill。

**全 TitleBar button class** (都 ghost、無 border、44×44 min tap)
- `.tp-titlebar-back` — 左側返回 button, 44×44 ghost icon
- `.tp-titlebar-action` — 右側 action (icon + 文字 / mobile icon-only)，可加 `.is-primary` 變實心 accent CTA
- `.tp-titlebar-icon-btn` — OverflowMenu kebab trigger, 44×44 icon-only ghost
- `.tp-titlebar-trip-picker` — Chat/Map「切換行程」 picker，v2.31.47 起 icon + chevron only（拔掉 trip name span 避免跟 TitleBar title 重複；dropdown rows 仍顯每個 trip name）, radius-full pill shape
- 漢堡選單 (TripsListPage embedded EmbeddedActionMenu) 直接複用 `.tp-titlebar-action`，不再有獨立 `.tp-embedded-menu-trigger` class

**Sub-content 規則 (TitleBar 下方)**
- eyebrow + meta: 用 `.tp-page-eyebrow` + `.tp-page-meta` inline 在 TitleBar 下方第一行 (settings/list page 資訊密度需求)
- Sub-toolbar (DayNav, day tab strip 等): 可緊貼 TitleBar 形成 sticky chrome group, 但須是獨立 sticky element 不影響 TitleBar height
- Content section: 16-24px top buffer

**Layout container 規則 (parent of `<TitleBar>`)**
- 用 grid `grid-template-rows: auto 1fr` (chrome auto + main 1fr) 為標準 pattern
- 或 flex column + content child 明確 `flex: 1 1 0` 撐滿剩餘空間
- 不可 flex column without explicit child flex behavior — 會 squeeze TitleBar 到 children min-size

### Desktop Sidebar（`DesktopSidebar`）
- 只在 desktop mode 顯示。
- **rev2 owner 2026-07-19（§10.1）：macOS sidebar** — 由上而下＝品牌 → **4-tab 主導覽**（聊天/行程/地圖/收藏）→ 分隔線 → **「我的行程」清單**（`useMyTrips` 注入 `/api/trips?all=1`）→ 帳號 chip 左下 → `/account`。桌機底部膠囊隱藏後，primary nav 回到 sidebar 頂部。主導覽 active 用 accent 實心 fill；清單項連 `/trips?selected=<id>`，active trip（URL 推導）套 accent。
- 清單狀態：`trips===undefined` → skeleton（不先渲染空態）；`[]` → 「尚無行程」；有資料 → 逐行 `.tp-trip-item`。
- Auth loading 不預設成匿名狀態：userinfo 尚未 resolve 時，底部帳號區只保留 neutral loading chip；不得先顯示「登入」「未登入」或 account chip 後再切換。
- Primary nav 順序（聊天 / 行程 / 地圖 / 收藏）+ active route patterns 由 `navItems.ts`（`PRIMARY_NAV_ITEMS` + `isItemActive`）單一來源掌管，`GlobalBottomNav`（手機膠囊）共用同一份；nav testid＝`sidebar-nav-<key>`（vs 膠囊 `global-bottom-nav-<key>`）。
- **材質＝vibrancy 半透明毛玻璃（§10.3）**：`background: color-mix(in srgb, var(--color-background) 72%, transparent)` + `backdrop-filter: blur(30px) saturate(180%)`；文字/hover/border 走主 app token（`--color-foreground`/`--color-muted`/`--color-hover`/`--color-border`）→ 自動 light/dark adapt。舊固定深棕 `--color-sidebar-*` token 已退役（無其他 consumer）。
- Active state 用 柔褐 accent；其餘用 cream `rgba(255,251,245,.78)`。
- `/trip/:id/map` 與 `/trip/:id/stop/:eid/map` active item = 地圖；其他 `/trip/:id/*` active item = 行程。
- 不和 page titlebar 重複放頁面說明文字。

### Compact Bottom Nav（`GlobalBottomNav` / `BottomNavBar`）
- 只在 compact mode 顯示，IA 與 desktop sidebar 同步（同一份 `navItems.ts`）。
- **常駐，捲動不隱藏**（owner 2026-07-20 / 07-21；捲動隱藏邏輯已於 2026-07-21 移除）。
- 高度需包含 safe-area inset，頁面內容必須留出底部 padding。
- Bottom nav 是主功能定位，不是 breadcrumb。子頁與明細頁 active item 依所屬主功能決定，不新增子頁 tab。
- Active item 使用不同於 CTA 的定位樣式：柔褐 淡底 pill + 2px top indicator + accent icon/label；inactive 保持 muted。

| Route family | Active bottom nav |
|--------------|-------------------|
| `/chat`、聊天明細 | 聊天 |
| `/trips`、行程列表、行程明細、新增行程 | 行程 |
| `/map`、行程地圖、全域地圖 | 地圖 |
| `/favorites`、`/favorites/:id/add-to-trip` | 收藏 |
| `/explore`、探索結果、POI 詳細 | 收藏（active 同步「收藏」，via `additionalActivePatterns: [/^\/explore/]`）|
| `/account`、connected apps、developer apps | 帳號 |

### Day Nav (Trip Detail + Map page 共用視覺)

Trip detail 與 Map page 共用同一個 underline tab primitive — `<MapDayTab>` 元件 + `.tp-map-day-tab*` CSS family。Trip detail 透過 `<DayNav>` wrapper 加上 sticky modifier；MapPage 直接用 plain wrapper（黏在底部 card-rail 上方）。

**Tab 規格 (`.tp-map-day-tab`)**
- text-only (eyebrow + date)，無 chip background fill / border
- Eyebrow: `DAY 01` — **Map page** 套 per-day color (`dayColor(dayNum)` from `src/lib/dayPalette` — 10-tone Tailwind -500 palette)；**Trip 明細頁** 不傳 `dayColor` prop，用 default token (idle muted, active accent)
- Date: 14px / 600 weight, `color-foreground` (active 套 accent color)
- Active state: 2px `border-bottom`-color — **Map page** 用 `--day-color` inline override (per-day color underline)；**Trip 明細頁** 用 `var(--color-accent)` (柔褐主色)
- Idle: muted text + transparent border-bottom
- Hover (idle): `color-foreground`
- 36px min height (扁平 strip — 不搶佔垂直空間，對齊 mockup S20)
- Today marker: eyebrow 文字後綴「· 今天」（不是另一個 pill）

> **Day color 規範**：Map page 內 chrome (day strip eyebrow + underline + entry card num + entry card eyebrow) 套 dayColor 服務於「N 條 polyline 視覺區分」需求；Trip 明細頁 chrome 嚴守 柔褐主色 accent — 多色不溢出地圖 context。詳見上方「Day palette exception」。

**Strip container (`.tp-map-day-tabs`)**
- 共用 wrapper：horizontal scroll + scrollbar hidden + glass blur 14px
- Trip detail 加 modifier `.tp-map-day-tabs--sticky`：position: sticky, top: 64px (desktop) / 56px (compact)，緊接 TitleBar 形成 sticky chrome group，僅加底邊 hairline（不加水平 mask 漸層 — 視覺干擾）
- 錨點 #dayN 跳轉：`.ocean-hero { scroll-margin-top: 110px (desktop) / 100px (compact) }`，避免目標被 sticky chrome 蓋住
- TripPage 的 `.ocean-page` 桌機 top padding = 0（讓 sticky day strip 緊貼 TitleBar 無空隙）；mobile 已是 0
- MapPage 不用 modifier：top border 當作底部 card-rail 上邊界，自然 stack 在頁面 flex column
- TripPage 內 `<TitleBar>` 已 sticky top:0，`<DayNav>` 設 top:64/56px → 兩者凍結頂部成 sticky chrome group

### Trip Detail Page
- Desktop / compact 共用同一份 `TripDetail` 內容樹：DayNav、stop list、住宿、交通、地圖摘要、錯誤訊息、空狀態都不可拆成兩套邏輯。
- Desktop 只增加 sidebar、較寬 content、可選的輔助欄；compact 只改成單欄、hamburger、bottom nav。
- 所有資料來源、mutation、loading/error state 必須共用，確保手機與桌機功能一致。

### 桌機三欄操作堆疊（`TripStackLayout` + `OperationShell`）

owner 2026-07-18「6 條全接」+ 2026-07-21「桌機三欄 shell panel 化」。所有「從行程詳情鑽進去的操作／設定頁」共用同一套 host（`/trip/:tripId/*` 下 pathless layout route `TripStackLayout`）：

- **涵蓋路由**：編輯行程 / 加景點 / 新增景點 wizard / 複製 / 移動 / 換景點 / 編輯 entry（既有 6 條）+ **共編設定 / AI 健檢 / 行程筆記**（v2.57.x 遷入）。
- **桌機（≥1024px）**：3 欄 —— sidebar｜中欄（`TitleBar` 行程名稱 + 返回 ｜ `<TripPage noShell>` 行程詳情）｜右欄 `OperationShell` bare panel（共用 `StackPanelHeader`：`‹` 前一頁 / `✕` 整個關閉）。中欄 TitleBar 的「返回」與右欄「✕」同語意，都導回 `/trips?selected=:id`。
- **手機（<1024px）**：`OperationShell` render 自己整頁（`AppShell` + `StackPanelHeader`，無 TitleBar）；共編設定/AI 健檢/行程筆記這 3 頁另帶 `GlobalBottomNav`（`OperationShell` 的 optional `bottomNav` prop —— 既有 6 條操作路由手機版本來就無底部 tab，維持不變）。
- **已知取捨**：從 `/trips?selected=X`（`TripsListPage` 內嵌行程檢視）導覽進任一條堆疊路由，仍會切換到不同頂層 route（`TripsListPage` unmount，`TripStackLayout` 掛一份新的 `<TripPage noShell>`）—— 不是同一個 component instance 保留，而是「沒有整頁 reload、中欄 header 全程可見、行程資料重新抓一次」。
- Mockup：`docs/design-sessions/2026-07-21-desktop-third-column-panelization.html`（2026-07-21，待 owner sign-off）。

### Form Pages

複雜 form 流程必走全頁 + TitleBar shell，不用 modal。

**Routes**
- `/trips/new` — 建新行程
- `/trip/:id/edit` — 編輯行程
- `/trip/:id/add-stop?day=N` — 加景點
- `/trip/:id/stop/:eid/edit` — 編輯景點
- `/trip/:id/stop/:eid/(copy|move)` — 複製/移動景點到其他日
- `/developer/apps/new` — 建 OAuth client

**Page 結構**
- Shell: AppShell (sidebar desktop / bottom nav compact)
- Titlebar: sticky `<TitleBar>` + 返回 + 單行標題 + 右側 primary action
- Content: form-first single-column, `max-width: 1040px`
- 取消/送出 actions: TitleBar primary action + bottom sticky bar (取消 / 確認) 對稱
- Mobile: full-width, page bg (不是 backdrop overlay)
- Desktop: content max 1040px 置中

**禁止**
- Modal backdrop / portal 浮層
- 大型 split hero / 形象圖
- Loading 蓋住 page (改用 `<PageErrorState>` 或 inline skeleton)

**EditEntryPage（編輯景點）欄位順序（v2.55.x）**
- 由上而下：**起訖時間**（最上）→ **說明**（全寬 textarea，緊接時間下方）→ POI 正選卡（分類 / per-POI 備註 / 置換）→ 備選清單 → 從上一站移動方式 → 刪除停留點（danger）。
- 起訖時間 `TripTimePicker` 開 `clearable`：popover 底部「清除時間」把值設回空 → `start_time`/`end_time` 寫 `null`。空值合法（未定時段的停留點），validation 只在非空時檢查格式與先後。
- **說明** = entry-level 自由文字（`trip_entries.description`，AI 規劃時生成，例「放好行李休息一下，準備晚餐出門」）。autosave PATCH `/entries/:eid { description }`；純空白 → `null` 清除。與 per-POI 備註（`trip_entry_pois.note`）分屬不同層級、並存不重疊。

### AI Authorize Card（`tp-ai-card`，v2.55.66）
- NewTripPage 建立行程表單內的就地 AI 授權卡（Phase 2 V1）：讓 owner 授權 Tripline AI（`tripline-tp-request`）以自己身分排行程。先前只有 Ray 有 Consent → 其他 owner fail-closed 用不了 AI，此卡讓每位 owner 就地授權。
- **卡片**：`--color-accent-subtle` 底 + `--radius-xl`，無框線。左 38px 柔褐 badge（`--color-accent` 底、白 sparkle SVG、`--radius-lg`）+ 標題（15px/700 `--color-foreground`）+ 說明（13px `--color-muted`）。
- **未授權**：全寬「授權 AI」鈕（`--color-accent` 實心、`--color-accent-foreground` 字、`--radius-lg`、min-height 44px）。
- **已授權**：綠色確認列（`--color-accent-2-subtle` 底 + `--color-accent-2-deep` 字 —— sage tone =「已生效／無需再動作」）+ checkmark SVG +「已授權 · 可隨時在『已連結應用』撤銷」。撤銷走帳號設定既有 revoke，不在卡上放撤銷鈕。
- **機制**：Approach B 直接 session 授權（`POST /api/account/ai-authorization` upsert Consent），非 OAuth redirect dance；機器 client 不開 web redirect_uri、不簽 auth code。讀狀態失敗 fail-open 當未授權（顯授權鈕、不卡建立流程）。
- Mockup：`docs/design-sessions/2026-07-11-tp-request-consent-trigger.html`（sign-off 2026-07-11，選 V1 就地卡片；V2 送出對話框 / V3 建立後獨立頁未採用）。

### AI Consent Sheet（`tp-consent-sheet`，v2.55.77）
- ChatPage 送出時的就地授權 sheet：**補 NewTripPage 授權卡沒涵蓋的入口** —— 一個「行程已存在、直接用 AI 聊天問」的 owner，在「帳號 → 已連結應用」只找得到撤銷、沒有授權入口（該頁空狀態只提示 Sign in with Tripline）。送出訊息 = 建 `trip_request`；owner 若未授權，後端 `mint-restricted` 簽不出 owner token，該請求永遠 mint 失敗、卡住整條佇列（peek `sort=asc` 每輪撈同一筆）。此 sheet 在送出當下就地問要不要授權。
- **觸發**：送出時 `GET /api/account/ai-authorization` 為未授權 → 攔下、不建請求、跳 sheet（`aiAuthorized===false` 才攔，**含 GET 讀取失敗 fail-closed 成 false**——與 AiAuthorizeCard 一致、可從 sheet 授權復原；`null`＝授權狀態載入中的數毫秒窗才放行，後端 mint 為最終關卡）。
- **形態**：底部跳出 sheet（sign-off variant B；A inline 卡 / C fullpage 步驟未採用）。`--color-background` 底、`22px 22px 0 0` 圓角、grip handle。內含**沿用 `tp-ai-card` 視覺**的授權卡（柔褐 badge + 標題 + 說明）+ 送出訊息引用預覽（`--color-background` 底 + `--color-border` 框）。
- **動作**：全寬「授權並送出」（`--color-accent` 實心）→ `POST /api/account/ai-authorization` upsert Consent → 續送原訊息；「取消」（ghost）→ 不建請求、保留輸入。Escape／點背景＝取消；授權進行中 disable 主鈕（顯「授權中⋯」）並鎖背景點擊防誤取消。
- **後端防禦（非 UI）**：`mint-restricted` 遇 `no_consent` 把該 request park 成 `failed` + 寫授權指引 reply（peek 只撈 open/processing → 跳過），確保單一未授權請求不會永久卡死佇列。沿用既有 `failed` status（0049 CHECK 值域）→ 免 migration。並把 `POST /api/requests` 的 30 秒去重加 `status IN ('open','processing')` 濾網 —— 否則 owner 授權後重送同一訊息會在 30 秒內撞回剛 park 的 `failed` 請求、看似又失敗（adversarial F1）。
- Mockup：`docs/design-sessions/2026-07-15-chat-consent-gate.html`（sign-off 2026-07-15 variant B）。

### Stop Card（rev2 route-list · Apple Music track row，v2.55.99）

> **⚠ rev2 owner 2026-07-17（mockup Section 02，`docs/artifacts/2026-07-17-v3-desktop-prototype.html`）：停留卡改 Apple Music track row —— 動作從「展開明細一排 icon 工具列」收進單顆 ⋯ context menu（Apple 列表語彙：不在列上排 icon）。**

- **Grid（`.tp-rail-item`）**：resting = `編號 node(24) | body(1fr)`（桌機手機統一、無常駐 grip 欄 → Apple 乾淨列）；排序模式才插 grip 欄 = `grip(24) | node(24) | body(1fr)`。grip/node/head 皆無顯式 `grid-column`，靠 source order 自動落欄、兩模板通用。類型 icon tile 已退場（v2.55.90），**編號 node 為 route spine 唯一 leading 元素**、類型走 sub-line label。
- **Typography**（對齊 mockup `.stop-n:291` / `.stop-s:296`）：標題 `.tp-rail-name` = `--font-size-headline`（17px 桌機 / `--font-size-callout` 16px 手機）/ **weight 500（medium，非 bold；Apple Music track row 質感）** / `letter-spacing: -0.012em`（SF 式緊排）/ nowrap ellipsis；**選中（`[data-expanded]`）→ 600**。副標 `.tp-rail-sub` = `--font-size-subheadline`（15px）/ `letter-spacing: -0.006em` muted，inline 串接 time chip · 類型 · 停留 · ★rating · desc。（先前 15/11px 太小是「不像 Apple」主因；標題此處刻意用 500 medium 而非 card-title 700，為 Apple Music track row 例外。）
- **內縮分隔線**（mockup `.stop-c::after:278`）：列間 hairline 走 `.tp-rail-item::after`（`left: 44px` 桌機 / `36px` 手機 = padding+node+gap，對齊文字起點）而非全寬 border-bottom；hover / 展開 / 末列隱藏。Apple 列表簽名細節。
- **動作 = ⋯ context menu**：row 右側 `.tp-rail-head-actions` = ⋯ trigger（桌機 hover/focus/menu-open 才顯、觸控恆顯）+ 展開 caret。⋯ 用**原生 Popover API**（top-layer 自動逃 `.tp-rail-content` 的 overflow:hidden、light-dismiss、鍵盤 ↑↓/Home/End）。menu 分組（destructive 獨立末組）：**在地圖開啟｜編輯備註 / 換景點 / 編輯景點｜重新排序 / 複製到其他天 / 移到其他天｜刪除景點（紅）**。testid 沿用舊 toolbar（`timeline-rail-edit/-delete/-copy-open/-move-open-N`）。展開明細只留**資訊面**（景點說明 / 備註 inline / 備選景點），**無 action 工具列**（`.tp-rail-actions` 已移除）。
- **排序模式**：⋯「重新排序」→ `.tp-rail-body[data-sort-mode]`：所有列顯 grip、可拖（dnd-kit，`useSortable` disabled 由 sortMode gate）、底部 sticky「完成排序」bar 退出。resting 列不放常駐 grip（拖拉排序在 ⋯ 內，非列上 icon）。
- **依類型 tone 上同色系淡底**：卡片 bg = tone `-subtle`、border = tone `-bg`（柔褐／sage／粉，見 Stop Type Color Convention）。`data-now="true"` → 編號 node accent 實心；`data-past="true"` → opacity 0.55。

### Travel Connector
- Stop 之間的交通段（travel pill）：**sage 描邊式** — 透明底 + 1.5px sage 邊框 + sage `-deep` 文字/icon（取代填滿）。
- 縮排 34px（對齊 stop 內 icon box 左緣）。

#### 同一地點 / 免交通 state（v2.55.46）
- 使用者可把一段連續同地停靠（如同一機場內兩停靠點：那覇機場 → 牛排屋88 機場店）手動標記為「免交通」→ travel pill **收合成「同一地點」marker**，不顯示自動算出的荒謬車程（直線略過 1km walk/drive gate → 被算成開車 9.4 km／21 分）。
- **收合 marker = 中性描邊膠囊（v2.55.48）** — 形狀對齊交通膠囊（`.tp-travel-pill` 同 `--radius-full` + `padding:5px 14px`），但 tone 用中性 `--color-line-strong` 邊 + `--color-muted` 字，**刻意不用 sage**（sage 代表「有移動」；免交通是「無移動」要 recede）。`location-pin` icon（13px、opacity 0.7）+ caption（12px）「同一地點」。互動 timeline 上是 button（tap 開對話框改回交通方式；hover = `--color-hover` 暖中性底）。此中性膠囊與對話框同一地點選項（下方 `--color-line-strong` 邊）同語言 → timeline↔對話框↔編輯頁三面一致。〔v2.55.46 初版為裸 muted 圖釘（無膠囊容器），與交通膠囊並排視覺不一致，v2.55.48 改膠囊化。〕
- **兩個標記入口**（共用同一後端 flag + 同一 marker）：
  - **對話框（V1）**：TravelPill 8-方式晶片格下方，分隔線「或」後一整列「同一地點・免交通」。**非第 9 個晶片**（它不是交通方式）→ 中性選取態（暖中性底 + `--color-line-strong` 邊），與柔褐/ sage 晶片區隔。
  - **編輯頁（V3）**：EditEntryPage 交通段區塊一個 toggle switch（on = 柔褐 accent，active 慣例）+ 說明；on 時 dim 掉 3-mode segmented control。
- 資料：`trip_segments.no_travel`（additive nullable，migration 0084）。`1` = 免交通、`NULL` = 正常段。recompute 見 `no_travel=1` 跳過不覆寫（同 manual-lock）；read path（days/_merge、segments GET）吐 `sameplace` marker。列印/分享面（tripPrintData）顯「同一地點」。AI 健檢餵「同一地點（免交通，刻意無移動）」給 Claude，非「移動時間未記錄」。import 邊界強制 `no_travel=1 ⟹ min/dist/source NULL`。
- **端點失效**：換掉某停靠點的 master POI（真正 swap，非 no-op drift-repair）→ 相鄰段 `no_travel` 一併清 `NULL` → recompute 重算（「同一地點」前提隨端點改變而失效）。取捨：若只是重選「同機場另一航廈」這種仍同地點的 POI，會被重算成短程開車，需再標一次免交通。
- Mockup：`docs/design-sessions/2026-07-10-same-place-no-travel.html`（sign-off 2026-07-10，V1+V3 雙入口）；marker 膠囊化 `docs/design-sessions/2026-07-10-sameplace-pill-consistency.html`（sign-off 2026-07-10，選 V1 中性描邊膠囊）。

### AI Health Check Page (`tp-ai-health-*`)

行程 AI 健檢全頁。Route `/trip/:tripId/health`。入口：TripsListPage 卡片 ⋯ menu「AI 健檢」+ TripPage ⋯ menu「AI 健檢」。

**命名注意**：避開 v2.23.0 既有 `<TripHealthBanner>` 與 `.tp-trip-health-banner-*`（POI lifecycle health：closed / missing）。AI 健檢 component 用 `tp-ai-health-*` 前綴與專屬 testid `ai-health-*`，**禁** 重用 `tp-trip-health-*` 或 `<TripHealthBanner>` 容器。

**4 個 state**（依 `trip_health_reports.status`）+ overlay re-generating：

| State | UI |
|-------|----|
| empty (`report === null`) | `tp-ai-health-empty` block + sparkle bubble + 「開始健檢」CTA |
| pending (無舊 findings) | `tp-ai-health-loading` pulse animation + 「健檢進行中…」 / button 「健檢進行中…」disabled |
| completed (有 findings) | severity-grouped findings（高/中/低）+ 「重新生成」button |
| completed (`findings.length===0`) | success bubble + 「看起來沒有問題」 |
| failed | `tp-ai-health-failed` destructive panel + errorMessage + 「重新生成」button |
| re-generating (pending + 舊 findings) | 舊 results `opacity: 0.55` dim + 「準備中…」pulse banner + button 「再重新生成」disabled |

**Severity 顏色**：用既有 `--color-priority-{high,medium,low}-{bg,dot}` token（不用 柔褐 — accent 仍保留給 chrome / CTA / sight-food icon）。每張 finding card 左側 6px bar + bg = priority 半透明色 + foreground = priority dot。Count chip 同色系。

**Finding action**：若 `action_target.day` 存在 → 「前往 Day N」accent-filled button，click → navigate `/trip/:id?day=N`。

**Polling**：pending state 每 3000ms `GET /api/trips/:id/health-check` 直到 status 變 completed/failed。`pollRef` 持 timeout id 避免 effect 重渲漏清。`prefers-reduced-motion` → pulse animation 停。

**重新生成 action**（v2.33.110+，v2.57.x 遷入 `OperationShell` 後改位置）：依 state 改 label：開始健檢 / 重新生成 / 再重新生成 / 健檢進行中⋯ / 送出中⋯。原本放 TitleBar `actions` slot；本頁遷入桌機三欄操作堆疊（見上「桌機三欄操作堆疊」）後，外殼改用 `OperationShell` 的共用 `StackPanelHeader`（無 action slot）—— action 移到 body hero 列右側（`.tp-ai-health-hero-top`，class 名沿用 `.tp-titlebar-action` ghost icon button token）。回上一頁改由 `OperationShell` 的共用 `‹`/`✕` 提供，不再是頁面自帶 TitleBar back。`entryCount===0` 時此 action 不顯（empty/idle 走 body 中央主 CTA）。

**Mockup**：`/tmp/TripAIHealth-variants.html` Variant C (sign-off 2026-05-16) — sticky bar 版本，v2.33.110 拔掉 sticky bar 改 title bar action。

**Finding card 結構（v2.31.1 Phase 2 extended）**

```
┌─ severity bar (6px column)
│  ├─ head-row: title + dimension chip（「時間」「移動」「餐飲」「景點」「住宿」）
│  ├─ desc: 具體描述（≤120 字）
│  ├─ suggestion block: 「建議」label + 建議文字（accent-subtle bg、accent-deep text、accent eyebrow label）
│  └─ actions: 「前往景點」（有 entry_id）優先於「前往 Day N」（只有 day）
└─
```

- **Dimension chip** (`.dimension-chip`)：tertiary bg + muted text + caption2 + 中文 label，緊接 title 旁邊
- **Suggestion block** (`.suggestion`)：accent-subtle bg + accent-deep text + caption2 eyebrow「建議」label，不用 emoji（DESIGN.md 第 10 條無裝飾原則）
- **Navigation hierarchy**：`action_target.entry_id` 帶 → 直接 navigate `/trip/:id/stop/:eid/edit`（更具體）；只有 `day` → navigate `/trip/:id?day=N`

### Trip Notes Page (`tp-notes-*`)

行程筆記全頁（v2.34.x）。Route `/trip/:tripId/notes`。5 section accordion（航班 / 住宿 / 預訂 / 行前須知 / 緊急聯絡）+ 3 AI generation prompt (lodging-tips / general-tips / emergency) 寫進 行前須知 + 緊急聯絡 兩 section。

**入口**：
- TripCardMenu「行程筆記」menu item (PR14)
- EmbeddedActionMenu「行程筆記」menu item (PR14)

**Accordion**：
- Mobile (compact)：default 只 航班 expanded
- Desktop ≥768px：5 個 section 全 expanded
- `matchMedia('(min-width: 768px)')` listener 動態切換
- `<button>` head + `aria-expanded` + `aria-controls` 給 screen reader

**4 個 state**（依資料 + AI job）：

| State | UI |
|-------|----|
| loading | 3 row shimmer skeleton (`prefers-reduced-motion` 停 animation) |
| error | `<AlertPanel variant="error">` + actionLabel「重試」(對齊 L549) |
| empty (counts=0) | hero「建立行程筆記」+ 5 dot progress + 航班 is-suggested accent border + 「建議先填」warn meta |
| hasData | 5 section accordion + meta count |
| ai-pending | accent-subtle banner + pulse dot + 「AI 正在生成 ... 通常 3-7 分鐘完成」 |

**AI button**：
- 只在 行前須知 + 緊急聯絡 section header
- Disabled state when ai-pending + text 改「生成中…」
- 30s debounce backend（重複 click → return existing job）

**Visual specs**：
- Section card: 12px gap + 1px hairline border + secondary bg + `tp-notes-section.is-open` border 改 `line-strong`
- Section icon box: 36×36 + radius-md + `is-accent` variant accent-subtle bg + accent-deep color
- Row hover: bg → `--color-background` + grip handle (1.5×14 SVG) 顯示
- Edit mode: 2px accent box-shadow + 6/8/12 margin + 2-col edit grid
- ConfirmModal delete: 對齊 DESIGN.md「Destructive 必走 ConfirmModal」

**autosave (對齊 v2.33.108 OCC)**：
- field blur → PATCH `/api/trips/:id/notes/{section}/:rowId` with `expectedVersion`
- 成功 silent
- 失敗 → AlertPanel error 持續可見 + 「重試」action
- 409 STALE_ENTRY → refresh + retry

**Stop Type Color exception**：emergency contacts kind icon 用 semantic 色（police/medical 用 destructive red、embassy 用 accent、hotel 用 success green）— 屬「semantic encoding 例外」（同 priority dot 邏輯）。

### Trip Print Document (`tp-print-*`)

Route `/trip/:tripId/print`（`TripPrintPage` + `TripPrintDocument`）。**資料驅動的列印文件**，取代舊 `usePrintMode`（在互動 DOM 掛 `body.print-mode` → 繼承收合）。

Mockup sign-off：`docs/design-sessions/2026-05-30-trip-print-document.html`（Variant A「緊湊表格式」，2026-05-30）。設計文件：office-hours `ray-master-design-20260530-101432.md`。

- **原則**：從 data render，零互動、零收合、全展開、文字優先 + 少量圖示。A4 寬、**多頁**（`break-inside: avoid` 包每日區塊 + 每個 notes 區塊，不是「一頁式」）。
- **顏色**：列印文件本體**純黑白文字**（ink `#1d1813` / muted `#5c5248` / hairline `#cfc7ba`），accent **只**用在 on-screen 工具列（列印/關閉 CTA），不進文件 body。★ rating 用暖金 `#9a7b32`（list meta 既有慣例）。
- **版面**：Header（行程名 `title || name` + 日期區間 + 目的地）；每日一個 compact table（時間 / 行程+★+備選+note / 交通右對齊）；hotel 列淺底；行程筆記 5 區塊 2-col grid（航班/住宿/預訂/行前須知/緊急聯絡，icon 用 plane/hotel/check-circle/document/phone）。
- **Empty states**：0 天 → header + 「尚無行程」placeholder；空的 notes 區塊整段省略（不印空標題）；無 segment → 不印交通列。
- **入口**：TripsListPage EmbeddedActionMenu「列印」→ navigate `/trip/:id/print`（`usePrintMode` 舊路徑 PR1 共存，soak 後再拔）。
- **@media print**：隱藏工具列、`@page { size:A4; margin:14mm }`、文件去 shadow/padding。
- **RWD（v2.38.3）**：entry 不是 `<table>` 是 responsive div-grid — `≥640px` = 3 欄（時間/行程/交通），**container query** `@container (max-width:640px)`（依文件自身寬度，非 viewport → 手機產的 PDF 仍 A4 表格）手機**直式堆疊**，notes 2 欄 → 1 欄。Mockup：`docs/design-sessions/2026-05-30-trip-print-rwd.html`。
- **手機 polish（v2.38.5）**：① 列印預覽 chrome 用**固定淺色**（非 dark-mode token）— 深色模式下「關閉」ghost button 不再白底淺字看不到（列印本就白紙，預覽固定淺色，同舊 usePrintMode 做法）。② 手機 entry 內文（備選/備註/交通）`grid-column:1/-1` **全寬往左一欄**，不縮排在時間欄下。③ 行程筆記每筆 = **粗體標題 + 獨立內文**（`.tp-print-note-t` / `.tp-print-note-b`），內文 `white-space:pre-line` 保留原本換行（行前須知「- 」項目逐行斷落，不再黏成一段）。Mockup：`docs/design-sessions/2026-05-30-trip-print-polish.html`。
- **筆記章節化（v2.38.6）**：列印頁 5 區塊筆記改**單欄章節流**（`.tp-print-ngrid` 1 欄）— 每 section = 章節（icon + 標題 + 數量 badge `.tp-print-nh-cnt`「N 項/間/筆」+ `border-bottom` 分隔線），章節內每一筆 `.tp-print-note-item` 用 hairline 分隔（last-child 無線）、標題加粗。長 section（行前須知）一眼看得出層次。Mockup：`docs/design-sessions/2026-05-30-trip-print-notes-chapters.html`。

### Trip Share Page (`tp-share-*`，v2.39.0)

公開、**無登入**的分享檢視。Route `/s/:token`（`TripSharePage`，不呼叫 `useRequireAuth`）。重用 `TripPrintDocument`（`hideHeader`）渲染 server 端區塊過濾後的唯讀行程，外包一層分享 chrome。

Mockup sign-off：`docs/design-sessions/2026-05-30-share-page.html`（Variant B「分享封面」，2026-05-30）。設計文件：office-hours `ray-master-design-20260530-191308.md`。

- **版面（Variant B）**：柔褐 漸層 hero（`.tp-share-hero`）顯 eyebrow「由 {display_name} 分享給你」（無名 → 「有人分享了一份行程給你」）+ 行程名 + 日期/目的地 meta；sticky `.tp-share-actionbar`（列印 / 存 PDF ghost + 全寬「複製到我的行程」accent CTA）。hero 取代文件自身 header（`hideHeader`）。
- **顏色**：chrome 固定淺色（hero 柔褐，doc 白紙），不隨 dark mode 翻轉。CSS 在 `tripPrintStyles.ts` 的 `SHARE_CHROME_CSS`，文件本體重用 `PRINT_CSS`。
- **未公開區塊**：整段消失（不顯鎖）。`@media print` 隱藏 hero + actionbar。
- **入口（owner）**：列印頁工具列 +（v2.39.1）行程一覽卡片 ⋯（`TripCardMenu`）+ 行程頁右上角 ⋯（`EmbeddedActionMenu`）的「分享連結」→ `ShareLinkModal`（`tp-sharemodal-*`）建立連結 → 一次性顯示網址 + 複製 + 關閉分享。已建立連結的網址無法再次顯示（DB 只存 hash），要新網址須建新連結（PR2 加重新產生）。
- **桌機對齊（v2.39.1）**：hero + 操作列 `max-width:794px` 置中對齊文件（手機全寬 no-op），桌機（≥834px）hero 加圓角上緣 + 上邊距讀作一張完整卡片，不再全寬太寬。
- **安全姿態**：見設計 §安全設計 S1-S12（token CSPRNG/hash、default-deny 過濾、統一 404、無 owner PII、IDOR 綁 trip_id、rate-limit、安全 headers）。
- **完整管理面板（v2.40.0 PR2）**：`ShareLinkModal` 升級為面板（`tp-sharemodal-*`）— 建立表單（區塊 pills 逐區塊開關 / 期限 segmented 永久·24時·7天·30天 / 匿名 checkbox）+ 一次性網址 + 使用中連結卡片（瀏覽數 / 區塊 chips / 匿名·已過期 badge / 重新產生·關閉·刪除）。匿名（migration 0077 `anonymous`）→ 公開 hero 顯「有人分享了一份行程給你」。Mockup：`docs/design-sessions/2026-05-30-share-manage-panel.html`。
  - ⚠️ **已知規範違規（2026-07-23，待改）**：這個面板裝了 pills + segmented + checkbox + 日期 + 卡片列表，違反上方「必走全頁（>3 欄位含 select/segment/toggle）」判準。**不追認為核可的 modal 例外** —— 認定為欠債，之後應改成全頁 shell（保留現有 markup/testid），本輪（HIG 落差地圖 P0）只標註不改 code。屬 wayfinder map #1110 的落差清單。
- **訪客一鍵複製（v2.40.0 PR3）**：複製 CTA → 登入者 server 端複製可見內容到自己帳號（`data_source='cloned'`）→ 導向新行程；未登入先導 login。orchestration 共用 `functions/api/trips/_tripWrite.ts`（import + clone 共用，零 drift）。default-deny：只複製已公開區塊（私人筆記永不進複本）。
- **面板 nice-to-haves（v2.41.0 PR-A）**：連結命名（label）/ 連結卡片「編輯」改區塊·期限·名稱·匿名而不換網址（PATCH `update`，僅 active）/ 期限加「自訂」用 `TripDatePicker` / 已關閉連結收合區（保留統計）/ 新連結 banner 加 QR（`lib/shareQr.ts` 本機產生，token 不外送）+ 原生分享（`navigator.share`）。**QR 只在 banner**（既有連結只存 hash、無 URL 可編碼）。Mockup：`docs/design-sessions/2026-05-30-share-manage-panel-v2.html`。
- **連結預覽卡 + hardening（v2.42.0 PR-B/PR-C）**：`functions/s/[token].ts` 鏡射 `functions/trip/[[path]].ts` 注入 per-share og/twitter meta（行程名/日期/目的地，只查公開欄、失敗 fallback shell）。clone 加 per-IP gate；`share-cleanup.yml` 每日清過期連結（`cleanup-expired-shares.sql`，30 天 grace）+ 孤兒 cloned 行程（`cleanup-orphan-cloned-trips.sql`，NOT EXISTS + 1 天 grace）；卡片建立日期改 `parseUtcDate`。

### Trip Export（v2.37.0 PR2）

行程 ⋯ → 下載格式 **只剩 PDF + JSON**（CSV / Markdown v2.37.0 移除，不再使用）。

- **PDF**：`renderTripPrintPdf`（component 層）把 `TripPrintDocument` render 進離屏附著容器（`position:absolute;left:-9999px;width:794px`）+ 注入 `PRINT_CSS`（`lib/tripPrintStyles.ts`）→ html2pdf。不再吃 `#tripContent`（舊版繼承收合）。`flushSync` 同步 commit 後才 snapshot。
- **JSON**：`lib/tripExport.ts` `downloadTripJson` → round-trip schema `{ schemaVersion:1, meta, days(每個 entry 加 entryPosition), notes(5 區塊), segments(positional fromEntryIdx/toEntryIdx) }`。**取代**舊 `{ meta, days, docs }`（breaking）。segments 用位置序號（entry id 是 auto-increment，匯入會 remap）。供 PR3 匯入消費。
- **分層**：`lib`（tripExport / tripPrintStyles）是 leaf，不 import component；PDF render 因需 component 放 component 層；`TripPage.handleDownloadFormat` 分派 json→lib / pdf→component。

### Trip Import（v2.38.0 PR3）

`POST /api/trips/import` + 行程列表 TitleBar「匯入」button（`ImportTripButton`，upload icon）。讀 JSON 檔 → 建**新行程**（永不覆寫；owner = 當前 user；`data_source='imported'`）。

- **安全邊界**（`functions/api/trips/_import.ts`，純函式）：body 是 untrusted JSON → 實際大小上限 512KB（讀 text 非信 Content-Length）→ `schemaVersion` gate → 拒 `__proto__`/`constructor`/`prototype`（含 non-enumerable + symbol key）→ 每陣列上限 + **總數上限**（entries ≤ 1000、pois ≤ 3000，防 D1 batch 爆量）→ 每個 CHECK enum（poi type / segment mode/source / reservation kind / emergency kind）coerce → POI sort_order 重編 1..N（防 UNIQUE 違反）→ segment (from,to) 去重 → 全程 allowlist 讀欄位（絕不 spread）。
- **D1 orchestration**（`import.ts`）：D1 無 transaction + batch ~100 statement 上限 → **chunked sequential batch（≤50）** with `INSERT…RETURNING id`，逐 chunk track 新 id；任一步失敗 → connect-root rollback（按 trip_id + tracked entry/poi id 連根刪）。每人行程數上限 1000。
- **POI 模型**：匯入一律**新建 pois**（不 find-or-create，天然「不碰既有 catalog」）；trip-specific override（reservation/note/description）寫 `trip_entry_pois`。segments 用 positional idx remap 回新 entry id。
- **Round-trip**：PR2 匯出的 JSON 可原檔匯回成等價新行程。

## Modal Dialogs

### Principle

**禁止使用 native browser dialog**（`window.confirm` / `window.alert` / `window.prompt`）—
無法 style、無法 a11y trap focus、阻塞主執行緒、Mac/Windows 視覺差異大、看起來「不像我們的 app」。所有互動式對話必須走 styled modal 或 Toast。

### 統一行為引擎（`useSheetBehavior`，rev2 HIG 收斂）

所有 modal / sheet / 操作面板的**行為層走單一引擎** `src/hooks/useSheetBehavior.ts`，各元件只保留自己的 markup + scoped styles + testid（視覺不變）。引擎提供：

- **body scroll-lock**（`modal` 預設 true）。**ref-count**（`useBodyScrollLock` module-level 計數）→ 巢狀 sheet 共用一把鎖，內層不覆寫外層捲動位置。引擎**支援** `modal:false`（`useSheetBehavior` 有此參數，語意為「非模態表面、不鎖 body」，見 hook 內註解）。
  - ⚠️ **實作現況（2026-07-23 更正）**：桌機右欄操作面板（`OperationShell`）**目前並未透過 `useSheetBehavior({modal:false})` 走引擎** —— 它只 import `isAnySheetOpen` 供 Escape 判斷，scroll 管理是自己手寫的。全 src 無 `modal: false` 呼叫。所以「操作面板走引擎的 non-modal 模式」是**設計意圖、非已實作**；要不要讓它真的接進引擎屬 wayfinder map #1110 的落差（規範層本輪只更正描述、不改 code）。
- **Escape**：`isComposing` 略過（IME）、`isTopSheet` gate（巢狀只關最上層）、`canDismiss:false` 鎖（busy 送出中，如 AiConsent）。listener 在 `document`。
- **focus**：`initialFocusRef` 指定開啟焦點（如 ConfirmModal 的確認鈕）、focus-trap（Tab）、focus-restore。
- 已收斂：ConfirmModal（16 consumer 零改）/ InputModal / ConflictModal / AiConsentSheet / InfoSheet / EditTrip 平移日期 modal。**例外**：DeveloperApp secret reveal（DESIGN.md 允許的 critical-attention modal，刻意不可 dismiss）、anchored menu/popover（不同 pattern）。

**固定高度 sheet 不放 resize grabber**（AiConsent 已移除裝飾 grip）；可 resize 才放（InfoSheet 兩段 detent）。
巢狀 modal 疊放靠 portal DOM 順序，不用 z-index layer。

### Modal vs Full Page Decision

**Modal 限定情境**
- Confirm: destructive action 二次確認 (`<ConfirmModal>`)
- Input: 單行輸入 (`<InputModal>`)
- Popover / Menu: 浮層選單 (kebab, anchored picker)
- Critical attention: 一次性 client-side state (e.g. OAuth secret reveal, server response 不可重取)

**必走全頁 (form 全頁 + TitleBar shell) 情境**
- 多欄位 form (>3 fields, 含 select / segment / toggle / textarea)
- Sortable list / drag-to-reorder
- Inline search dropdown (POI search, autocomplete)
- 巢狀 form section
- Loading + 主內容並存雙態介面
- 多步驟的 day picker 流程（多個選擇 + confirm 串接）
  - **例外**：時間軸列上的 inline 起訖時間編輯（`.tp-rail-time-chip` → portal popup，抵達／離開兩欄 + 完成）**不在此限** —— 它是就地微編輯、非多步驟流程，且已有完整 a11y 配套（見上「起訖時間 chip」段）。〔原本這條寫「time slot select（即使 popover-shaped）必走全頁」，與已上線的 time chip 直接衝突；2026-07-23 owner 裁定規則寫過頭、收窄為「多步驟 day picker 流程」〕

**Chooser 流程 (selection → 立即 navigate)**
- 用 anchored popover (跟 region pill / category subtab 同 pattern)
- 不走全頁 (page mode 打斷 selection-then-action flow)
- 不走 modal-style backdrop

**判斷準則**
- User 可能想用 browser back 鍵取消 → 全頁
- 想 deep-link 給隊友看「我在這個畫面」 → 全頁
- Selection 後立即 navigate → popover
- 需要用戶顯式 OK / Cancel 的瞬間阻斷 → modal

**禁止**
- Native browser dialog (`window.confirm` / `window.alert` / `window.prompt`)
- 自製 modal backdrop (一律用 `<ConfirmModal>` / `<InputModal>`)

### Allowed Modal Components

| Component | 用途 |
|---|---|
| `<ConfirmModal>` | Destructive 確認 (刪除 / 撤銷 / 登出) |
| `<InputModal>` | 單行 input |
| `<ConflictModal>` | Sync 衝突決策 |
| `<TripCardMenu>` | Kebab popover menu |
| `<TripPickerPopover>` | Chooser popover (anchored, 不全頁) |

> **v2.55.78 移除 `<StopLightbox>`（⛶ 放大檢視）**：它是唯讀明細，不屬上方「Modal 限定情境」
> 四款任何一款 —— 當初能存在是因為它是**圖片燈箱**（Modal 的慣例情境）。但 POI 從來沒有照片
> 資料（見 Material & Effects → Photos），拆掉照片面板後它只剩「背後那一列的真子集」：唯一入口
> 是 `.tp-rail-detail` 展開後才出現的 ⛶ 鈕，而該展開列已全文顯示說明/備註（無 line-clamp），
> 還多給細類 label、星等/價位/營業時間、備選景點與編輯 affordance。刪除而非放寬 SoT。

### Surface 對應表

| Situation | Surface | Component |
|-----------|---------|-----------|
| Destructive 確認（刪除 / 撤銷 / 登出全部裝置 / 移除共編） | ConfirmModal (`role="alertdialog"`) | `<ConfirmModal>` |
| 單行 input prompt（輸入地區名 / 自訂值 / 備註） | InputModal (`role="dialog"`) | `<InputModal>` |
| 環境狀態 / 低風險通知（離線 / 複製成功 / 不支援的功能 / 操作失敗可重試） | Toast | `showToast()` / `showErrorToast()` |

當你在猶豫時：**需要 user 顯式決定 → Modal；passive 通知 → Toast**。

### ConfirmModal

`src/components/shared/ConfirmModal.tsx`

- Role: `alertdialog`（語意上要求 user 注意）
- Title `<h2>` + message `<p>` + 兩個 button：取消 ghost / 確認 destructive 實心
- Confirm button 自動 focus（keyboard user 直接 Enter）
- Escape / backdrop click / cancel button 都關閉
- `busy` prop：confirm button 顯示「處理中…」+ disabled，避免 double-submit
- Destructive button 顏色 = `--color-priority-high-dot`（不用 柔褐 accent）

### InputModal

`src/components/shared/InputModal.tsx`

- Role: `dialog`（不是 alertdialog，純收 input 不阻斷）
- Title + optional message + 單行 `<input>` + 兩個 button
- Input 自動 focus + 全選 default value（user 直接覆蓋輸入）
- Enter 提交 / Escape 取消 / backdrop dismiss
- 空字串自動 disable 確認 button，除非 `allowEmpty`
- Confirm button 用 `--color-accent`（非 destructive，不用紅）

### Visual Spec（兩者共用）

| Property | Value |
|---|---|
| Backdrop | `rgba(20, 14, 9, 0.42)` + portal to `document.body` |
| Modal width | `min(420px, 100%)` |
| Border radius | `--radius-xl` |
| Shadow | `--shadow-lg` |
| Backdrop animation | 150ms fade-in |
| Modal animation | 200ms slide-up + scale (98% → 100%) |
| Button radius | `--radius-full` (pill) |
| Button min-height | 44px (Apple HIG tap target) |
| Cancel button bg | `--color-secondary` + 1px `--color-border` |
| Cancel hover | `--color-hover` |
| Confirm focus ring | 2px outline + 2px offset |

### Examples (現役)

- TripsListPage card kebab「刪除」 → ConfirmModal
- PoiFavoritesPage 收藏批次「刪除」 → ConfirmModal（DUC1: delete-only batch flow，user accept；不支援 batch add-to-trip）
- ExplorePage region pill「+ 自訂地區…」 → InputModal
- AddPoiFavoriteToTripPage 同 day 同時段衝突 → ConflictModal（new component, v2.21.0）
- SessionsPage「登出其他全部裝置」 → ConfirmModal
- CollabPanel 移除成員 / 撤銷邀請 → ConfirmModal
- TimelineRail 刪除景點 → ConfirmModal

### Toast

詳見 [Error & Status Messaging](#error--status-messaging) — Toast 規範統一管在那。

## Error & Status Messaging

### Principle

Toast 只用於環境狀態與低風險通知，例如離線、恢復連線、複製成功。其他錯誤必須使用更明顯、持續可見、可操作的 surface，避免使用者漏看儲存、登入、資料載入等重要問題。

### Surfaces

| Situation | Surface | Behavior |
|-----------|---------|----------|
| 欄位格式錯 | `FieldError` + optional form summary | 顯示在欄位下方；送出後表單頂部可列出 summary |
| 表單送出失敗 | `FormErrorBanner` | 表單頂部 persistent banner，不自動消失 |
| 儲存失敗 | Section-level persistent alert | 放在受影響區塊上方，保留使用者輸入並提供 retry |
| 刪除 / 邀請 / 登入等重要操作失敗 | Dialog 或 compact bottom sheet | 明確阻斷，提供修復 action |
| 頁面資料載入失敗 | `PageErrorState` | 占用內容區，提供 retry / back action |
| 地圖資料失敗 | Map floating error panel | 浮在地圖上方，不被 bottom nav 擋住 |
| 登入過期 / 權限不足 | Global banner under titlebar | persistent，必要時阻擋操作並引導重新登入 |
| 離線 / 恢復連線 | Toast | Desktop 右上 titlebar 下方；compact 底部且高於 bottom nav |
| React runtime crash | Error boundary fallback | 頁面或局部 fallback，提供重新整理與回報入口 |

### Visual Style

- Error surfaces 使用 semantic error，不使用 柔褐。柔褐保留給品牌、active state、CTA。
- `error`: `#C13515`；`error-bg`: `rgba(193, 53, 21, 0.08)`；border 可用 `rgba(193, 53, 21, 0.24)`。
- Warning 使用 `#C88500`；info 使用 `#3B7EA1`；success 使用 `#06A77D`。
- Persistent alert panel：8px radius、1px hairline border、左側 4px 狀態色條、icon / title / message / action。
- 不用大面積實心紅底；錯誤要明顯，但不要破壞 柔褐 editorial 風格。
- Mobile action 可換行到下一列，避免按鈕擠壓文字。

### Copy Rules

錯誤文案必須回答三件事：

1. 發生什麼事。
2. 使用者現在可以怎麼做。
3. 系統是否保留資料。

範例：

- `行程沒有儲存成功。你的內容還在，可以再試一次。`
- `登入已過期。請重新登入後繼續編輯。`
- `地圖資料載入失敗。行程內容仍可瀏覽，請稍後重試地圖。`

避免空泛文案，例如 `發生錯誤`、`Something went wrong`、`請稍後再試` 單獨出現。

### Components

- `FieldError`
- `FormErrorBanner`
- `PersistentAlert`
- `GlobalStatusBanner`
- `PageErrorState`
- `MapErrorPanel`
- `StatusToast`
- `ErrorBoundaryFallback`

## Icons
- **Approach:** Inline SVG 元件系統（`src/components/shared/Icon.tsx`）
- **Size:** 跟隨 font-size（`width: 1em; height: 1em`）
- **Style:** Line stroke 1.5-1.75px，不用填充
- **Color:** 繼承 `currentColor`

## Accessibility
- **Touch target:** 最小 44×44px (Apple HIG)
  - Exception: drag handles (e.g. `.ocean-rail-grip`) 24×24px — 跟 row 主點擊區並存時避免 click target 衝突，以 `:focus-visible` ring + 持續可見 opacity 補 a11y
- **Color contrast:** 文字對比度 WCAG AA 4.5:1（muted text `#6F5A47` / dark `#B5A08A` 需持續驗證）
- **Focus:** 所有互動元素有 focus-visible ring。**用 `outline: none` 時 SHALL 同時宣告 `box-shadow: var(--shadow-ring)` 作為替代焦點指示** —— 不能只拿掉 outline 卻不補（那會讓純鍵盤使用者無法定位）。例外：表單輸入（`input`/`textarea`/`select`）以文字游標 + `border-color` 變化當焦點指示，不需 `box-shadow`。全域 `button:focus-visible` 應在 `css/tokens.css` 提供這個替代 ring。〔遷自已歸檔的 `css-hig-discipline` spec；曾於 `8ead450b` 被整段移除只留 `outline: none`，判定為誤刪、須補回〕
- **Motion:** 尊重 `prefers-reduced-motion`（骨架屏動畫、過渡效果）
- **Screen reader:** 語意化 HTML + ARIA landmarks + `role="tab"` 在 day chips

## V2 Owner Cutover & poi_favorites Universal Pool（migration 0046+0047+0050）

> **Naming history**（hard cutover，no aliases）：
>
> - **v2.55.45** (migration 0083)：交通方式細分 `trip_segments.submode` — TravelPillDialog 由 3 mode 擴成 **8 方式晶片格**（駕車/步行/單軌/公車/地鐵/火車/高鐵/其他）。mode 維持 3 canonical（不碰 CHECK），transit 段用 submode 分具體方式。**計算策略**：自動算＝駕車/步行（Google WALK/DRIVE）、單軌（`lib/yuiRail` 本地 Yui 19 站表、walk+rail+walk 直線估、0 API）、公車（同駕車走 Google DRIVE — 日本 Routes API 無 transit）；純手填＝地鐵/火車/高鐵、其他（自由輸入方式名當 submode／label）。距離一律自動（駕車/步行/公車=Google、其餘=直線 Haversine）。**「上鎖」概念經 `source` 欄回歸**（v2.30.0 拔的是 `mode_source`）：自動方式手填分鐘 → `source='manual'` 鎖定、recompute 跳過（`source IS NOT 'manual'` null-safe guard）、TravelPillDialog 顯 ⚠ + `travel-revert`「恢復自動計算」鈕（送不帶 min 的 PATCH → 回自動）；手填方式無恢復鈕。TravelPill 顯 `travelMethodLabel` submode label（單軌/地鐵/火車/高鐵共用 train icon 需文字區分）。**EditEntryPage 3-mode 編輯器**（只送 `{mode, min}`）→ PATCH 省略 submode 時後端**保留現值**（非清除），不把 pill 設好的 monorail/bus 洗成 null。晶片 testid `travel-method-{key}`、min input `travel-min-input`、恢復鈕 `travel-revert`。Mockup：`docs/design-sessions/2026-07-10-travel-methods-expand.html`。
> - **v2.30.0** (migration 0064)：`trip_segments.mode_source` DROPPED — 移除「上鎖」概念。
>   TravelPill 拔掉 🔒 lock icon + `tp-travel-pill-lock` CSS；TravelPillDialog 拔「已手動覆寫」title indicator + `.tp-travel-dialog-locked` CSS；EditEntryPage 拔「手動覆寫」section heading aux chip + 「重設為自動」button + `tp-edit-entry-reset` + `is-lock` CSS。語意：mode='transit' 自然代理 user override（user 手填 min，recompute 不蓋）；mode='driving'/'walking' 一律 Google Routes 重算（ignore body.min）。
> - **v2.29.x** (migration 0061-0063)：`trip_pois` 整表 rip-out（v2.29.0）+ `DROP TABLE saved_pois`（v2.29.1，poi-favorites-rename Phase 2）+ stale-travel ⚠ 改用 `segment.computed_at IS NULL` signal（v2.29.2，拔 Haversine vs distance divergence 邏輯，TravelPill `staleHaversineM` prop 已移除）。
> - **v2.23.0** (migration 0051)：Google Maps Platform 全套切換 — `pois.osm_id` (number) → `place_id` (Google ChIJ string)；
>   新 lifecycle cols `status` (active/closed/missing) + `status_reason` + `status_checked_at` + `last_refreshed_at`；
>   新 `<PoiStatusBadge>` (`.tp-badge.is-destructive` 已歇業 / `.tp-badge.is-warning` 查無資料 — 對齊既有 tp-badge primitive，**禁 emoji + 禁 strikethrough**) +
>   新 `<TripHealthBanner>` (sticky chrome group：TitleBar 56/64 → banner 41/45 → DayNav；role=status / aria-live=polite / 不可 dismiss / empty return null) +
>   新 `<MapSkeleton>` (Google Maps JS 300-500KB lazy-load 期間 shimmer + spinner)；
>   `OceanMap` Leaflet → Google Maps JS API（marker `SymbolPath.CIRCLE` + label，**不再** divIcon HTML）；
>   `MapFabs` preset 街道/衛星/地形 → 路線圖/衛星/混合（Google MapTypeId enum）。
>   Closed POI marker：destructive token color + ✕ glyph + InfoWindow 顯 status_reason（不依賴 color-only signal — WCAG 1.4.1）；
>   Timeline closed entry：`opacity: 0.65`（沿用 data-past pattern）。
> - **v2.22.0** (migration 0050)：`saved_pois` table → `poi_favorites`、`/saved` route → `/favorites`、
>   `/api/saved-pois` → `/api/poi-favorites`、`SavedPoisPage` → `PoiFavoritesPage`、
>   `AddSavedPoiToTripPage` → `AddPoiFavoriteToTripPage`、CSS class `tp-saved-*` → `tp-favorites-*`、
>   AddPoiFavoriteToTripPage 改 4-field 純時間驅動（廢 position + anchorEntryId）、
>   PoiFavoritesPage TitleBar label 從「我的收藏」→「收藏」（hero eyebrow 補回 ownership 語意）、
>   batch toolbar 改 delete-only（per-card add-to-trip 為唯一入口）。
> - **v2.21.0** (migration 0046+0047)：`trip_ideas` 退場 → `saved_pois` 升 universal pool；
>   `trips.owner_email` → `owner_user_id`；`saved_pois.email` / `trip_permissions.email` DROPPED。
> - **v2.19.x**（migration 0045）：`pois.google_rating` → `rating`；`pois.maps` DROPPED；
>   `trips.{auto_scroll,og_description,footer,food_prefs,is_default,self_drive}` DROPPED。
>
> 下方規範皆已對齊新名稱。詳 schema 細節見 ARCHITECTURE.md「Schema / IA Naming History」表。

「備案」概念退場，所有「想去但沒進行程」的景點統一進「收藏」(`poi_favorites`)，
跨 trip universal pool。trip ownership identity cutover 同步走完
email → user_id 完整切換。

### poi_favorites universal pool

- **單一收藏池**：每個 user 一個 `poi_favorites` 池。`(user_id, poi_id)` UNIQUE — 不能重複收藏同 POI。
- **跨 trip 反查**：透過 `poi_favorites.poi_id ← trip_pois.poi_id` JOIN，每筆收藏即時可知「目前在哪些 trip / 哪天 / 哪 entry 出現」。後端 GET 用 `json_group_array` 一次查（避 N+1），usages 隨收藏 POI row 一起回。
- **「目前在 N 個行程」徽章**：收藏 POI card 在 POI 名稱下方加一行 `--font-size-footnote --color-muted` 文字，內容例「目前在 3 個行程」。N=0 時不渲染（避免「0 個行程」噪音）。
- **進行程不刪收藏**：「搬」 = 複製；poi_favorites 是「跨 trip 願望清單」，進行程不代表不想再去（同景點可能不同 trip 都想去）。

### 加入行程 fast-path（route `/favorites/:id/add-to-trip`）

**Page (full)，不是 modal** — DESIGN.md L390-414 form 規範：>3 fields + select + time picker 必走全頁。檔名 `AddPoiFavoriteToTripPage.tsx`。

**Form fields (4，純時間驅動)** — v2.22.0 起改 4-field schema，移除 position radio + anchorEntryId（mockup v4 sign-off）：
1. trip dropdown（user 只 1 個 trip 自動選）
2. day dropdown（依選定 trip 動態載入 days）
3. start time（可空，依 POI type 推 — restaurant 12:00 / attraction 10:00 / hotel 15:00）
4. end time（可空，預設 = start + stay duration heuristic）

**插入位置**：server 依 startTime 自動排在 day 內第一個更晚 entry 前；無更晚 entry → append。client form 不再選 position。

**Stay duration heuristic by POI type**（同 server）：
- restaurant: 90 min
- shopping: 60 min
- attraction: 120 min
- parking: 15 min
- transport: 30 min
- activity: 90 min
- hotel: overnight (special)
- other: 60 min

**Endpoint**：`POST /api/poi-favorites/:id/add-to-trip`。Fast-path REST，**不走** message-based tp-request — 避免 LLM 8 秒等待感。`travel_*` 欄位 NULL，背景 tp-request 之後 fill。UI 顯示「計算車程中…」placeholder。

### 7-state spec（form 必須涵蓋）

| State | UI | Pattern |
|-------|----|---------|
| **loading** | tp-skel skeleton 3 rows | 同 ChatPage / TripsListPage skeleton |
| **empty (no trip)** | `tp-empty-cta` block + 「建立第一個行程」 link | dashed border + accent CTA |
| **conflict (同 day 同時段)** | reuse ConflictModal pattern | 標 v2.20.1 polish |
| **error (網路/5xx)** | tp-error block (PersistentAlert pattern) | 不用 toast — error 必持久可行動 |
| **success** | navigate to `/trips?selected=:id&day=N&saved_added=1` | 後續 toast 由 TripsListPage handle |
| **optimistic** | submit button busy + label「加入中…」 + disable 防重 click | Apple HIG progress |
| **partial (saved 載到、trips 空)** | empty CTA branch | 同 empty |

### V2 owner identity（email → user_id cutover）

- **canonical id**：`auth.user_id`（V2 session.uid / Bearer tokenRow.user_id）
- **dual-read transition**：`hasPermission` / `hasWritePermission` SQL 同時匹配 email + user_id（`WHERE email = ? OR user_id = ?`），SQLite NULL 語意保護 service token / pre-V2 session。
- **dual-write transition**：所有 write path 同寫 email + user_id 雙欄位（trips.owner + owner_user_id, saved_pois.email + user_id, trip_permissions.email + user_id）。註：v2.22.0 (migration 0050) 後 `saved_pois` 已 rename 為 `poi_favorites`，本段為 v2.21.0 phase 1 歷史描述。
- **Phase 2 cutover (migration 0047)**：drop `saved_pois.email` / `trip_permissions.email` / `trips.owner`（email column）+ UNIQUE constraint 改 `(user_id, poi_id)` / `(user_id, trip_id)`。runbook 強制 manual gate 確認 prod soak 後執行。

### v2.21.0 IA Reshuffle — PoiFavoritesPage 升 primary nav

> **v2.22.0 rename**：原 `SavedPoisPage` / `/saved` 已 rename 為 `PoiFavoritesPage` / `/favorites`（migration 0050）。下方規範已對齊新名稱與 mockup v4 sign-off（2026-05-04）。

「收藏」自 v2.21.0 升為第 4 個 primary nav slot（取代「探索」）。`PoiFavoritesPage` 為獨立 route `/favorites`，從 ExplorePage L887-1011 saved-view section 抽出且擴展為 top-level 頁面。

**PoiFavoritesPage 規格**

| Slot | Content |
|------|---------|
| TitleBar | 中=「收藏」（per L298 統一 label，ownership 語意由 hero eyebrow 補回）, 右=「探索」`.tp-titlebar-action` ghost variant (icon: search) → navigate `/explore` |
| Hero | `tp-page-eyebrow`「我的收藏」+ count meta「N 個收藏 POI」+ region pill row（`role="group"` + `aria-pressed`，reuse ExplorePage L470-885 邏輯）+ type filter row（餐廳 / 景點 / 飯店 / 購物 / 其他）+ search-within-favorites (`<input type="search">` client-side filter，200+ POIs 必須能搜) |
| Body | 收藏 POI grid + 「目前在 N 個行程」usage badges + per-card「加入行程 →」link to `/favorites/:id/add-to-trip` |
| Batch toolbar | sticky bottom toolbar（multi-select 啟動時顯示）：「全選 / 取消 / 刪除」三 action — **不支援 batch add-to-trip**（per-card link 才是加入行程入口，batch 僅刪除） |

**Batch flow（DUC1 sign-off — delete-only）**

- per-card：永遠顯示「加入行程 →」link（單一 add-to-trip 入口）
- multi-select 模式：點 card checkbox 觸發 → sticky bottom toolbar 顯示 → 僅「全選 / 取消 / 刪除」三 action
- 為何不支援 batch add-to-trip：每筆收藏的 day / startTime / endTime 必為個別決策，batch 強迫一致會破壞 form 純時間驅動 schema（4 fields）

**8-state matrix（必涵蓋，replaces 原 5-state）**

| State | UI |
|-------|----|
| loading | `tp-skel` 3-card grid skeleton |
| empty-pool | `tp-empty-cta` block + 「還沒有收藏。去探索找景點」 CTA → `/explore` |
| filter-no-results | hero filters + body 「目前的篩選沒有符合的收藏」+ 「清除篩選」secondary action |
| error | `PageErrorState` + retry button (fetch /api/poi-favorites 失敗) |
| data | grid + usage badges + per-card add-to-trip link |
| optimistic-delete | 刪除中 card opacity 0.5 + 「移除中…」label + `aria-live="polite"` |
| bulk-action-busy | sticky toolbar 「刪除中 N 筆…」+ 全卡片 disable 防重 click |
| pagination | data 滿 24 筆 → 底部 sticky search 條 + 載入更多 button（200+ POIs 才出現） |

**Viewport breakpoints**

| Viewport | Grid columns | 行為 |
|----------|--------------|------|
| ≥1024px | 3-col | desktop sidebar + content max-width 1040px + 3-col grid |
| 640-1023px | 2-col | compact + 2-col grid |
| <430px | 1-col | phone + 1-col stack |

**Accessibility 規範**

- region pill row + type filter row 用 `role="group"` + 每個 chip `aria-pressed="true|false"`（**不用** `role="tablist"` — 並非 tab 切換語意，是 OR-filter）
- 每個 card 含 checkbox 時，checkbox `aria-label` 形如「選擇『五十嵐拉麵』收藏」（含 POI 名稱不只「選擇」）
- optimistic-delete + bulk-action-busy state 用 `aria-live="polite"` announce 變動
- search input `<input type="search">` + `aria-label="搜尋收藏"`，無 label 時加 visually-hidden label

**ExplorePage 變動（v2.21.0 同 PR）**

- 移除 tab state machine 與 `aria-label="我的收藏"` 殘留 ARIA（screen reader 不再 announce 已不存在的 tab）
- 純探索化（POI search + region pills + 「加入收藏」 heart toggle 仍在）
- 仍 mini-fetch `/poi-favorites` 取 `favoriteKeySet` 維 heart-disable 正確性（無 React Query/SWR，state 各頁獨立）
- TitleBar 右側 action 改 navigate `/favorites`

### Retired / 拔除

- ❌ `trip_ideas` table + `IdeasTabContent.tsx` + `?sheet=ideas` URL pattern
- ❌ tp-request `trip-edit` vs `trip-plan` mode 分流（HuiYun 誤判事件 → 改為依語意行動）
- ❌ tp-request 「修改 vs 諮詢」 intent 分流（同上）
- ❌ ExplorePage 內 saved/search dual-tab（v2.21.0 拆 page，saved 獨立路由）
- ✅ `?sheet=ideas` legacy URL graceful degrade to default tab（不爆）

## Design Principles（開發時參考）
1. **DESIGN.md + design-sessions 是單一來源** — `tokens.css` 是實作；若文件和程式衝突，先更新文件再實作。
2. **柔褐三色 tone 分區** — 玩/看/買（景點·購物·活動）+ active/CTA 用柔褐；住/移動（住宿·交通·停車）用 sage；吃（用餐·咖啡）+ 備選/收藏用粉。同類型同色、不交叉，避免七彩稀釋重點；中性類型維持 ink。展開明細與卡片同色。
3. **Chrome 一致優先** — 聊天、行程、地圖、收藏、帳號的 sidebar / bottom nav / titlebar 行為要一致；desktop 帳號以 account chip 呈現，compact 帳號以 bottom-nav tab 呈現；地圖只例外在內容 full bleed。
4. **內容寬度一致** — 一般頁面統一 `1040px` content max width；局部表單可在內部限寬，但外層節奏一致。
5. **行程明細單一來源** — Desktop / compact 共用同一份內容樹與狀態來源，只讓 layout responsive。
6. **Bottom nav 是主功能定位** — 子頁 active item 依所屬主功能，不把 bottom nav 當 breadcrumb。
7. **錯誤必須可見且可行動** — Toast 只處理離線/恢復連線/低風險狀態；真正錯誤使用 persistent surface。
8. **Hairline over shadow** — 卡片區分優先用 1px border，shadow 只用在浮層（toast、sheet、dialog）。
9. **Tabular numbers everywhere** — 時間、日期、stats 數字強制 `tabular-nums`。
10. **無裝飾元素** — 不用 gradient、emoji、decorative SVG、rainbow 類型色；資訊本身是主角。
