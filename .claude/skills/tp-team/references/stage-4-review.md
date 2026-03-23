# Stage 4: Review

⚠️ 這個流程在 archive 之前是不完整的。

## Step 1 — `/tp-code-verify` + `/tp-ux-verify`

```
/tp-code-verify
/tp-ux-verify
```

專案規範驗證：
- `/tp-code-verify`：命名規範、coding standards、React best practices、code review rules、tsc + test 全綠
- `/tp-ux-verify`：Apple HIG 設計規則、token、頁面結構
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
- [ ] `/tp-code-verify` + `/tp-ux-verify` 全綠？
- [ ] `/review` PASS？auto-fix 已套用？
- [ ] `/codex` PASS？overlap findings 已修？
──────────────────────
