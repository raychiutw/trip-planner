## Why

今天大量線上問題（SW fallback、CSP、curl 別名、Access redirect）都是「本地測試沒問題，部署後才爆」。缺乏 staging 環境和 pre-deploy 驗證，導致問題直接上到 production。需要建立完整的 CI/CD pipeline：staging 環境 + E2E 測試 + pre-deploy 驗證。

## What Changes

1. **Staging 環境**：利用 Cloudflare Pages 的 Preview Deploy，開發用 feature branch → 自動部署到 Preview URL
2. **GitHub Actions CI**：PR 觸發自動化測試（build + unit test + E2E test on Preview URL）
3. **SW 驗證 script**：build 後自動檢查 sw.js 內容（NavigationRoute、precache entries 等）
4. **Pre-deploy checklist**：寫進團隊規則，merge 前必須通過
5. **團隊規則更新**：workflow.md 加入 staging 流程

## Capabilities

### New Capabilities
- `staging-pipeline`: Staging 環境 + CI 自動化測試 + Pre-deploy 驗證

### Modified Capabilities
（無）

## Impact

- **新增**：`.github/workflows/ci.yml`（PR CI pipeline）、`scripts/verify-sw.js`（SW 驗證）
- **修改**：`.claude/skills/tp-team/references/workflow.md`（團隊規則）、`CLAUDE.md`
- **Cloudflare**：不需額外設定（Preview Deploy 預設啟用）
