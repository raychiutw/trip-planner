# Tripline Web — Apple HIG 合規 Spec（v2 · 鏡像 app #82）

**流程**：Matt flow（grill-with-docs 重新來過）。追蹤器＝**local markdown**（此檔＝to-spec 產物；票見 `tickets.md`）。
**取代**：先前窄框架的 `spec.md`/`tickets.md`（#1117-only）。
**SoT**：Apple HIG；`DESIGN.md` 為衍生、須對齊。（本 effort 不使用 mockup 流程。）
**範圍**：全站 web（**手機 iOS／桌機 macOS**），**鏡像 app issue #82 的產品語言**、翻譯到 web。
**護欄（品牌保留）**：terracotta 當受控 tint、Inter web font、timeline editorial no-glass —— HIG 允許，不對齊。

## 框架決策（grill v2）

| # | 決策 |
|---|---|
| 平台模型 | **C** —— web 鏡像 app #82 結構（4-tab／split-view，一套產品語言），桌機輸入細節走 macOS（hover／右鍵／⌘／游標） |
| IA | **#82** —— 4-tab + 帳號 header sheet（推翻舊「留 tab」） |
| 色彩 | **system 語意色底 + terracotta 受控 tint**（推翻「暖 palette 背景」） |
| 刪除/undo | **#82** —— 無 undo、統一不可復原確認、server-confirm-before-remove、reauth 高影響（推翻「undo 緩做」） |
| 平台翻譯 | SF-風描邊 icon／`backdrop-filter` glass+fallback／省 haptic／系統返回／留 Inter |

---

## 1 · IA & 導覽
- **4 root tabs**：聊天 · 行程 · 地圖 · 收藏。單字標籤 + SF-風 icon。載入/空/離線/錯誤時 4 tab 仍可用。
- **帳號**退出 tab → 每頁 header 右上 `person.crop.circle` → 開**有自己 Navigation Stack 的 Account sheet**；關閉回原頁原狀態；桌機依空間 form sheet／popover；deep-link 舊 Account/Settings 連結仍達對應 sheet 頁。
- **每 branch 保留 Navigation Stack**：切 tab 返回能續原工作。**tab reselect**：在 detail 回該 branch 根、在根捲頂；reselect 不清篩選/不重載。
- **桌機 regular**（C）：sidebar（macOS 風，優於 top tab bar）承載 4 root；深層行程用 **split view**（清單+detail 並排）。
- **gap（audit）**：現為 5-tab + 帳號 tab/rev2 三欄；depth 契約脆弱（T1 stack store）；切 tab 狀態保存不全。

## 2 · 自適應 compact / regular
- **compact（手機瀏覽器）**：4 tab bar 在底、單欄 push。**regular（桌機 ≥1024）**：sidebar + split view。
- compact↔regular 切換（resize）**保留內容與選取**；landscape：Header/內容/accessory 遵守 **safe-area**（inset-top/bottom/left/right）。
- **gap**：橫向 inset 全站未處理（audit rank17/T5）。

## 3 · Header
- 每頁 **inline navigation title**（**不用 Large Title** —— 對 web 桌/手機一致）。**leading** 只放返回/關閉/取消；**trailing** 最多一個主要動作 + overflow menu + 帳號圓圈。
- 完成/取消/儲存用**文字按鈕**；icon-only 動作用語意明確 SF-風 icon。所有 header action ≥ **44×44** + 正確 label。
- **web 譯**：桌機 trailing 動作可 hover 態；overflow = ⋯ menu（桌機亦支援右鍵 contextual）。
- **gap**：現有 Large Title（audit V4）、TitleBar 第二層舊規範（T2/T?）、⋯ 尺寸不一、chevron 用文字字元（audit G6）。

## 4 · Account
- header 圓圈 → Account sheet（自有 stack）；桌機 form sheet／popover。關閉回原狀態。deep-link 相容。
- **gap**：現帳號是 tab（T2 IA 改）；AccountCircle 30×30（T5 → 44 或併入 header 動作）。

