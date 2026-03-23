# Stage 2: Plan

⚠️ 這個流程在 archive 之前是不完整的。

## Step 1 — OpenSpec change

```
/opsx:propose
```

產出：proposal.md + design.md + specs/ + tasks.md

多 session 時，建立 Long-running artifacts（見 `long-running.md`）：
- features.json + progress.jsonl + init.sh

## Step 2 — `/autoplan`（三審）

```
/autoplan
```

自動依序執行：
1. `/plan-ceo-review` — CEO 視角：scope、策略、10-star product
2. `/plan-design-review` — Designer 視角：設計系統、UI/UX、響應式
3. `/plan-eng-review` — Eng Manager 視角：架構、資料流、edge cases

中間問題用 6 決策原則自動解決，只有 taste decisions 呈報人類。

兩個必停卡點：
- **Premise confirmation**（Phase 1）
- **Final Approval Gate**（Phase 4）

─── 🛑 CHECKPOINT ───
- [ ] OpenSpec change 已建立？
- [ ] `/autoplan` 三審全過 + 人類 Approve？
──────────────────────
