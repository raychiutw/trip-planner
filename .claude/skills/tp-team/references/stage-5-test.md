# Stage 5: Test

⚠️ 這個流程在 archive 之前是不完整的。

## Step 1 — `/qa`

```
/qa
```

QA Engineer + Bug-fix Engineer 角色。
- 開 headless Chromium 真瀏覽器測試
- 依 `config.yaml` 的 `testing.qa_test_cases` 測試
- 發現 bug → 直接修復 → 寫回歸測試 → 驗證
- 自我調節：每 5 次修復計算 WTF-likelihood，>20% 停止
- 輸出：健康分數 + ship-readiness 摘要

僅報告不修改用 `/qa-only`。

## Step 2 — `/cso`

```
/cso
```

Chief Security Officer 角色。
- OWASP Top 10 + STRIDE 威脅建模
- Secret 掃描 + 依賴 CVE 檢查
- 獨立 sub-agent 驗證每個 finding，過濾 false positive

## Step 3 — `/benchmark`（有 UI 變更時）

```
/benchmark
```

Performance Engineer 角色。
- LCP、CLS、bundle size、page load time
- Before/after 對比，回歸 > 10% → 🔴

─── 🛑 CHECKPOINT ───
- [ ] `/qa` 健康分數 ≥ 80？
- [ ] `/cso` 無 🔴 安全問題？
- [ ] `/benchmark` 無顯著回歸（有跑的話）？
──────────────────────
