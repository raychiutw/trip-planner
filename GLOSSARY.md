# Context — Tripline 領域詞彙

這份是 **ubiquitous language**：agent 與人在 issue 標題、重構提案、測試名稱、commit 訊息裡都用這裡的詞，不要飄到同義詞。

只定義「叫什麼、是什麼、別叫什麼」，不放實作。資料模型與架構決策 → `ARCHITECTURE.md`、`docs/adr/`｜UI/UX 規範 → `DESIGN.md`｜待做需求與規格 → GitHub Issues

---

## 行程結構（時間軸）

| 詞 | 意思 |
|---|---|
| **trip（行程）** | 一趟旅行。擁有者是建立它的使用者。 |
| **destination（目的地）** | 一趟行程可有多個目的地。 |
| **day（天）** | 行程的某一天。當天住宿是這一天的屬性，不是 entry。 |
| **entry（條目）** | 某一天時間軸上的一格。**entry 沒有自己的名稱** —— 顯示名稱來自它的正選 POI。 |
| **segment（車程 / 交通段）** | 兩個相鄰 entry 之間的移動。由系統算出，或使用者手填。 |

**entry intake**：
後端「在某一天建立 entry 並掛上正選／備選 POI」的唯一入口。單筆新增、批次建立與整日替換共用同一套欄位規則。
_Avoid_: 在 handler 直接寫 entry 與 POI 關聯；與前端的「entry 變更」是不同層。

**行程建立**：
匯入與分享 clone 產生新行程的完整寫入流程。來源驗證、可見性與授權由各入口負責。

**entry 變更**：
前端改動 entry 的動作集合。成功後通知畫面更新並重算車程，失敗不重算。
_Avoid_: 頁面或元件自己發更新事件、自己觸發重算；與後端的「entry intake」是不同層。

**segment 生命週期**：
車程的讀取、缺口判定與「待更新」狀態。只有成功的讀取能證明缺口；失敗的讀取不視為空資料。entry 儲存成功與車程重算成功是兩件事。

## POI 與正選／備選

| 詞 | 意思 |
|---|---|
| **POI** | 地點主檔，以 Google `place_id` 為唯一識別。是**跨行程共用的唯讀主檔**，不存任何行程專屬的客製。 |
| **正選（master / primary）** | 一個 entry 掛的主要 POI。 |
| **備選（alternate）** | 同一個 entry 的候補 POI。 |
| **POI 關聯** | POI 之間的多對多關係（例：某景點附近的餐廳）。 |
| **favorite（收藏）** | 跨行程的願望清單。**不是** entry、不屬於任何一天。 |

> **行程專屬的自由文字不寫進 POI 主檔。** entry 說明、POI 備註與預訂都屬於行程。預訂（reservation）是**純文字訂位註解**，不放 JSON。

## 協作與存取

| 詞 | 意思 |
|---|---|
| **permission（權限）** | 誰能看／改哪個 trip。 |
| **companion（旅伴）** | 被授權的協作者。可送 request、可動收藏，但**動不了 entries**（見 `ARCHITECTURE.md` 的身份章節）。 |
| **invitation（邀請）** | 尚未接受的協作邀請。 |
| **share（分享）** | 未登入可讀的分享連結。 |
| **request（請求 / AI 聊天）** | 旅伴用自然語言提的改行程／問建議。**「行程 AI 聊天」在後端就是 request 流程**，不是另一套系統。 |

### 請求怎麼結束（2026-07-28 grill 釘）

一筆 request 結束時，**「結束了」與「為什麼結束」是兩件事**：讀取端兩個都要看。理由見 [ADR-0007](docs/adr/0007-request-termination-cancel-and-reap.md)。

**停止等待**：
使用者主動終結一筆還在等的 request。語意是「我不等了」，讓輸入框放開、隊列解開 —— **不是**叫 AI 停手，AI 可能還會繼續改行程。
_Avoid_: 「取消」「中斷」「abort」（都會讓人以為 AI 停了，實際上沒有）

**殭屍請求**：
停在處理中、但已經沒有 worker 會再處理它的 request。**不是**「處理得很慢」—— 慢的請求還有人在跑。
_Avoid_: 卡住、stuck（歧義：同時被拿來指殭屍請求與「我不想等了」，那是兩件事、兩套機制）

**收屍**：
系統把殭屍請求標成終結。兩層：agent 確定 worker 死亡時就地標，加上牆鐘兜底。
_Avoid_: 超時（只描述其中一層）、清理（跟 orphan session 的清理混淆）

**遲到完成**：
request 已經終結之後，worker 才回報進來的成果。它的回覆寫得進去，但不會讓 request 復活。

**request worker**：
agent 裡驅動 request 流程的核心 module。
_Avoid_: 「worker」單獨講指這個 module，跑 AI 的 claude session 叫 session。

## 行程筆記

行程層級的資訊：航班、住宿、預訂、行前須知、緊急聯絡，以及 AI 產生的項目。**人工維護的項目不可被重新生成覆蓋**；「恢復排除」只移除排除記錄，不代表立即把項目加回。

## 稽核與維運

| 詞 | 意思 |
|---|---|
| **audit_log** | **行程資料變更**稽核。rollback 功能讀它。 |
| **auth_audit_log** | **登入／OAuth 事件**稽核。**與 `audit_log` 是兩張不同的表，不要混用。** |
| **api_logs** | 錯誤日誌。 |

---

## 介面與互動

同一塊畫面在 code、`DESIGN.md`、對話裡有 sheet / panel / modal / 右欄 / 第三欄 / 面板 六種叫法，指的卻不是同一件事。這裡按**角色**定名 —— 角色跨手機／桌機都成立，位置不成立（桌機預設兩欄，只有行程與地圖情境才有第三欄；同一個東西在手機上根本不是欄）。

