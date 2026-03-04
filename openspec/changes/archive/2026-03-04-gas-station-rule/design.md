## Context

自駕行程還車前必須加滿油。目前 Ray 和 HuiYun 的加油站資料以 `reservation` infoBox 存放，但語意不精確且無驗證保障。需要：
1. 新增 `meta.tripType` 讓規則能判斷是否為自駕
2. 新增 `gasStation` infoBox type 正式結構化加油站資訊
3. 新增品質規則 R10 + 自動驗證

現有渲染架構：`app.js` 的 `renderInfoBox()` 以 switch-case 處理各 infoBox type（reservation / parking / shopping / restaurants / souvenir）。新增 type 只需加一個 case。

## Goals / Non-Goals

**Goals:**
- 新增 `meta.tripType` 欄位，明確標示行程交通類型
- 定義 `gasStation` infoBox type 結構
- `/render-trip` 在產生自駕行程時自動為還車事件附加加油站資訊（人工優先）
- 驗證：schema test 確認結構、quality test 確認自駕行程有附加油站
- 遷移 Ray / HuiYun 現有資料

**Non-Goals:**
- 不改變非自駕行程的任何行為
- 不自動搜尋加油站（由 Claude 在 `/render-trip` 時查找）
- 不處理加油站的即時營業狀態

## Decisions

### D1 `meta.tripType` 欄位值

採用三值：`"self-drive"` | `"transit"` | `"mixed"`

- `self-drive`：全程自駕（Ray, HuiYun）
- `transit`：全程大眾運輸（RayHus）
- `mixed`：部分自駕部分大眾運輸

**替代方案**：用 boolean `meta.isSelfDrive` — 不夠靈活，無法表達混合型行程。

### D2 gasStation infoBox 結構

```jsonc
{
  "type": "gasStation",
  "title": "還車前加油",
  "station": {
    "name": "ENEOS 崇元寺店",
    "address": "沖縄県那覇市泊 1-3-5",
    "hours": "07:00~21:00",
    "service": "フルサービス（人工）",
    "phone": "098-866-5267",
    "location": Location
  }
}
```

單一 `station` 物件而非陣列 — 還車只需去一間加油站，不需多選。

**替代方案**：用 `stations[]` 陣列 — 過度設計，使用者只會去最近的一間。

### D3 渲染方式

在 `app.js` `renderInfoBox()` 新增 `case 'gasStation'`，使用 `local_gas_station` icon（Material Symbols Rounded），復用 `.info-box` 既有樣式。

### D4 tripType 判斷邏輯（/render-trip）

`/render-trip` 處理新行程時：
1. 若 `meta.tripType` 已存在 → 直接使用
2. 若不存在但有租車相關事件（title 含「取車」「還車」「租車」）→ 推斷為 `self-drive`
3. 若無法判斷 → 提問使用者

### D5 Quality test 偵測邏輯

```
IF meta.tripType === "self-drive" OR "mixed"
AND timeline 中有 event title 含「還車」
THEN 該 event 的 infoBoxes SHALL 包含 type=gasStation
```

## Risks / Trade-offs

- [Risk] 現有 reservation infoBox 遷移後，渲染可能短暫不正確（需同時部署 app.js + data 修改）→ 同一 commit 處理
- [Risk] `tripType` 是新的必填欄位，所有行程 JSON 都需補上 → 遷移 task 一次補齊
- [Risk] 非日本行程的加油站規則可能不同（例如台灣本地行程不需加滿油還車）→ R10 只針對有「還車」事件的行程觸發，非租車自駕不受影響
