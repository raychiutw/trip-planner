# Stage 6: Ship

⚠️ 這個流程在 archive 之前是不完整的。

## Step 1 — `/ship`

```
/ship
```

Release Engineer 角色。全自動、非互動：
- merge base branch
- 跑 tests + review diff
- bump VERSION + 更新 CHANGELOG
- commit → push → 建 PR
- 內嵌執行 `/document-release`（自動更新文件）

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
