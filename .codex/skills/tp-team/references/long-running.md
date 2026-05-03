# Long-running Session Protocol

**核心理念：Long-running 不是一個 session 跑很久，是交接零成本。**

每個 session 都是無狀態的。存活的不是對話，是 artifacts。

## 三大失敗模式（必須防堵）

| 失敗模式 | 症狀 | 防堵 |
|---------|------|------|
| **One-shot 燒完 context** | Engineer 嘗試一次做完所有 features | 鐵律：一個 session 只做一個 feature |
| **提早下班** | 看到前面有進度 → 直接宣布完成 | 必須驗證 features.json + E2E |
| **假完成** | unit test pass 就標 done | features.json 的 `e2e` 必須 `true` |

## Artifacts

PM 建立 OpenSpec change 後，除了 `proposal.md` / `design.md` / `tasks.md`，還要產出：

```
openspec/changes/{change-name}/
  features.json        ← 機器可讀的 feature checklist（JSON，不是 markdown！）
  progress.jsonl       ← 交班日誌（append-only，每 session 一行）
  init.sh              ← 開機腳本（環境恢復 + smoke test）
```

### features.json

**為什麼是 JSON 不是 markdown？** Agent 會偷改 markdown 結構。JSON schema 是硬性約束。

```json
{
  "change": "change-name",
  "created": "2026-03-23",
  "features": [
    {
      "id": "F001",
      "title": "功能描述",
      "priority": 1,
      "status": "pending",
      "session": null,
      "e2e": false
    }
  ]
}
```

**status 只有三種值**：`pending` / `done` / `blocked`
**e2e 必須是 true 才算完成** — unit test pass 不算

### progress.jsonl

每個 session 結束時 append 一行，不准編輯歷史行。

```jsonl
{"session":1,"ts":"2026-03-23T10:00Z","type":"init","done":0,"total":12,"commit":"abc1234","notes":"Initialized change"}
{"session":2,"ts":"2026-03-23T11:30Z","type":"coding","feature":"F001","result":"done","e2e":"pass","smoke":"pass","commit":"def5678","notes":"Added dark mode toggle"}
```

### init.sh

```bash
#!/bin/bash
set -e
npm ci
npx tsc --noEmit
npm test
npm run build
echo "✅ Smoke test passed — app is healthy"
```

## 與現有流程的整合

| 現有 artifact | Long-running artifact | 關係 |
|--------------|----------------------|------|
| `tasks.md`（markdown checkbox） | `features.json`（JSON） | 雙軌：tasks.md 給人看，features.json 給 agent 讀 |
| `notes.md`（決策/踩坑） | `progress.jsonl`（session 日誌） | 互補：notes.md 記「為什麼」，progress.jsonl 記「做了什麼」 |
| git log | git log | 同一個，不重複 |
| memory system | progress.jsonl | 互補：memory 持久化技術決策和踩坑經驗，跨 session 可搜尋 |

## 跨 Session 經驗管理

每個 session 結束時，除了 append progress.jsonl，也建議將技術決策和踩坑經驗寫入 memory system（`.claude/projects/.../memory/`），讓下個 session 能透過 MEMORY.md 索引查找。

**區別**：progress.jsonl 記「做了什麼」（事實），memory 記「學到什麼」（經驗）。
