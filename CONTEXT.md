# Context — Tripline 領域詞彙

這份是 **ubiquitous language**：agent 與人在 issue 標題、重構提案、測試名稱、commit 訊息裡都用這裡的詞，不要飄到同義詞。

深度資料在別處，這裡只定義「叫什麼、是什麼、別叫什麼」：
資料模型與架構決策 → `ARCHITECTURE.md`｜UI/UX 規範 → `DESIGN.md`｜待做需求與規格 → GitHub Issues

---

## 行程結構（時間軸）

```
trips ─┬─ trip_days ── trip_entries ── trip_entry_pois
       └─ trip_destinations
```

| 詞 | 意思 |
|---|---|
| **trip（行程）** | 一趟旅行。`trips`。擁有者是 `owner_user_id`。 |
| **destination（目的地）** | 一趟行程可有多個目的地。`trip_destinations`。 |
| **day（天）** | 行程的某一天。`trip_days`。當天住宿掛在 `trip_days.hotel_poi_id`（FK，不是 entry）。 |
| **entry（條目）** | 某一天時間軸上的一格。`trip_entries`。**entry 沒有自己的名稱** —— 顯示名稱來自它的正選 POI（見下）。 |
| **segment（車程 / 交通段）** | 兩個相鄰 entry 之間的移動。`trip_segments`。由 Google Routes 算出或使用者手填（`mode='transit'` 才手填分鐘數）。 |

## POI 與正選／備選

| 詞 | 意思 |
|---|---|
| **POI** | 地點主檔。`pois`。以 Google `place_id` 為 canonical ID，含 status lifecycle（`active` / `closed` / `missing`）。POI 是**跨行程共用的 immutable master**，不存任何 trip-scoped 客製。 |
| **正選（master / primary）** | 一個 entry 掛的主要 POI —— `trip_entry_pois.sort_order = 1`。 |
| **備選（alternate）** | 同一 entry 的候補 POI —— `sort_order > 1`。 |
| **poi_relations** | POI 之間的多對多關聯（例：某景點附近的餐廳）。 |
| **favorite（收藏）** | 跨行程的願望清單。`poi_favorites`。**不是** entry、不屬於任何一天。 |

**entry intake**：
後端「在某一天建立 entry 並掛上正選／備選 POI」的 module（`_entryWrite`）。單筆新增／收藏使用 `createEntry`，複製／分享 clone／匯入使用 `createEntriesBatch`，整日重寫使用 `replaceDayEntries`；共用 entry 與 junction 欄位規則。

**新行程建立**：`functions/api/trips/_tripCreation.ts` 持有整趟行程的必要寫入順序、來源 day／entry key 到新 ID 的對應、已建立資料帳本、分批提交及失敗補償。匯入與分享 clone 入口只保留授權、各自驗證與限制、命名及來源轉換；分享筆記 default-deny 篩選也留在 clone。建立 module 內沿用 entry intake 的正選／備選、版本及 audit 規則，保留不同來源的欄位預設與筆記 AI 來源語意。

每批成功提交才把建立結果記入帳本；trip 尚未成功建立時不取得該 ID 的清理權，避免碰撞時誤刪他人的行程。必要寫入失敗仍回報失敗，記錄 trip ID、失敗階段與原始錯誤；補償再失敗時同時保留清理錯誤。清理成功可重新匯入，但沒有跨批次原子交易、持久化帳本或自動重播承諾。既有 audit 保留政策不變。

共用 POI 依 fill-null 補空欄位，非空資料不覆寫；補入既有 POI 的欄位不隨補償還原。帳本只追蹤本次新建 POI。整日替換繼續使用下述同批次交易，不套用新行程的補償方式。

**整日替換**先完成輸入驗證與 POI resolve，再於同一 D1 batch 提交舊 entries 刪除、day 欄位與版本、新 entries、正選／備選、飯店及停車關聯。必要寫入失敗由資料庫回滾，舊 day 不需事後補償；不使用新增批次的 50 筆分批策略。批次超過平台限制也回報失敗，不宣稱已儲存。共用 POI 的 `fill-null` 政策維持原樣。

名稱重寫依正選 POI 與原順序一對一承接舊備選，保留各自 description、note、reservation、reservation_url。新的明示 POI 清單取代原清單。新 entry 有 POI 時 `entry_pois_version=1`，承接備選時為 2；合法無 POI 佔位為 0。day 的 `version` 每次成功替換加一，失敗不變。
_Avoid_: 在 handler 直接 `INSERT INTO trip_entries` / `trip_entry_pois`；與前端的「entry 變更」（動詞 module，見下）是不同層。

