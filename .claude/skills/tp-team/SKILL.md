---
name: tp-team
description: Use when starting any code change, feature implementation, bug fix, or refactoring. Ensures gstack sprint stages are followed through to archive.
user-invocable: true
---

⚠️ **這個流程在 archive 之前是不完整的。** Ship 不是終點，Reflect 才是。

# tp-team — gstack Sprint Pipeline

code 變更前 invoke 本 skill，確認完整 pipeline。

## 設計哲學

**Claude 直接做事，不建 Agent。** invoke 不同 gstack skill 就是換帽子。
只在需要 worktree 隔離（並行修改檔案）時才用 Agent。

## Pipeline Commitment Gate

**在執行任何工具之前，輸出以下 7 階段確認：**

```
✅ Think   — /office-hours（探索需求，選用）
✅ Plan    — /autoplan → 三審完成
✅ Build   — 寫 code + TDD + /simplify
✅ Review  — /tp-code-verify（含 HIG）→ /review → /codex
✅ Test    — /qa → /cso → /benchmark
✅ Ship    — /ship → CI → /land-and-deploy → /canary
✅ Reflect — /retro → archive ← 不到這裡就不算完成
```

**如果你沒有讀完 Reflect 包含 archive，你就無法產生這個確認。**

## Red Flags — 看到這些想法時 STOP

| 想法 | 現實 |
|------|------|
| 「merge 了，完成了」 | ❌ 還需要 /canary → /retro → archive |
| 「deploy 成功，完成了」 | ❌ 還需要 /retro → archive |
| 「太簡單不需要 /review」 | ❌ 一行 CSS 也走 Review 階段 |
| 「先改再補流程」 | ❌ 先輸出 Gate 再動手 |
| 「這次例外」 | ❌ 沒有例外 |

## 7 階段 × gstack skill

每個階段獨立讀取對應檔案，重置注意力視窗。

| 階段 | 檔案 | gstack skill | 角色 persona |
|------|------|-------------|-------------|
| Think | `references/stage-1-think.md` | `/office-hours` | YC Office Hours Partner |
| Plan | `references/stage-2-plan.md` | `/autoplan` | 自動三審（CEO + Eng + Design） |
| Build | `references/stage-3-build.md` | 寫 code + `/simplify` | Engineer + Code Quality Reviewer |
| Review | `references/stage-4-review.md` | `/tp-code-verify`（含 HIG）→ `/review` → `/codex` | 專案規範 + Staff Engineer + OpenAI 獨立審查 |
| Test | `references/stage-5-test.md` | `/qa` → `/cso` → `/benchmark` | QA Engineer + CSO + Performance Engineer |
| Ship | `references/stage-6-ship.md` | `/ship` → `/land-and-deploy` → `/canary` | Release Engineer + SRE |
| Reflect | `references/stage-7-reflect.md` | `/retro` → archive | Retro Analyst |

其他參考：
- `references/long-running.md` — features.json + progress.jsonl 交班機制（多 session 時使用）

## 按需 skill（不在 pipeline 內，需要時 invoke）

| gstack skill | 角色 | 何時用 |
|-------------|------|--------|
| `/investigate` | Systematic Debugger | bug 調查 |
| `/design-review` | Senior Designer + Frontend Engineer | 視覺稽核 + CSS 修復 |
| `/design-consultation` | Senior Product Designer | 建立設計系統 |
| `/browse` | QA Tester | 手動瀏覽器測試 |
| `/careful` | Safety Guardian | 破壞性指令護欄 |
| `/freeze` / `/unfreeze` | Edit Boundary | 限制編輯範圍 |
| `/guard` | careful + freeze | 最大安全模式 |

## OpenSpec 流程（不變）

```
Explore → Propose → Apply → Archive（缺一不可）
```

## tp-* Skill（行程資料操作，不走 pipeline）

`/tp-request` `/tp-create` `/tp-edit` `/tp-check` `/tp-deploy` `/tp-rebuild` `/tp-patch`

**判斷原則：改 code → 走 7 階段 pipeline；改行程資料 → 直接操作。**
