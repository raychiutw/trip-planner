# unify-page-styles 開發回顧

**日期**：2026-03-24
**PR**：#97
**分支**：feat/unify-page-styles
**變更**：統一四頁 CSS 風格（sticky-nav、max-width、捲動重置）
**結果**：淨減少 43 行 CSS，9 個檔案

---

## Pipeline 執行紀錄

| 階段 | 技能 | 耗時 | 結果 |
|------|------|------|------|
| Plan | `/autoplan` | ~15 min | CEO + Design + Eng 三審 CLEAN，11 decisions |
| Build | 手動寫 code | ~5 min | 9 files changed |
| Build | `/simplify` | ~3 min | 4 issues fixed |
| Review | `/tp-code-verify` | ~2 min | 🟢 GREEN |
| Review | `/tp-ux-verify` | ~1 min | 🟢 GREEN（css-hig 13/13） |
| Review | `/review` | ~5 min | CLEAN + adversarial 找到 1 個 HIGH bug |
| Test | `npm test` | ~15s | 686/686 pass |
| Ship | `/ship` | ~3 min | PR #97 建立 + merge |
| Reflect | archive | ~1 min | 歸檔完成 |

---

## 重複操作分析

### 1. `npm test` 重複跑了 5 次

| 觸發者 | 階段 | 是否必要 |
|--------|------|----------|
| Build 手動 | Build Step 2 | ✅ 必要 — 實作後首次驗證 |
| `/simplify` 修完後 | Build Step 3 | ✅ 必要 — simplify 改了 code |
| `/tp-code-verify` | Review Step 1 | ❌ 重複 — 和 simplify 後那次之間沒有 code 改動 |
| `/review` adversarial 修完後 | Review Step 2 | ✅ 必要 — review 修了 admin.css 和 setting.css |
| `/ship` merge master 後 | Ship Step 3 | ✅ 必要 — master 有新 commit 進來 |

**結論**：`/tp-code-verify` 的 `npm test` 跟 `/simplify` 後的重複了。如果中間沒有 code 改動，可以跳過。

### 2. 程式碼掃描重複

| 掃描項目 | `/simplify` Agent 1 | `/simplify` Agent 2 | `/simplify` Agent 3 | `/review` adversarial |
|----------|---------------------|---------------------|---------------------|-----------------------|
| Dead code | ✅ 掃到 | — | — | ✅ 也掃到 |
| Redundant `::before` scope | ✅ 掃到 | — | ✅ 掃到 | ✅ 也掃到 |
| edit.css token 不一致 | ✅ 掃到 | ✅ 掃到 | — | — |
| 冗餘 useEffect | — | ✅ 掃到 | — | — |
| admin mobile max-width bug | — | — | — | ✅ 獨有 |
| setting sticky nav 丟失 | — | — | — | ✅ 獨有 |
| dark mode no-op | ✅ 掃到 | ✅ 掃到 | — | ✅ 也掃到 |

**結論**：
- `/simplify` 的 3 個 agent 之間有少量重疊（`::before` scope 被 Agent 1+3 都掃到），但各自有獨有 findings，整體效率可接受
- `/simplify` 和 `/review` adversarial 之間重疊嚴重 — dead code、`::before` scope、dark mode no-op 三項被雙方都掃到
- **但 `/review` adversarial 有 2 個獨有的 HIGH 級別 findings**（admin mobile bug、setting sticky nav），這是 `/simplify` 沒掃到的。所以不能跳過 `/review`

### 3. `/autoplan` 和 `/review` 的角色重疊

`/autoplan` 的 Eng Review 階段已經做了架構、測試覆蓋度、效能的分析。`/review` 再做一次類似的 checklist 掃描。

| 分析項目 | `/autoplan` Eng Review | `/review` structured |
|----------|----------------------|---------------------|
| Architecture | ✅ ASCII 圖 | ✅ checklist |
| Test coverage | ✅ coverage diagram | ✅ test gaps |
| Performance | ✅ 分析 | ✅ checklist |
| SQL safety | — | ✅ Pass 1 |
| Race conditions | — | ✅ Pass 1 |

**結論**：`/autoplan` 在計畫階段做的是「計畫的架構分析」，`/review` 是「實際 code 的結構檢查」。雖然看起來重複，但一個是 plan-time 一個是 code-time，角度不同。保留。

---

## 未解決的 Bug

### Bug 1：`@googlemaps/js-api-loader` 缺少

- **影響**：`npx tsc --noEmit` 報 40+ 個 google namespace 錯誤、`npm run build` 失敗
- **範圍**：DayMap.tsx、MapMarker.tsx、MapRoute.tsx、TripMap.tsx、useGoogleMaps.ts
- **修復方向**：`npm install @googlemaps/js-api-loader` 或在 tsconfig 排除
- **優先級**：P1 — 阻擋 production build

### Bug 2：gstack browse daemon 頁面載入空白

- **環境**：Windows 10 + Vite dev server (port 5173) + headless Chromium
- **現象**：`$B goto http://localhost:5173/setting.html` 回報 200，但 `$B html` 回傳空白 `<html><head></head><body></body></html>`、`$B js` 回傳空值
- **影響**：無法用 `/browse` 做視覺驗證，只能依賴 production 站點
- **修復方向**：排查 headless Chromium 是否需要特定 flag 處理 Vite 的 ESM/HMR
- **優先級**：P2 — 不阻擋部署，但影響 QA 流程

---

## 改善建議

1. **純 CSS 重構可精簡 pipeline**：`/simplify` 和 `/review` adversarial 掃描重疊度高。建議未來純 CSS 改動時，`/review` 只跑 structured pass（checklist），跳過 adversarial subagent
2. **`/tp-code-verify` 判斷是否需要重跑 `npm test`**：如果上次測試後沒有 code 改動，直接沿用結果
3. **優先修復 `@googlemaps/js-api-loader`**：這擋住了 tsc 和 build，影響整個 CI pipeline
