# Plan: Requests 分頁 + Markdown 渲染

## /autoplan Review — CEO + Design + Eng

---

## Phase 1: CEO Review (Strategy & Scope)

### Premise Challenge

| Premise | Valid? | Rationale |
|---------|--------|-----------|
| 需要分頁（資料量會超過 50 筆） | ✅ | 每個行程可能有大量請求，尤其多旅伴時。即使目前不多，分頁是正確的 API 設計 |
| Cursor-based 優於 offset | ✅ | D1 沒有 window functions，新增/刪除會造成 offset 漂移。cursor 是標準做法 |
| created_at 可當 cursor | ✅ | D1 auto-generated ISO timestamp，DESC 排序精度足夠 |
| message 需要 Markdown | ✅ | tp-request CLI 已產出 Markdown 格式的回覆，message 同理 |
| 飯店 details 需要 Markdown | ✅ | details 目前是純文字陣列，但行程資料中有些 details 包含連結和格式 |
| marked.js 不需新增 | ✅ | 已在 ManagePage import（用於 reply） |

**所有前提合理，無需挑戰。**

### Dream State

```
CURRENT                    THIS PLAN                   12-MONTH IDEAL
─────────                  ─────────                   ──────────────
50 筆硬上限                 → cursor 分頁 10 筆/頁       → 全文搜尋 + 過濾
message 純文字              → Markdown 渲染              → 富文字編輯器
details 純文字列表          → Markdown 渲染              → 結構化資料 + 地圖
一次載入全部                → infinite scroll            → 虛擬捲動 + 快取
```

### Scope Decision: SELECTIVE EXPANSION — Hold scope

4 個功能都在 blast radius 內（ManagePage + Hotel + requests API），沒有 scope creep。

### What Already Exists

| Sub-problem | Existing Code |
|-------------|--------------|
| API 分頁 | `functions/api/requests.ts` — 已有 SQL builder，加 WHERE/LIMIT 即可 |
| Infinite scroll | 無 — 需新建 |
| Markdown 渲染 | `ManagePage.tsx` 已有 `marked` import + `sanitizeHtml` + `[data-reply-content]` CSS |
| Hotel details | `src/components/trip/Hotel.tsx` — 已有 details 渲染邏輯 |

### NOT in Scope
- 搜尋/過濾功能
- POST/PATCH API 修改
- pull-to-refresh（已有）
- 虛擬捲動（資料量不需要）

### Error & Rescue Registry

| Error | User Sees | Rescue |
|-------|-----------|--------|
| 分頁 API 回傳空陣列 | 「沒有更多了」 | hasMore=false 停止載入 |
| 分頁 API 網路失敗 | 底部顯示重試按鈕 | retry 機制 |
| Markdown XSS | 不會發生 | sanitizeHtml 防護 |
| created_at 重複（同秒多筆） | 可能漏筆 | 加入 id 作為 tiebreaker |

### Failure Modes

| Mode | Severity | Mitigation |
|------|----------|------------|
| created_at 同秒重複造成漏筆 | MEDIUM | SQL 加 `(created_at < ? OR (created_at = ? AND id < ?))` |
| IntersectionObserver 不支援 | LOW | Safari 12.1+ 全支援，不需 polyfill |
| marked.js 渲染惡意 HTML | HIGH | 已有 sanitizeHtml，必須確保所有 marked 輸出都經過 |

---

## Phase 2: Design Review (UI Scope)

### Dimensions

| Dimension | Score | Notes |
|-----------|-------|-------|
| 資訊架構 | 9/10 | 請求列表 + 分頁清晰 |
| 互動設計 | 8/10 | infinite scroll 自然，需注意 loading 狀態 |
| 視覺一致性 | 9/10 | 共用現有 CSS 樣式 |
| 無障礙 | 8/10 | sentinel 需 aria-hidden，loading 需 aria-live |
| 空狀態 | 9/10 | 已有「無請求」狀態 |
| 錯誤狀態 | 7/10 | 需要分頁載入失敗的 UI（重試按鈕） |
| 響應式 | 9/10 | 現有 layout 已響應式 |

