## Context

目前 Tripline 的行程一日結構由三個獨立區塊組成：頁首的「住宿資訊」卡（`<Hotel>` in `DaySection.tsx`）、下面的「每日交通統計」卡（`<DayDrivingStatsCard>`），再接 `<Timeline>` 的 POI 時間軸。住宿與交通統計脫離了時序主軸，使用者要對照「昨天睡哪、今天從哪出發」時必須跨區塊推敲。

行程資料層面，現有 R8 規則把「每日 hotel」視為 `day.hotel` 物件，獨立於 `day.content.timeline` 之外；timeline 的首個 event 通常是「早餐」或「第一個景點」，沒有 check-out 語意 entry。R0 規定「最後一天不得包含 hotel」，所以 `day.hotel` 目前只代表「當晚入住」。

此 Design 規範新規則 **R19（每日首 timeline entry）** 如何整合進既有 R 規則系統、如何同步改 React UI、如何 migrate 7 個既有行程、以及 edge case 的處理策略。

## Goals / Non-Goals

**Goals:**
- Day 1 首 entry 為抵達點，Day N≥2 首 entry 為前日住宿 POI 的 check-out entry（同 POI 出現在前日末 check-in + 次日頭 check-out 兩個 timeline entry）
- 移除 UI 上「住宿資訊」「每日交通統計」card，讓 timeline 成為一日唯一時序主軸
- `/tp-rebuild` 能把既有 7 個行程自動套新規則，`/tp-check` 全綠
- skill 對應邏輯同步更新，未來用 `/tp-create` 產的新行程直接合規

**Non-Goals:**
- **不改** `day.hotel` 物件 schema（`breakfast` / `checkout` / `infoBoxes` 欄位維持）
- **不改** R0「最後一天不設 hotel」規則（`day.hotel = undefined` 仍合法）
- **不改** 地圖 polyline / 單日動線顯示邏輯（TripMapRail 不受影響）
- 不新增「交通統計」替代 card — 使用者需求就是拿掉
- 不處理跨時區 / 跨日退房（使用者確認現行單時區假設維持）

## Decisions

### Decision 1: Day N≥2 首 entry 是 "新增" 不是 "移動" `day.hotel`

**選擇**：Timeline 新增一個 leading entry（title 含「退房」或 check-out 語意），POI 指向 Day N-1 的 `day.hotel`；`day.hotel` 物件本身維持不動。

**為什麼**：
- 保留 `day.hotel.breakfast` 等結構化欄位（早餐資訊仍掛 Day N-1 的 hotel）
- 避免改 DB schema / 現有 `trip-quality-rules-source` R0 Hotel 結構
- Timeline 只是多一個「引用前日 hotel POI」的 entry，POI 主檔不重複
- Migration 只需在 timeline 頭端 insert，不動 `day.hotel`

**替代方案評估**：
- 把 `day.hotel` 物件搬成 timeline entry → 改 schema、breakfast 歸屬不清、R0 要改、既有 Hotel.tsx 元件需大改
- 同時修改 R0 要求 last day 的 timeline 首 entry 必填、其他 day 的 hotel 物件移除 → 破壞性太大

### Decision 2: Day 1 首 entry 的 type / category

**選擇**：Day 1 首 entry 用現有 timeline event 結構，`title` 含抵達關鍵字（「抵達 XX 機場」），`location` 指向機場 / 車站 / 碼頭 POI（type 維持 `transport` 或新增 `arrival`，但不強制）。

**為什麼**：Timeline event 結構夠彈性（title + time + location + travel），不需要新的 event type；R19 規則只要求「Day 1 首 entry 是抵達點」，不限 type。

**替代方案評估**：新增 `arrival` type → 增加 schema 負擔，驗證邏輯要更新，好處有限。

### Decision 3: Hotel 換宿（Day N-1 hotel ≠ Day N hotel）的語意

**選擇**：Day N 首 entry 仍指向 Day N-1 的 `day.hotel` POI（昨晚睡的地方）。換宿當天的「新飯店入住」正常出現在 Day N 末端 `day.hotel` + timeline check-in entry。意思：Day N 首 entry 的 POI 是「前一晚睡的飯店」，Day N 末 check-in entry + `day.hotel` 是「今晚睡的飯店」，兩者不同 POI 合理。

**為什麼**：R19 規則語意是「從昨晚睡的地方開始今天」，換宿不該破壞這語意。

### Decision 4: 連住（Day N-1 hotel === Day N hotel）如何渲染

**選擇**：Timeline 仍產 Day N 首 entry check-out（同 POI），描述可為「退房行李寄放」或類似；當晚 check-in 可省略或簡化為「返回 XX 飯店」，但 `day.hotel` 物件仍存。R19 不強制「連住時不產首 entry」，保持規則一致性優先。

**為什麼**：規則一致 > 特例省略。使用者可用 `/tp-edit` 自行簡化。

### Decision 5: travel 語意擴充

**選擇**：Day N 首 entry 的 `travel` 物件描述「從前日飯店出發至第二站」的交通方式。若首 entry 與第二站 POI 相同（如飯店內早餐）、`travel: null`。