**操作面板**：
從行程詳情鑽進去的一項操作所在的表面（編輯行程、加景點、換景點…）。桌機呈現為側邊面板、手機為整頁下鑽 —— **同一個概念、兩種呈現**。
_Avoid_: 指稱這個概念時不要用 右欄／第三欄／sheet／L2 modal（那些是版面位置，桌機才有、手機不成立）

**行程 sheet**：
陪著行程詳情一起顯示的情境輔助面（地圖與其 tabs）。是**陪襯**不是操作。
_Avoid_: 側邊欄、右欄、地圖欄

**bottom sheet**：
手機上由畫面下方浮出的暫時性覆蓋層，關掉就回到原處、不改變所在頁面。
_Avoid_: 抽屜、彈窗、浮層

**對話框**：
置中、有 backdrop、**必須回應才能繼續**的中斷式覆蓋層（確認刪除、輸入、衝突提示）。
_Avoid_: 彈窗、popup、面板、modal（中文行文時）

**行內警示**：
嵌在內容流裡、不中斷操作的警示訊息。它**不是**面板也不是對話框。
_Avoid_: 警示面板、alert panel

**堆疊層級**：
使用者從行程詳情往下鑽了幾層。第一層只給「關閉」，更深層才給「返回上一層」。
_Avoid_: 深度、L2/L3（口語可用，寫文件時用「第一層／更深層」）

**導覽 tab（三種別搞混，2026-07-24 grill 釘）**：
- **root tab（主 tab）**：底部 4-tab 導覽（聊天／行程／地圖／收藏），app 的 primary IA。**常駐**（捲動不隱；只有手機鍵盤彈出時才收起）。
- **Day tab（日期 tab）**：行程明細與地圖**共用**的日期切換列（總覽／DAY 1–N）。視覺比照 root tab。
- **trip switcher（選擇行程下拉）**：titlebar「行程名稱 + ⌄」，切換 **active trip**。聊天、地圖、行程三個 tab 都以 active trip 為準；上次檢視的行程不等同 active trip。
- **trips 篩選 tab**：行程清單頁的 全部／我的／共編／已歸檔，只出現在行程清單頁。
- **行程歸檔**：只改清單分類，不撤銷行程權限、不改內容。
_Avoid_: 「**POI tab**」—— 歧義（曾同時被拿來指 Day tab 與收藏頁篩選），一律改叫 **Day tab**；收藏頁的類型／地區是「收藏篩選」，不是 tab。

> **單獨寫「sheet」是有歧義的** —— 它可能指行程 sheet、bottom sheet，或版面裡裝這些東西的槽位。文件與 issue 裡要指名是哪一個。版面本身（幾欄、怎麼排）屬 `DESIGN.md`，不在本詞彙表。

---

## 三個專案與角色（2026-10-31 grill 釘，拆分進行中）

三個角色各自一個專案。決策與殘留風險見 [ADR-0011](docs/adr/0011-split-web-api-agent-and-bearer-token.md)。

| 詞 | 意思 |
|---|---|
| **web** | 使用者在瀏覽器操作的前端，專案 `trip-planner`。不持有任何後端憑證。 |
| **api** | 對外提供資料與行為的後端，專案 `trip-planner-api`。擁有資料庫結構與對外契約。 |
| **agent** | 替請求執行 AI 工作、寄信與排程的常駐服務，專案 `trip-planner-agent`。_Avoid_：「api-server」「本機 api」（會跟 api 混淆） |
| **舊入口** | 拆分前就存在、仍連同一份資料的舊後端。凍結，只收安全修補。_Avoid_：「備援」（它不會自動接手） |
| **對照組** | 整合測試用的行為基準：舊入口的程式碼搭配消毒過的資料副本。新 api 必須與它一致才算通過。 |
| **一次性 ticket** | 讓瀏覽器開即時推送連線的臨時憑證，只對單一 request 有效，用過即失效。 |

## 已退場的名字 — 不要再用

hard cutover、**沒有 alias**。grep 不到舊名是正常的，對照這張表改用新名，不要自己加相容層。

| 別用 | 改用 | 何時退場 |
|---|---|---|
| `trip_pois` | `trip_entry_pois` + `trip_days.hotel_poi_id` + `poi_relations` | v2.29.0 |
| `saved_pois` | `poi_favorites`（route `/favorites`、API `/api/poi-favorites`） | v2.22.0 |
| `trip_ideas` | 併入 `poi_favorites`（升為跨行程願望清單） | v2.21.0 |
| `trip_entries.title` | entry 顯示名稱 = 正選 POI 的 `name` | v2.55.22 |
| `trip_segments.mode_source`／「上鎖」概念 | 用 `mode`（`transit` = 手填） | v2.30.0 |
| `trips.owner_email` | `trips.owner_user_id` | v2.21.0 |
| `trip_requests.mode` | 不再 dispatch by mode，改 auto-classify intent | v2.21.3 |
| `pois.google_rating`／`pois.maps` | `pois.rating`／已移除 | v2.19.x |
| `pois.photos` | **全站不做 POI 照片**（DESIGN.md）；欄位已 DROP | v2.55.78 |
| `trip_docs` / `trip_doc_entries` | 行程筆記走 `trip_pretrip_notes` / `trip_emergency_contacts` / `trip_flights` / `trip_lodgings` / `trip_reservations`（migration 0073）。兩張表已 DROP（0094），內容由 0093 搬進 pretrip notes | v2.57.78 |

完整 rename 歷史（含 migration 編號）見 `ARCHITECTURE.md` 的 **Schema / IA Naming History**。
