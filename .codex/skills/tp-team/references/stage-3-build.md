# Stage 3: Build

⚠️ 這個流程在 archive 之前是不完整的。

## Step 1 — Feature branch

```bash
git checkout -b feat/change-name master
```

## Step 2 — 寫 code（TDD）

先寫測試再實作。遵守 `openspec/config.yaml` 開發規範。

```
npx tsc --noEmit && npm test  # 確認全過
```

多 session 時遵守 Coding Agent Session Protocol（見 `long-running.md`）：
一個 session 只做一個 feature → commit → 更新 features.json → append progress.jsonl。

## Step 3 — `/simplify`

```
/simplify
```

3 個平行 agent 檢查 code reuse / quality / efficiency，直接修復問題。
確保送進 Review 的 code 沒有 trivial issues。

─── 🛑 CHECKPOINT ───
- [ ] tsc + npm test 全過？
- [ ] `/simplify` 已跑完？
- [ ] 多 session 時：features.json 全部 done + e2e=true？
──────────────────────