**entry 變更**：
前端改動 entry 的動詞 module（`src/lib/entryMutations.ts`：createEntry / setMaster / deleteEntry / moveEntry / updateEntry / reorderEntries / updateEntryPoi…）。每個動詞回 Result，不 toast、不導覽；成功後 emit `entryUpdated` 並以正確 day scope 觸發車程重算（跨天兩個 day 各一次），失敗 emit resync 不重算。頁面只拿 Result 決定 toast／navigate。

跨日移動更新來源與目標，複製更新目標，不受目前選中的日期限制。讀取協調以每次行程切換及每個 day 的請求序號識別回應，只接受該 scope 最新的結果；其他行程的事件不觸發目前行程重讀。操作面板與拖曳儲存完成時也核對操作所屬的行程生命週期，避免舊操作顯示提示或導頁。

entry 儲存成功與 segment 重算成功是兩件事。重算故障時保留已儲存的 entry，交通沿用「車程待更新」提示；重新載入或真正改變相鄰景點的操作可依既有 single-flight／gap-signature 規則再次嘗試，不重送原本的建立操作。這層只協調重算入口，不計算路徑：Google client、手填 transit 及既有特定方式估算的界線維持原樣。
_Avoid_: 在頁面或元件直接 `apiFetchRaw` entries endpoint、自己 dispatch `entryUpdated`、自己呼叫 `requestTravelRecompute`（self-healing 的 auto 觸發除外）；與後端「entry intake」是不同層。

**segment 生命週期**：`useTripSegments` 與既有 `TripSegmentsContext` 持有讀取、缺口補算與待更新狀態；TripPage、TimelineRail、DaySection、EditEntryPage 都經過同一個 hook。畫面提供日期、entry 與尚未提交的排序狀態，module 才判斷可補算的相鄰缺口。未知日期與缺座標不擴張成全行程自動補算。

成功快照可繼續呈現，但讀取中或刷新失敗的資料不能建立新的補算依據；讀取中收到更新會保留一次後續重讀，過期回應不發布。每次行程切換都有獨立讀取身分，A→B→A 也不接受第一輪 A 的結果。

entry 成功儲存後，即使原畫面已離開，仍完成必要的來源／目標重算；過期操作不再通知目前畫面或顯示提示。補算沿用 single-flight、gap signature 與唯讀停止規則；失敗與 403 停止狀態保留，即使完成時已離開該行程，返回後仍呈現待更新。新畫面若加入尚未完成的同一補算，可收到自己的完成通知；沒有目前讀取者接續的舊完成不刷新新畫面。手動交通編輯的既有通知同樣經由此讀取生命週期更新。

> **trip-scoped 的自由文字不寫進 `pois`** —— entry 說明放 `trip_entries.description`；POI 備註與預訂放 `trip_entry_pois` 的 `reservation` / `reservation_url` / `description` / `note` 欄位。migration 0078 後沒有 `trip_entries.note`；entry-level note 輸入由正選承接。`reservation` 是**純文字訂位註解**，不放 JSON。

## 協作與存取

| 詞 | 意思 |
|---|---|
| **permission（權限）** | 誰能看／改哪個 trip。`trip_permissions`。 |
| **companion（旅伴）** | 被授權的協作者。可送 request、可動收藏，但**動不了 entries**（見 `ARCHITECTURE.md` 的身份章節）。 |
| **invitation（邀請）** | 尚未接受的協作邀請。`trip_invitations`。 |
| **share（分享）** | 未登入可讀的分享連結。`trip_shares`。 |
| **request（請求 / AI 聊天）** | 旅伴用自然語言提的改行程／問建議。`trip_requests`。**「行程 AI 聊天」在後端就是 requests pipeline**，不是另一套系統。 |

### 請求怎麼結束（2026-07-28 grill 釘）

一筆 request 結束時，**「結束了」與「為什麼結束」是兩個欄位**：`status` 說終結與否，`terminal_reason` 說原因。讀取端兩個都要看。理由（以及為什麼不把原因塞進 `status`）見 [ADR-0007](docs/adr/0007-request-termination-cancel-and-reap.md)。

**首次終結與收尾重試**：已授權的 request 更新由 `_requestTermination.updateRequest` 持有。第一次確立的終結狀態與原因不被後來通知改寫；request 先終結，健檢與筆記再獨立收尾。關聯查詢或資料庫寫入暫時失敗時，可重送終結通知補做。已保存的健檢 findings 不重新解析為空資料；筆記沿用 generation 與人工資料保護，遲到回覆不復活 request。

