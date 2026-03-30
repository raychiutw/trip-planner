# Stage 2: Plan

⚠️ 這個流程在 archive 之前是不完整的。

## Step 1 — OpenSpec change

```
/opsx:propose
```

產出：proposal.md + design.md + specs/ + tasks.md

多 session 時，建立 Long-running artifacts（見 `long-running.md`）：
- features.json + progress.jsonl + init.sh

## Step 2 — `/autoplan`（三審 + Smart Routing）

```
/autoplan
```

自動依序執行：
1. `/plan-ceo-review` — CEO 視角：scope、策略、10-star product
2. `/plan-design-review` — Designer 視角：設計系統、UI/UX、響應式
3. `/plan-eng-review` — Eng Manager 視角：架構、資料流、edge cases

中間問題用 6 決策原則自動解決，只有 taste decisions 呈報人類。

### Diff Scope Routing

**跑 `/autoplan` 前先判斷變更範圍，跳過不相關的審查：**

| 變更範圍 | 跳過 | 理由 |
|---------|------|------|
| 純 `functions/api/`、`migrations/`、`scripts/` | `/plan-design-review` | 後端邏輯不需要設計審查 |
| 純 `css/`、`src/components/`、`src/pages/` | `/plan-eng-review` 的架構 / 資料流部分 | 純 UI 不需要後端架構審查 |
| 跨層（frontend + backend 都有改） | 全部跑 | 混合變更需要完整視角 |
| 不確定 | 全部跑 | 寧可多審不漏審 |

**注意**：這只影響 Plan 階段的三審路由。Review / Test / Ship 階段不受影響。

兩個必停卡點：
- **Premise confirmation**（Phase 1）
- **Final Approval Gate**（Phase 4）

─── 🛑 CHECKPOINT ───
- [ ] OpenSpec change 已建立？
- [ ] `/autoplan` 三審全過 + 人類 Approve？
──────────────────────
