## Context

Reviewer 掃描發現多個 API 可靠性問題。`restaurants.ts` POST 使用 `parent_type/parent_id` 欄位但 schema 定義的是 `entry_id`（migration 0002）。`requests/[id].ts` 驗證 4 種 status 但原始 schema 只允許 open/closed（migration 0009 已修正為新 schema）。`days/[num].ts` PUT 分多次 batch 操作非原子。`_audit.ts` 用 `||` 做 nullish 處理有 falsy coercion 問題。

## Goals / Non-Goals

**Goals:**
- 修正 restaurants POST INSERT 語句使用正確的 `entry_id` 欄位
- 確認 requests status CHECK constraint 已由 migration 0009 更新，修正 H2 報告中的誤報（DB 已與 API 一致）
- 將 days PUT 的多次操作合併為單一 atomic batch
- 修正 audit falsy coercion
- 移除重複的 hasPermission

**Non-Goals:**
- 不實作 JWT 簽名驗證（H3）和 Service Token server-side 驗值（H4）— 這些需要架構評估，風險較低（路由全受 Access 保護），移至後續 change
- 不重構 API handler 架構（只做最小修正）

## Decisions

### D1. restaurants POST 修正策略

`restaurants` 表 schema（migration 0002 行 68-84）使用 `entry_id` 作為 FK：
```sql
entry_id INTEGER NOT NULL REFERENCES entries(id) ON DELETE CASCADE
```

但 POST handler 使用 `parent_type/parent_id`。需將 INSERT 和 sort_order 查詢改為使用 `entry_id`。

同時 sort_order 的 MAX 查詢也需從 `WHERE parent_type = 'entry' AND parent_id = ?` 改為 `WHERE entry_id = ?`。

### D2. requests status 驗證

Migration 0009 已透過 recreate table 將 CHECK constraint 更新為 `('open', 'received', 'processing', 'completed')`。API 的驗證已經匹配。H2 報告是基於 migration 0001 的原始 schema，但 0009 已取代。只需確認一致性，不需改動。

### D3. days PUT 原子化

現有流程：
1. `db.batch()` — 刪除舊 shopping/restaurants/entries/hotel + 更新 day
2. 個別 INSERT hotel
3. for loop 逐一 INSERT entry + batch insert restaurants/shopping

改為：
1. 收集所有 SQL statements（刪除 + 更新 + 所有 INSERT）
2. 單一 `db.batch()` 執行全部

挑戰：需要 `RETURNING id` 的結果來建立 FK 關聯。D1 的 batch 中每個 statement 獨立執行，可以用 `RETURNING` 但無法在 batch 內跨 statement 引用。

解法：改為兩段 batch：
- Batch 1：刪除所有子資料 + 更新 day + INSERT hotel（RETURNING id）+ INSERT 所有 entries（RETURNING id）
- Batch 2：用 Batch 1 的 id 結果 INSERT 所有 restaurants/shopping

這比現有的多段操作更安全（從 N+1 段降為 2 段）。

### D4. audit falsy coercion

`opts.requestId || null` → `opts.requestId ?? null`
`opts.diffJson || null` → `opts.diffJson ?? null`
`opts.snapshot || null` → `opts.snapshot ?? null`

## Risks / Trade-offs

- **[Risk] restaurants POST 修正影響現有呼叫端** → Mitigation：此端點目前因 schema 不匹配已是壞的，修正只會使它正常工作
- **[Risk] days PUT batch 重構可能引入新 bug** → Mitigation：保留 snapshot audit log，且現有測試會驗證
- **[Risk] 兩段 batch 仍非完全原子** → Mitigation：比現有的 N 段好很多，完全原子需等 D1 支援 savepoint
