## 1. 刪除 Tunnel / Agent Server 檔案

- [x] 1.1 刪除 `server/` 整個目錄（index.js, lib/, routes/, tunnel.yml, tunnel.log, package.json, package-lock.json）
- [x] 1.2 刪除 `scripts/start-agent.ps1`
- [x] 1.3 刪除 `scripts/register-agent.ps1`
- [x] 1.4 刪除 `openspec/changes/local-agent-server/` 整個目錄

## 2. 修改設定檔

- [x] 2.1 `wrangler.toml`：移除 `[[kv_namespaces]]` TUNNEL_KV binding（保留 d1_databases）

## 3. 修改 API

- [x] 3.1 `functions/api/requests.ts`：移除 `webhook_failed` 查詢參數的 WHERE 條件
- [x] 3.2 `src/types/api.ts`：移除 `webhookStatus` 欄位和 `WebhookLog` interface

## 4. 簡化排程腳本

- [x] 4.1 `scripts/tp-request-scheduler.ps1`：移除 `webhook_failed=1` 查詢條件，改為 `status=open`

## 5. 更新 Skill 文件

- [x] 5.1 `.claude/skills/tp-request/SKILL.md`：移除 webhook 觸發模式描述，只保留排程模式

## 6. 驗證

- [x] 6.1 `npx tsc --noEmit` TypeScript 零錯誤
- [x] 6.2 `npm test` 全部通過