**對話終結狀態**：主 tab 與行程 sheet 共用 `useConversation`。歷史與即時結果經同一個 request → 泡泡轉換；SSE 只有 status 時，由對話模組補讀完整 request。停止等待為中性態，真正失敗保留失敗態；完成但沒有 reply 也不再等待。終結後仍以原 request 身分接收遲到回覆，合併原泡泡、不重新鎖住輸入框。每 30 秒及切回頁面時補讀可見的未完成回報；暫時讀取失敗保留已知狀態並重試。

**對話生命週期**：送出、optimistic 泡泡、歷史合併、等待恢復及斷線補回皆由同一個對話模組協調。等待由已合併的泡泡推導，舊歷史不能重新鎖住已完成 request；request ID 加角色決定同一訊息，保留既有畫面 ID。送出尚未取得 ID 時也會擋重複提交。每次切換行程都有獨立 generation，離開後的送出、分頁、SSE／poll 及 callback 都不能回寫新對話；返回時讀取持久化進度。分頁沿用原本「往前載入補位、離開底部不自動跳轉」政策，沒有擴張 #1209。

**停止等待**：
使用者主動終結一筆還在等的 request。語意是「我不等了」，讓輸入框放開、隊列解開 —— **不是**叫 AI 停手，AI 可能還會繼續改行程。
_Avoid_: 「取消」「中斷」「abort」（都會讓人以為 AI 停了，實際上沒有）

**殭屍請求**：
停在 `open`/`processing`、但已經沒有 worker 會再處理它的 request。**不是**「處理得很慢」—— 慢的請求還有人在跑。
_Avoid_: 卡住、stuck（歧義：同時被拿來指殭屍請求與「我不想等了」，那是兩件事、兩套機制）

**收屍**：
系統把殭屍請求標成終結。兩層：api-server 確定 worker 死亡時就地標，加上牆鐘兜底。
_Avoid_: 超時（只描述其中一層）、清理（跟 orphan tmux session 的清理混淆）

**request worker**：
api-server 裡驅動 requests pipeline 的核心（`scripts/lib/request-worker.ts`）：同 skill 鎖定及 session 去重 → peek 隊列 → 取 token（/tp-request 走 owner-restricted）→ 建立 session → 真實 REPL 就緒及提交協定 → watch → 收尾。接受 fetch／process／pane／clock adapter 注入；adapter 只執行外部效果，不回呼 worker。隔離暫時未就緒不啟動也不收屍；建立、REPL 或提交失敗先確認並關閉已有 session，再以 error 收尾。drained 不收新進 request，died／90 分鐘 deadline 走 timed_out；所有退出均釋放該 skill 的鎖。api-server 本體保留 HTTP／cron／寄信與健康狀態接線。
_Avoid_: 在 api-server 頂層函式裡直接寫決策（那樣只能 readFileSync 測）；「worker」單獨講指這個 module，tmux 裡跑的 claude session 叫 session。

**遲到完成**：
request 已經終結之後，worker 才回報進來的成果。它的 `reply` 寫得進去，但不會讓 `status` 復活。

## 行程筆記（trip-level metadata）

`trip_flights`（航班）· `trip_lodgings`（住宿）· `trip_reservations`（預訂）· `trip_pretrip_notes`（行前須知）· `trip_emergency_contacts`（緊急聯絡）· `trip_note_ai_jobs`（AI 產生任務）· `trip_note_ai_exclusions`（已刪 AI 主題的排除 tombstone）

AI 來源項目用 `origin` 記來源、`managed_by` 記目前由人或 AI 維護、`semantic_key` 辨識同一主題。人工維護項目不可被重新生成覆蓋；「恢復排除」只移除 tombstone，不代表立即把項目加回。

## 稽核與維運

| 詞 | 意思 |
|---|---|
| **audit_log** | **行程資料變更**稽核（trip_id / action / diff_json / snapshot）。rollback 功能讀它。保留 60 天。 |
| **auth_audit_log** | **登入／OAuth 事件**稽核（ip_hash）。保留 60 天。**與 `audit_log` 是兩張不同的表，不要混用。** |
| **api_logs** | 錯誤日誌（`source` 欄分類）。保留 60 天。 |

---

## OAuth token 發行

**Token lifecycle**：`functions/api/oauth/_tokenLifecycle.ts` 持有授權碼交換、refresh 輪替的驗證、一次性消耗、pair 發行與 replay／family 撤銷政策。入口只處理 client 認證、協定解析／輸出及既有選用的 ID token 簽署。適用的 client／redirect／PKCE／scope 驗證必須先於任何 grant 消耗或撤銷。合法 refresh reuse 撤銷同一 grantId 的 access／refresh；其他 client 的錯誤請求不能觸發撤銷。

