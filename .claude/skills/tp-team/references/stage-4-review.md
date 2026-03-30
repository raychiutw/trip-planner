# Stage 4: Review

⚠️ 這個流程在 archive 之前是不完整的。

## Step 1 — `/tp-code-verify`

```
/tp-code-verify
```

專案規範驗證（已整合 HIG）：
- 命名規範、coding standards、React best practices、code review rules
- Apple HIG 設計規則 H1-H12、design tokens、頁面結構
- tsc + test 全綠
- 驗證循環直到全部通過

## Step 2 — `/review`

```
/review
```

Staff Engineer 角色。Two-pass review：
- Pass 1（CRITICAL）：SQL safety、race conditions、trust boundary
- Pass 2（INFORMATIONAL）：dead code、magic numbers、test gaps

**Fix-first**：明顯問題直接 auto-fix，判斷題用 ASK 呈報。
Scope drift detection：比對 stated intent vs actual diff。

## Step 3 — `/codex`

```
/codex review
```

OpenAI Codex 獨立 review。不先透露 `/review` 的結果。
完成後交叉比對：
- `[overlap]` 兩模型都發現 → 🔴 必修
- `[claude-only]` / `[codex-only]` → 🟡 判斷

─── 🛑 CHECKPOINT ───
- [ ] `/tp-code-verify` 全綠（含 HIG）？
- [ ] `/review` PASS？auto-fix 已套用？scope drift 已檢查？
- [ ] `/codex` PASS？overlap findings 已修？
──────────────────────

## 與 Stage 6 `/ship` 的關係

`/ship` 內建 adversarial review，會根據 diff size 自動調整強度：
- diff < 50 行：跳過
- 50-199 行：cross-model review
- 200+ 行：完整 4-pass

**如果 Stage 4 已跑過 `/codex`，`/ship` 可引用其結果，不必重複跑相同審查。**
