## Context

目前 tp-request 有兩種觸發方式：
1. **即時 webhook**：旅伴送出請求 → Pages Function dispatch → Tunnel → Agent Server → 處理
2. **排程 fallback**：每分鐘查 `webhook_failed=1` 的請求 → claude /tp-request

Tunnel 不穩定，Agent Server 需要常駐。簡化為只保留排程。

## Goals / Non-Goals

**Goals:**
- 移除所有 tunnel / agent server 相關程式碼和基礎設施
- 排程腳本簡化為查所有 open 請求（不再區分 webhook 成功/失敗）
- 保持旅伴請求的處理能力不變

**Non-Goals:**
- 不 drop DB 欄位（webhook_status / processed_by / webhook_logs 表保留）
- 不改 manage 頁的請求送出 UI
- 不改請求處理邏輯（tp-request skill 本身不變）

## Decisions

### D1：排程查詢條件

**選擇**：排程改為查 `status=open`（所有未處理請求）

**理由**：不再有 webhook 即時處理，所有請求都由排程處理，不需要 `webhook_failed` 條件

### D2：DB 欄位保留

**選擇**：不 drop `webhook_status`、`processed_by`、`webhook_logs` 表

**理由**：D1 migration 是 forward-only，drop column 需要新 migration 且可能影響既有資料。欄位保留不佔空間，新請求這些欄位為 NULL 即可。

### D3：API `processed_by` 欄位保留

**選擇**：保留 `processed_by` 欄位寫入，值固定為 `scheduler`

**理由**：方便未來追蹤請求是由哪種機制處理的

## Risks / Trade-offs

- [回應延遲] → 最長 1 分鐘延遲（排程間隔），對旅伴請求場景可接受
- [DB 殘留欄位] → 不影響功能，只是 schema 不夠乾淨。未來可用 migration 清理