**為什麼**：對齊現有 tp-shared「出發此地」語意，只是多了一種「退房後出發」的情境。

### Decision 6: `transport-stats-always-open` spec 的刪除方式

**選擇**：用 OpenSpec `REMOVED Requirements` 語法刪除兩個 requirements（「全旅程交通統計 — 常駐展開」「當日交通 保持折疊」），在 Reason 註明「UI 區塊移除」，Migration 指向「無替代，交通資訊改由 timeline travel 呈現」。archive 後 `openspec/specs/transport-stats-always-open/` 整個 capability 消失。

**為什麼**：OpenSpec 的 REMOVED 是 canonical 的 capability 淘汰方式；不用手動刪除 spec 檔，archive 時工具會處理。

### Decision 7: tripExport.ts 匯出欄位相容性

**選擇**：移除「🏨 住宿」「退房時間」段落與 CSV 欄位，不保留向後相容。

**為什麼**：匯出為唯讀輸出，沒有下游自動化依賴；維持舊欄位只是視覺雜訊。

### Decision 8: React UI 元件刪除 vs 保留

**選擇**：`Hotel.tsx` / `DrivingStats.tsx` / `drivingStats.ts` 在確認無其他呼叫後**刪除**；不保留為「可能將來用到」。

**為什麼**：死碼污染 codebase，違反 trip-planner CLAUDE.md「不留 placeholder」；真的要用再從 git history restore。

## Risks / Trade-offs

- **[Risk] 既有 7 行程 migrate 期間出現 inconsistent 狀態（有的行程已套 R19，有的還沒）** → Mitigation: migration 用單一 session 連跑 7 個 `/tp-rebuild`，跑完跑 `/tp-check` 全綠才算完；只有 Ray 本人使用，短暫不一致可接受
- **[Risk] 連住情境下同 POI 在 timeline 連續出現兩次（前日末 check-in + 次日頭 check-out）視覺上冗餘** → Mitigation: UI `Timeline` 元件已處理「同地點連續 entry」的 `travel: null` 折疊，不會顯示多餘移動時間；但 card 視覺上仍是兩個 entry，屬設計選擇
- **[Risk] 使用者匯出 CSV 給外部工具時，移除住宿欄位破壞既有 spreadsheet** → Mitigation: 使用者僅個人使用，無外部下游；接受
- **[Risk] `Hotel.tsx` 刪除後未來若想加回「住宿摘要」要從 history restore** → Mitigation: git log 可追、成本低、符合 YAGNI
- **[Risk] R2（早餐不強制）放寬後，AI 產出行程可能遺漏早餐安排** → Mitigation: tp-create 邏輯仍保留「檢查 hotel.breakfast 表達早餐」的生成流程；R2 只是從「強制」改為「由 hotel.breakfast 承載」
- **[Trade-off] 選擇「新增 timeline entry」而非「改 schema」**：實作簡單、migration 乾淨；代價是 timeline 稍微變長（每天多 1 entry）

## Migration Plan

### 實作順序（TDD 紅綠重構）

1. **Red（測試先）**：
   - 寫 unit tests 測 R19 驗證邏輯（Day 1 / Day N / last day / 換宿 / 連住）
   - 寫 integration test 測 tp-rebuild 套 R19 後的 timeline 結構
   - 寫 UI test 測 DaySection 沒 Hotel/DrivingStats card 時正確渲染 Timeline
   - 所有新測試應 fail（尚未實作）
2. **Green（實作）**：
   - R19 validation helper in `src/lib/`（若需要）
   - Skill markdown 更新（tp-quality-rules R19、tp-create / tp-rebuild / tp-check / tp-edit / tp-shared）
   - UI 改 DaySection.tsx / TripPage.tsx / OverflowMenu.tsx / TripSheetContent.tsx / tripExport.ts
   - 刪除 Hotel.tsx / DrivingStats.tsx / drivingStats.ts（確認無其他呼叫）
3. **Refactor**：
   - 跑 `/simplify` 看有無整併機會
4. **Data migration**：
   - `/tp-rebuild` × 7 行程
   - `/tp-check` 每行程全綠
5. **Review / Test / Ship**：依 tp-team pipeline 7 階段

### 回滾策略

- Code 部分：revert PR，branch protection 保留
- Data 部分：每個行程在 `/tp-rebuild` 前 D1 自動 snapshot（trip_docs 版本），回滾用 API restore
- Skill 部分：revert PR 會一起還原

## Open Questions

- **Day N 首 entry 的 time 如何決定？**用 `hotel.checkout` 欄位（若有）還是使用者當日計畫第二站時間回推？**建議**：優先 `hotel.checkout`，無資料用「07:00」預設、tp-edit 手動調。
- **Day N 首 entry 的 `infoBoxes` 是否複製 `day.hotel.infoBoxes`（停車場 / 購物）？**建議**：不複製，infoBoxes 只掛 `day.hotel`；Day N 首 entry 保持精簡。
- **tripExport 是否要版本化 CSV header？**建議**：不需要；單人使用、無下游。
