## Context

開發直接 push master → production deploy。沒有 staging、沒有 PR CI、沒有 pre-deploy 驗證。今天的 SW/CSP/curl/Access 問題全是部署後才發現。

## Goals / Non-Goals

**Goals:**
- Feature branch → Preview Deploy（staging）
- PR 觸發 CI：build + tsc + unit test + sw 驗證
- E2E test 跑在 Preview URL（可選，先做 unit level）
- SW build 後自動驗證
- 團隊規則更新

**Non-Goals:**
- 不改 Cloudflare Pages 設定（Preview Deploy 預設啟用）
- 不做 canary deploy
- 不做 rollback 自動化

## Decisions

### D1. GitHub Actions CI Pipeline
```yaml
name: CI
on:
  pull_request:
    branches: [master]

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - checkout
      - setup-node
      - npm ci
      - npx tsc --noEmit
      - npm test
      - npm run build
      - node scripts/verify-sw.js
```

### D2. SW 驗證 Script（verify-sw.js）
Build 後檢查 dist/sw.js：
1. ❌ 不應包含 `NavigationRoute`（navigation fallback 已關閉）
2. ❌ 不應包含 `createHandlerBoundToURL`
3. ✅ 應包含 `precacheAndRoute`
4. ✅ precache entries 數量 > 10
5. ✅ 應包含 `NetworkFirst`（API runtime cache）
6. ❌ 不應 precache manage/ 或 admin/ HTML

### D3. 開發流程改造
```
現在：
  master push → production deploy（無測試）

改為：
  feature branch → push → Preview Deploy + CI
  → PR → review → merge master → production deploy
```

### D4. 團隊規則更新
workflow.md 加入：
- 開發一律在 feature branch
- merge 前 CI 必須全綠
- SW 變更需要在 Preview URL 手動測試離線功能

## Risks / Trade-offs

- **[Risk] Preview Deploy 的 Access 設定可能不同** → Mitigation：Preview URL 預設不受 Access 保護，manage/admin 在 Preview 上可直接存取（反而方便測試）
- **[Risk] E2E on Preview URL 需要等 deploy 完成** → Mitigation：先做 unit level CI，E2E 後續加
