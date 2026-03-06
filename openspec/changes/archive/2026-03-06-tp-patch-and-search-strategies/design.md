## Context

現有行程 JSON 維護 skill 為 tp-edit（單行程局部改）、tp-rebuild（單行程全面重整）、tp-rebuild-all（全行程全面重整）。當需要跨行程只更新特定欄位時，沒有適當工具。搜尋策略（如何找 blogUrl、googleRating）散落在 tp-create 和 tp-rebuild 的 prompt 中，知識重複且不一致。

同時有兩個 JSON 結構變更需求：hotel 缺少 googleRating 渲染、restaurant reservation 需從自由字串改為結構化物件。

## Goals / Non-Goals

**Goals:**
- 建立 tp-patch skill，支援跨行程局部欄位更新
- 建立 search-strategies.md，統一搜尋策略供所有 skill 引用
- hotel 加入 googleRating 渲染與 strict 品質規則
- restaurant reservation 改為結構化物件並 strict 檢查

**Non-Goals:**
- 不重構 tp-create / tp-rebuild 的既有流程（只加引用 search-strategies.md 的註解）
- 不改變 timeline 順序或增減景點
- 不處理 hotel 以外的新 googleRating 適用對象

## Decisions

### D1: tp-patch 使用結構化指令（非自然語言）

```
/tp-patch --target <target> --field <field> [--trips <slug,...>]
```

**Why**: 結構化參數可精確定位修改範圍，避免自然語言解析的模糊性。tp-edit 已覆蓋自然語言場景。

**Alternative**: 自然語言指令 → 捨棄，因為 target/field 組合有限，結構化更可靠。

### D2: reservation 結構化物件設計

```json
{
  "reservation": {
    "available": "yes" | "no" | "unknown",
    "method": "website" | "phone",
    "url": "https://...",
    "phone": "098-xxx-xxxx",
    "recommended": true | false
  }
}
```

**Why**: 三層資訊（可否預約 → 預約方式 → 是否建議）各自獨立，避免自由字串的不一致問題。`available` 用 `"unknown"` 而非 null，符合 R0 禁 null 規則。

**Alternative**: 保留 reservation 字串 + 枚舉約束 → 捨棄，無法結構化表達預約方式。

### D3: reservationUrl 併入 reservation.url

移除頂層 `reservationUrl` 欄位，改由 `reservation.url` 承載。`app.js` 的 `URL_FIELDS` 白名單同步更新。

**Why**: 避免兩處存放同一資訊。既然 reservation 已結構化，URL 自然屬於其子欄位。

### D4: search-strategies.md 放在 .claude/commands/

與其他 skill 文件同目錄，方便 tp-create / tp-rebuild / tp-patch 的 prompt 引用 `search-strategies.md`。

**Why**: `.claude/commands/` 是所有 skill 文件的標準位置，Agent prompt 可直接指示「參照 search-strategies.md」。

### D5: tp-patch Agent 並行策略

每個行程一個 Agent（sonnet），並行執行。Agent 不直接改檔案，只回傳 JSON patch 結果，由主流程合併寫回。

**Why**: 避免多 Agent 同時寫同一檔案的衝突。Agent 專注搜尋，主流程負責寫入和驗證。

### D6: hotel googleRating 渲染位置

在 `renderHotel()` 中，googleRating 顯示在飯店名稱（或連結）後面，與餐廳/商店一致使用 `<span class="rating">★ N.N</span>`。

**Why**: 保持全站 googleRating 渲染的一致性。

## Risks / Trade-offs

- **[BREAKING] reservation 結構變更** → 所有行程 JSON 需批次更新。Mitigation: 用 tp-patch 自動回填，搜尋前先備份。
- **[搜尋品質] Agent 搜尋的 reservation 資訊可能不準確** → Mitigation: search-strategies.md 定義多來源交叉驗證（tabelog + hotpepper + Google）。找不到時設 `available: "unknown"` 而非猜測。
- **[向後相容] 舊版 reservation 字串的程式碼殘留** → Mitigation: `renderRestaurant()` 改為只讀物件結構，schema test 阻擋字串型別。
