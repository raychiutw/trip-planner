## Why

Cloudflare Tunnel + Agent Server 的即時 webhook 機制不穩定（tunnel 斷線、Agent Server 未啟動、連線逾時），且維護成本高（需要本機常駐 server + cloudflared 進程）。排程每分鐘輪詢已能滿足回應需求，不需要即時處理。

## What Changes

- **移除** Agent Server（`server/` 目錄）：Express app + claude-agent-sdk webhook handler
- **移除** Tunnel 啟動腳本（`scripts/start-agent.ps1`、`scripts/register-agent.ps1`）
- **移除** wrangler.toml 的 TUNNEL_KV namespace binding
- **移除** API 的 `webhook_failed` 查詢參數和 `WebhookLog` 型別
- **保留** 排程機制（`scripts/tp-request-scheduler.ps1` + `scripts/register-scheduler.ps1`）
- **簡化** 排程腳本：移除 `webhook_failed=1` 條件，改查所有 `status=open`
- **簡化** tp-request skill：移除 webhook 觸發模式描述

## Capabilities

### New Capabilities

（無新增 capability）

### Modified Capabilities

- `tunnel-integration`：移除 tunnel 整合，排程改為直接查所有 open 請求

## Impact

影響檔案：
- 刪除：`server/`（整個目錄）、`scripts/start-agent.ps1`、`scripts/register-agent.ps1`、`openspec/changes/local-agent-server/`
- 修改：`wrangler.toml`、`functions/api/requests.ts`、`src/types/api.ts`、`scripts/tp-request-scheduler.ps1`、`.claude/skills/tp-request/SKILL.md`
- 無 DB schema 變更（欄位保留，不 drop）
- 無前端 UI 變更