### Design Issues
1. 分頁載入失敗需要 inline retry 按鈕（不是 toast）
2. 「沒有更多了」文字需要 `text-muted text-caption` 樣式
3. Loading spinner 用現有 skeleton-bone 動畫保持一致

---

## Phase 3: Eng Review

### Architecture

```
                 GET /api/requests
                 ?tripId=x&limit=10&before=ts
                        │
                        ▼
              ┌─────────────────┐
              │  requests.ts    │
              │  cursor WHERE   │
              │  + hasMore calc │
              └────────┬────────┘
                       │ { items, hasMore }
                       ▼
              ┌─────────────────┐
              │  ManagePage.tsx  │
              │  loadMore()     │
              │  IntersectionObs│
              │  append state   │
              └────────┬────────┘
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
    RequestCard   RequestCard   sentinel
    (message:     (message:     (triggers
     marked+san)   marked+san)  loadMore)
```

### Critical Implementation Notes

1. **cursor tiebreaker**: `created_at` 可能同秒重複。用 `(created_at, id)` 複合 cursor：
   `WHERE (created_at < ? OR (created_at = ? AND id < ?)) ORDER BY created_at DESC, id DESC LIMIT ?`

2. **hasMore 計算**: 多撈 1 筆 — `LIMIT N+1`，如果回傳 N+1 筆則 hasMore=true，只回傳前 N 筆

3. **API 回傳格式變更**: 從 `[]` 改為 `{ items: [], hasMore: boolean }`。需要向下相容處理

4. **Markdown 共用**: 抽出一個 `renderMarkdown(text: string): string` helper，ManagePage 的 reply + message + Hotel details 共用

5. **sanitizeHtml 必須包住所有 marked 輸出** — 沒有例外

### Test Plan

| Test | Type | Coverage |
|------|------|----------|
| API 分頁 — 第一頁 | unit | requests.ts |
| API 分頁 — 第二頁（before 參數） | unit | requests.ts |
| API 分頁 — 最後一頁 hasMore=false | unit | requests.ts |
| API 分頁 — 空結果 | unit | requests.ts |
| API 分頁 — limit 超過 50 被截斷 | unit | requests.ts |
| API 向下相容 — 不帶參數 | unit | requests.ts |
| Markdown 渲染 + sanitize | unit | renderMarkdown helper |
| Hotel details markdown | unit | Hotel.tsx |

---

## Decision Audit Trail

| # | Phase | Decision | Principle | Rationale | Rejected |
|---|-------|----------|-----------|-----------|----------|
| 1 | CEO | Cursor-based 分頁 | P1 completeness | 比 offset 更正確 | offset 分頁 |
| 2 | CEO | created_at + id 複合 cursor | P1 completeness | 防同秒重複 | 單一 created_at |
| 3 | CEO | Hold scope（4 功能） | P3 pragmatic | 全在 blast radius | 擴展搜尋/過濾 |
| 4 | Eng | LIMIT N+1 算 hasMore | P5 explicit | 比 COUNT(*) 簡單高效 | 額外 COUNT query |
| 5 | Eng | 抽出 renderMarkdown helper | P4 DRY | 3 處共用 | 各處重複 marked+sanitize |
| 6 | Eng | API 回傳改 { items, hasMore } | P1 completeness | 標準分頁格式 | 維持陣列 + header |
| 7 | Design | 失敗用 inline retry 按鈕 | P5 explicit | 比 toast 更可操作 | toast 通知 |

---

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 1 | CLEAR | 0 critical, 1 medium (cursor tiebreaker) |
| Eng Review | `/plan-eng-review` | Architecture & tests | 1 | CLEAR | 0 critical, noted cursor + hasMore pattern |
| Design Review | `/plan-design-review` | UI/UX gaps | 1 | CLEAR | 1 medium (retry button for load-more failure) |

**VERDICT:** CLEARED — all reviews passed via /autoplan auto-decisions.