**完整發行**：D1 adapter 以同一 batch 寫入 access、refresh 與來源 grant 關聯；消耗先以 CAS 提交，後續失敗不復活一次性 grant。來源必須仍存在且已消耗，避免已撤銷的 refresh family 在並行發行後重新出現。沿用既有 payload 與 TTL，沒有資料遷移。

---

## 維運檢查結果

**一次檢查結果**：`scripts/lib/operations-run.js` 的 `runOperations` 協調具名來源，分別持有 `completion`（complete／partial／failed）、`severity` 與來源資料。必要檢查完整且沒有異常才可顯示健康；完整但零資料必須另外標示。

daily-check 與日報都使用此結果產生 JSON、HTML 與摘要；`sources` 的具名結果是唯一完成度／嚴重程度來源。daily-check 保留既有頂層資料欄位供舊消費者讀取，摘要及新 message renderer 直接讀共用結果。來源失敗不清除其他來源資料；route health 的 HTTP 異常與網路未完成會同時反映在摘要。

| 入口 | 必要檢查／告警來源 | 資訊來源（不新增告警） |
|---|---|---|
| daily-check | Sentry、經既有規則篩選的 API errors、npm audit、未完成請求、排程 log、route health、prod data hygiene、audit anomaly；Google Maps quota 在已設定 client credentials 時為必要 | Workers、Web Analytics；未設定憑證的 Maps quota 顯示未執行，不假造用量 |
| daily-report | 連結、Sentry、資料異常偵測 | 行程修改統計、Workers、Web Analytics、Lighthouse 分數、未經 daily-check 篩選的原始 API log 計數 |

某行程 days 查詢失敗仍保留其他行程的連結證據；資料異常偵測的某條查詢失敗也保留已知異常。查詢失敗不能由空陣列推導為全部正常。HTTP 錯誤與網路失敗分別表達已知異常及檢查完成度。資訊來源查詢失敗會明示，但不一律轉成健康告警。

來源 adapter 保留 D1 client 的既有重試、token helper、route health 門檻、Google Maps 額度及告警政策。npm audit 保留 180 秒 timeout、32 MiB buffer；無有效 audit 結果視為未完成。排程 log 的 ENOENT 仍表示沒有 log，其餘讀取錯誤列為未完成。通知對象、管道及資料異常通知條件沿用既有設定，測試不寄通知。

CLI 輸出：daily-check 的 `scripts/logs/daily-check/YYYY-MM-DD-report.json` 與同名 `.html`；daily-report 的 `report.json` 與 `report.html`。匯入來源 factory 或 renderer 不會啟動掃描、寄信或寫檔。

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
嵌在內容流裡、不中斷操作的警示訊息（元件名叫 `AlertPanel`，但它**不是**面板也不是對話框）。
_Avoid_: 警示面板、alert panel

**堆疊層級**：
使用者從行程詳情往下鑽了幾層。第一層只給「關閉」，更深層才給「返回上一層」。
_Avoid_: 深度、L2/L3（口語可用，寫文件時用「第一層／更深層」）

**導覽 tab（三種別搞混，2026-07-24 grill 釘）**：
- **root tab（主 tab）**：底部 4-tab 導覽（聊天／行程／地圖／收藏）。元件 `GlobalBottomNav`，玻璃膠囊 + 滑動 active thumb，app 的 primary IA。**常駐**（捲動不隱；只有手機鍵盤彈出時才收起）。
- **Day tab（日期 tab）**：行程明細與地圖**共用**的日期切換列（總覽／DAY 1–N）。元件 `MapDayTab` + `.tp-map-day-tabs`（`DayNav` 復用同一套）。視覺比照 root tab（owner 2026-07-24）。
- **trip switcher（選擇行程下拉）**：titlebar「行程名稱 + ⌄」的 `TripTitleSwitcher`，切換 **active trip**（單一真相＝`ActiveTripContext`，persist `LS_KEY_TRIP_PREF`；聊天／地圖／行程三 tab 都應以它為準）。
- **trips 篩選 tab**：`.tp-trips-tab`（全部／我的／共編／已歸檔），只在行程清單頁。
_Avoid_: 「**POI tab**」—— 歧義（曾同時被拿來指 Day tab 與收藏頁篩選），一律改叫 **Day tab**；收藏頁的類型／地區是「收藏篩選」（`role=group` pill 列），不是 tab。

> **單獨寫「sheet」是有歧義的** —— 它可能指行程 sheet、bottom sheet，或版面裡裝這些東西的槽位。文件與 issue 裡要指名是哪一個。版面本身（幾欄、怎麼排）屬 `DESIGN.md`，不在本詞彙表。

---

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
