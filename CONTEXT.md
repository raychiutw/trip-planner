# Context — Tripline 領域詞彙

這份是 **ubiquitous language**：agent 與人在 issue 標題、重構提案、測試名稱、commit 訊息裡都用這裡的詞，不要飄到同義詞。

深度資料在別處，這裡只定義「叫什麼、是什麼、別叫什麼」：
資料模型與架構決策 → `ARCHITECTURE.md`｜UI/UX 規範 → `DESIGN.md`｜能力規格 → `openspec/specs/`

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

> **trip-scoped 的自由文字不寫進 `pois`** —— 寫進 `trip_entries.note` 或 `trip_entry_pois.metadata`（`reservation` / `reservation_url` / `description` / `note`）。`reservation` 是**純文字訂位註解**，不放 JSON。

## 協作與存取

| 詞 | 意思 |
|---|---|
| **permission（權限）** | 誰能看／改哪個 trip。`trip_permissions`。 |
| **companion（旅伴）** | 被授權的協作者。可送 request、可動收藏，但**動不了 entries**（見 `ARCHITECTURE.md` 的身份章節）。 |
| **invitation（邀請）** | 尚未接受的協作邀請。`trip_invitations`。 |
| **share（分享）** | 未登入可讀的分享連結。`trip_shares`。 |
| **request（請求 / AI 聊天）** | 旅伴用自然語言提的改行程／問建議。`trip_requests`。**「行程 AI 聊天」在後端就是 requests pipeline**，不是另一套系統。 |

## 行程筆記（trip-level metadata）

`trip_flights`（航班）· `trip_lodgings`（住宿）· `trip_reservations`（預訂）· `trip_pretrip_notes`（行前須知）· `trip_emergency_contacts`（緊急聯絡）· `trip_note_ai_jobs`（AI 產生任務）
附件（機票／訂房 PDF）走 `trip_docs` + `trip_doc_entries`。

## 稽核與維運

| 詞 | 意思 |
|---|---|
| **audit_log** | **行程資料變更**稽核（trip_id / action / diff_json / snapshot）。rollback 功能讀它。保留 60 天。 |
| **auth_audit_log** | **登入／OAuth 事件**稽核（ip_hash）。保留 60 天。**與 `audit_log` 是兩張不同的表，不要混用。** |
| **api_logs** | 錯誤日誌（`source` 欄分類）。保留 60 天。 |

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

完整 rename 歷史（含 migration 編號）見 `ARCHITECTURE.md` 的 **Schema / IA Naming History**。
