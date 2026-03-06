## Context

edit.html 的修改請求 textarea 目前用 `var(--fs-md)`（18px）、`max-height: 160px`、無 maxlength。Issue 建立時只掛 `trip-edit` label，查詢時拉 20 筆不分行程。`tp-issue` skill 也用 `--label trip-edit` 掃描所有待處理 Issue。

## Goals / Non-Goals

**Goals:**
- textarea 限制字數、縮小字體、放大可用高度
- Issue 建立時多掛 tripSlug label，查詢時按 slug 過濾只顯示當前行程

**Non-Goals:**
- 不修改 tp-issue skill（仍用 `--label trip-edit` 掃描全部 Issue）
- 不處理舊 Issue 的 label 補掛（已建立的 Issue 維持只有 `trip-edit`）
- 不做字數計數器 UI

## Decisions

### D1：保留 trip-edit label + 新增 tripSlug label

**選擇**：建立 Issue 時 `labels: ['trip-edit', tripSlug]`，兩個 label 並存。

**替代方案**：移除 trip-edit，只用 tripSlug。

**理由**：`trip-edit` 是 tp-issue skill 用來掃描所有行程待處理 Issue 的語意標記，移除會破壞 skill。slug label 負責分類歸屬，兩者職責不同。

### D2：查詢改用 slug label 過濾

**選擇**：`loadIssues` 查詢改為 `?labels={tripSlug}&state=all&per_page=20`。

**替代方案**：繼續用 trip-edit 查全部 + 前端 JS 過濾 title。

**理由**：API 層過濾比前端過濾更高效，也不會因為 20 筆 per_page 限制而漏掉當前行程的 Issue（如果其他行程的 Issue 太多把名額佔滿）。

### D3：textarea max-height 用 25vh

**選擇**：`max-height: 25vh` 取代 `160px`。

**理由**：160px 在大螢幕太矮、在小螢幕又佔太多。25vh 根據視窗高度自適應，手機和桌機都約佔 1/4 畫面。

## Risks / Trade-offs

- **slug label 自動建立**：GitHub API 在有 repo 權限的 token 下會自動建立不存在的 label。若 token 權限不足，label 可能被忽略但 Issue 仍會建立成功 → 查詢時找不到該 Issue。風險低，因為目前 token 已有足夠權限。
- **舊 Issue 不回溯**：改動前建立的 Issue 只有 `trip-edit` label，在新的 slug 過濾下不會顯示。可接受，因為這些 Issue 多已處理完畢。
