## Context

`renderHotel()` (app.js:237-267) 目前只渲染 `name`、`url`、`blogUrl`、`details`、`subs`，完全忽略 `hotel.infoBoxes`、`breakfast`、`checkout`。同時 hotel.subs 存在兩種格式（Ray 舊格式 vs HuiYun 新格式），HuiYun 有 6 筆購物資料混在 subs 而非 infoBoxes，且四個行程檔都有未使用的 `meta.themeColor` / `meta.name` 欄位。

既有的 `renderInfoBox()` (app.js:108-186) 已完整支援 shopping / gasStation / restaurants 等 infoBox type，只要在 renderHotel 中呼叫即可。

## Goals / Non-Goals

**Goals:**
- renderHotel 補齊 infoBoxes、breakfast、checkout 三塊渲染
- hotel.subs 四個行程檔統一用新格式 `{type, title, price, note, location}`
- HuiYun 購物從 subs 搬到 hotel.infoBoxes
- 移除四檔未使用的 `meta.themeColor`、`meta.name`
- 補齊零星缺漏（RayHus checkout/url、Ray restaurant category）

**Non-Goals:**
- 不改 CSS（渲染復用既有 class）
- 不改 HTML
- 不新增 icon（breakfast 用既有 `utensils`，checkout 用既有 `clock`）
- Onion 板橋行程的 hotel 缺 checkout/url/blogUrl 為合理狀態，不強制補齊

## Decisions

### D1：renderHotel 渲染 infoBoxes — 直接呼叫 renderInfoBox

直接迴圈 `hotel.infoBoxes` 呼叫既有 `renderInfoBox(box)`，與 timeline event 渲染 infoBoxes 方式一致。

**替代方案**：為 hotel 寫獨立的 infoBox 渲染 → 增加重複程式碼，無益。

### D2：breakfast 渲染 — 一行 icon + 文字

在 hotel detail 區塊末尾渲染：
- `included: true` → `🍳 含早餐` + note（若有）
- `included: false` → `🍳 不含早餐`
- `included: null` → `🍳 早餐：資料未提供`

使用 `iconSpan('utensils')` 作為 icon。放在 details grid 之後、subs 之前。

**替代方案**：放在 subs 裡面 → 語意不對，breakfast 是獨立欄位非子設施。

### D3：checkout 渲染 — 一行 icon + 時間

在 breakfast 行下方渲染 `iconSpan('clock') + ' 退房 ' + checkout`。只在 checkout 欄位存在時才渲染。

### D4：hotel.subs 統一新格式

新格式：`{ type: "parking", title: "...", price: "...", note: "...", location: {...} }`

renderHotel 的 subs 渲染改為讀取新格式欄位：
- `sub.title` 取代 `sub.label`
- `sub.price` 獨立顯示
- `sub.note` 作為備註
- `sub.location` 不變

Ray 的 4 處舊格式 `{label, text, location}` 在 JSON 中轉為新格式。

**替代方案**：兩種格式都支援 → 增加分支複雜度，不如一次統一。

### D5：HuiYun subs 購物搬遷策略

HuiYun 有 6 筆 `subs[type=shopping]`，搬到 `hotel.infoBoxes` 陣列。搬遷後 subs 只留 parking 等非購物項。若搬遷後 subs 為空陣列則移除整個 `subs` 欄位。

### D6：meta 欄位移除

- `meta.themeColor`：HTML 寫死 `data-theme` attribute，JS 從未讀取此欄位 → 移除
- `meta.name`：`trips.json` 已有 name 做切換，trip JSON 內的 name 冗餘 → 移除

四個行程檔全數移除，schema.test.js 移除對應驗證。

## Risks / Trade-offs

- **subs 格式遷移後舊資料不相容** → 一次性全量更新四個檔案，不存在漸進式問題。renderHotel 改完後只讀新格式。
- **HuiYun 購物搬遷可能遺漏** → 用精確搜尋 `type: "shopping"` 比對，搬完後測試驗證。
- **breakfast icon 與餐廳 icon 重複（都用 utensils）** → 可接受，breakfast 在 hotel 區塊內、餐廳在 timeline infoBox 內，上下文不同不會混淆。