## 5 · 色彩 & 材質
- **背景/表面/label/separator/fill** → **system 語意色**（systemBackground/secondarySystemBackground/label/secondaryLabel/separator/fill…），自動 light/dark/**高對比**適應。
- **terracotta 只當受控 tint**：按鈕/連結/選中/tab active tint。**語意色獨立**：info=系統藍（≠accent）、destructive=系統紅（dark 亦可辨識）、success/warn 系統色。
- **材質**：功能層 chrome（tab bar/header/sheet）用 `backdrop-filter` glass 近似 Liquid Glass + **reduced-transparency/高對比 fallback 覆蓋全玻璃面**。timeline editorial no-glass 留。
- **gap（audit）**：`--color-info==--color-accent`（G14）、dark destructive #E8A0A0 過淡（G11）、tab bar 實心膠囊非 tint（G1/V1）、sidebar 浮動玻璃膠囊非扁平（G2/V6）、chrome 材質不一致（G13）、reduced-transparency fallback 不全（G15）、ChatPage phantom error token dark 1.9:1（G8）、ShareLinkModal 無 dark（G9）、座標 chip dark（G10）、toast dark 綁 OS media（G12）。

## 6 · 行程選擇器
- 聊天/行程/地圖 Header 顯示**目前行程名**；點名開「切換行程」selection sheet（checkmark 標目前 + 完整名；清單長時搜尋；單一行程停用隱 chevron；無行程顯建立入口）。
- 切換後**留同 section**；新行程有同 Day 保留否則 Day1；地圖清舊 POI 選取/sheet；聊天草稿依行程分開存。

## 7 · 搜尋
- **inline search field**（內容頂部）：**行程列表、收藏**。地圖/Day/聊天/Account **不顯**頁面搜尋。新增 POI 的 scoped task 內才搜尋。
- 清除/取消搜尋不改其他篩選/選取（可逆局部）；鍵盤 Search 執行 + 收鍵盤不清 query。

## 8 · 底部 accessory
- **root tab bar 與 bottom accessory 兩清楚層級**；**同畫面最多一個 bottom accessory**。
- **聊天 composer**：固定底；1 行成長到 4 行後內捲；空白顯麥克風、有字顯送出；外接鍵盤 Return 換行、⌘Return 送出；鍵盤出現時 composer 在鍵盤上方且 tab bar 隱；切 tab/開 Account/暫離**留草稿**。
- **gap**：透明 nav overlay 攔點擊老坑（memory）→ 用 `--nav-overlay-h` 讓位、pointer-events 分層。

## 9 · Day selector
- Header 下方**可水平捲**：行程時間軸 Day1–N；地圖 全部+Day1–N。selected 自動置中可見；邊緣露下一項；**滑動只瀏覽、點擊才切**；宣告序號/總數/selected；鍵盤左右方向鍵移動。
- **gap**：捲動保持（memory scroll-restore）；方向鍵模型（T?）。

## 10 · 地圖
- 保留**原生 pan/zoom/rotate/double-tap**（Google Maps；不被上層攔）。**點定位控制才請求位置權限**（不過早）。
- 切 全部/Day 同步 marker/route/行程 POI；**marker/route 不只靠顏色區分**（形狀/標籤）。
- **POI accessory**：有行程 POI 持續顯水平卡片列；點 marker 卡片移到對應 POI、滑卡片地圖聚焦 marker；無 POI 隱 accessory + 地圖內空狀態；**外部 POI card 暫時取代**行程 accessory，關閉恢復原 Day/卡片/marker；外部 POI 須經明確加入流程才進行程（探索不誤改資料）。
- **gap**：🔴 /map safe-area 未處理（T5）；Google 原生 zoom 鈕未套樣式（V5）；marker 顏色依賴（新增形狀/標籤）。

## 11 · 表單 & picker
- **系統 date picker**（點日期欄開 calendar）；日期順序/星期/週首日跟 **locale**；不合法日期停用、取消不改值。
- **時間**：只選時分、**5 分鐘間隔**；**12/24 跟系統偏好**（web：`Intl` locale/hourCycle）；起訖錯誤顯欄位旁。
- **容器**：短任務 sheet、長/多步驟 push；**取消 leading、完成/儲存 trailing**；有未存內容關閉前**確認捨棄**；儲存中阻重複提交、成功才關；**失敗保留輸入**；鍵盤 Next/Done + 焦點順序。
- **gap**：時間選擇器強制 24h（#82 app gap，web 查現況）；固定高 chrome 裁字（T6）；px font-size（T6）。

## 12 · 刪除 & 破壞性〔#82 policy〕
- **所有刪除入口 → 同一不可復原確認**（顯示對象名/影響/「無法復原」；**安全選項預設焦點**；破壞鈕明寫「刪除」）。
- **swipe 只揭露刪除、不 full-swipe 執行**；**server 成功後才移畫面**（無樂觀刪除），失敗保留資料/選取/重試。
- 收藏取消同確認、**無 undo**；**不提供垃圾桶/restore window/restore UI**。高影響（刪帳號）**reauth**。
- **code 連帶**：移除 `poi-favorites/[id]/restore.ts` + `UNDO_EXPIRED` + companion；查並改樂觀刪除站點。
- **gap（audit）**：ConfirmModal 破壞鈕預設焦點（P1-1 → safe default）。

## 13 · 拖拉排序
- **明確 drag handle**（tap/menu/拖曳不衝突）；同 Day/跨 Day 拖放；跨 Day 一次同步來源+目的；失敗**完整還原**原序。
- **a11y**：上移/下移/移至其他 Day actions（不靠拖曳也能排）。**iOS leading-edge 返回手勢維持**（自訂水平手勢不擋系統返回）。

## 14 · 狀態（載入/離線）
- 首載 progress 或近版型 skeleton；refresh **保留舊內容**（不閃空）；行程/收藏 **pull to refresh**；離線顯可用快取 + 持續離線狀態 + 重試。
- **gap**：下拉更新整頁 reload 沖 SPA 狀態（T7 → per-view soft refresh）。

## 15 · Accessibility〔折入 #1117〕
- **Dynamic Type**：型級 rem、固定高 chrome → min-height（T6）；**44pt 觸控**全站（hit-slop，T5）；**focus ring** 補回 + 守護測試（T4）；**對比 AA** 雙軌 unit+e2e axe（T4）；**VoiceOver** label/role/Space 鍵/對話框名（T8）；**reduce-motion** JS smooth scroll 走 helper（T8）；**axe** 覆蓋全頁+e2e（T9）；marker 非純色（§10）。

---

## 平台翻譯規則（Q6）
SF Symbols → 一套 SF-風描邊 icon（`Icon.tsx` 統一、去 Material 填色混用）｜Liquid Glass → `backdrop-filter` glass + reduced-transparency fallback｜selection haptic → 省略｜原生邊緣返回 → 系統返回 + app 內 ‹｜SF Pro → Inter。

## Out of scope / 緩做
- 鍵盤全域快捷鍵註冊機制（⌘/Ctrl 跨平台）—— 另立 effort。
- ShareLinkModal 全頁重寫（吸收其 dark/字級）。
- #1118 iOS 26.5 實機驗證 14 項（owner-only HITL）。
- 原生專屬（真 haptic、可 scrub 返回轉場、Share Target、背景同步）—— web 做不到。
- 品牌保留例外（terracotta tint / Inter / editorial no-glass）—— 不對齊。

## 測試 / release gate
- 對比雙軌（unit 解析 tokens.css + e2e axe）；focus-ring 守護測試；tap-target 稽核；zoom/reflow；axe 全頁+e2e；狀態保存/刪除 flow e2e。**a11y 為 release gate**（比照 #82）。
