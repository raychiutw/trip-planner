# Stage 6: Ship

⚠️ 這個流程在 archive 之前是不完整的。

## Step 0 — 前置檢查

首次使用前確認 `/setup-deploy` 已執行（一次性）：
- 自動偵測 deploy platform（Cloudflare Pages）
- 設定 production URL、health check endpoint、deploy status command

## Step 1 — `/ship`

```
/ship
```

Release Engineer 角色。全自動、非互動：
- merge base branch
- **Test Framework Bootstrap**：測試框架不存在時自動建立
- 跑 tests + **Test Failure Ownership Triage**（區分本 branch 引入 vs pre-existing）
- **Test Coverage Audit**：ASCII coverage 圖，涵蓋 code paths + user flows
- review diff（2-pass：CRITICAL → INFORMATIONAL）
- **Adversarial Review**：根據 diff size 自動調整（< 50 行跳過，50-199 cross-model，200+ 全開）
  - 如果 Stage 4 已跑 `/codex`，引用結果不重複
- bump VERSION + 更新 CHANGELOG
- commit → push → 建 PR
- 內嵌執行 `/document-release`（自動更新 README / CLAUDE.md / TODOS.md）

`/ship` 自動 push，不問確認。

## Step 2 — CI

GitHub Actions 自動執行（PR 觸發）：
- `npx tsc --noEmit` + `npm test` + `npm run build` + `verify-sw`

## Step 3 — `/land-and-deploy`

```
/land-and-deploy
```

Release Engineer 角色。
- Pre-merge readiness report → **唯一的人類確認卡點**
- merge PR → 等 CI + deploy → 驗證 production 健康

## Step 4 — `/canary`

```
/canary
```

Release Reliability Engineer 角色。
- 週期截圖 + console errors
- 效能回歸偵測
- 與 pre-deploy baseline 對比

─── 🛑 CHECKPOINT ───
Ship 了不是完成。Deploy 了不是完成。
- [ ] `/ship` PR 已建立？
- [ ] CI 全綠？
- [ ] `/land-and-deploy` merge + deploy 成功？
- [ ] `/canary` 確認 production 健康？
還需要 Reflect → archive 才算完成。
──────────────────────
