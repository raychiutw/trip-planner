## Why

tp-request 用 `curl -d '{中文}'` PATCH entry 時，Windows shell 的 CP950 編碼與 UTF-8 衝突，導致 travel_desc 等中文欄位寫入 D1 後變成亂碼（如「約15分鐘」→「██15████」）。盤點發現 5 個 skill 有相同風險，需要從源頭到儲存的四層防堵。

## What Changes

**Layer 1 — 源頭（5 個 SKILL.md）**：所有 curl 寫入改用 `node writeFileSync` 寫暫存 JSON + `curl --data @file`
- `tp-create`（🔴高）、`tp-rebuild`（🔴高）、`tp-rebuild-all`（🔴高）
- `tp-edit`（🟡中）、`tp-patch`（🟡中）

**Layer 2 — 傳輸（API middleware）**：對 mutating requests 用 `TextDecoder({ fatal: true })` 驗證 body 是否合法 UTF-8，不合法回 400

**Layer 3 — 儲存（_validate.ts）**：新增 `detectGarbledText()` 啟發式偵測亂碼（U+FFFD、連續 Latin Extended 等），寫入前攔截

**Layer 4 — 偵測（audit + tp-check）**：audit log 對 diff 做亂碼偵測標記

## Capabilities

### New Capabilities
- `encoding-safety`: 四層 UTF-8 encoding 防堵機制

### Modified Capabilities
（無）

## Impact

- **Skills**：5 個 SKILL.md 的 curl 寫入範例
- **API**：`_middleware.ts`、`_validate.ts`、`entries/[eid].ts`、`days/[num].ts`
- **測試**：新增 encoding 相關 unit test
