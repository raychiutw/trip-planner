# V2 Cutover 開發回顧 — 2026-03-26

## 摘要

將 V2 程式碼切換為正式版，移除所有 V1 程式碼和過渡邏輯。

- **PR**: #131
- **版本**: v1.0.1.0
- **分支**: feat/v2-cutover-cleanup
- **變更**: 42 files, +688/-6596 LOC（淨刪 5908 行）

## 完整 Pipeline 執行記錄

| 階段 | 工具 | 結果 |
|------|------|------|
| Think | 跳過 | 需求明確 |
| Plan | Agent Explore | 探索 V1/V2 過渡程式全貌 |
| Build | Edit/Write/Bash | 16 檔案刪除 + 4 檔案重命名 + imports 更新 |
| Review | /tp-code-verify | 🟢 tsc 0 errors, 659 tests |
| Review | /review + adversarial | 發現 7 個問題，全部修復 |
| Test | /qa (browse) | 95/100，5 頁面全測 |
| Test | /cso | PASS，無安全問題 |
| Ship | /ship | PR #131 created |
| Land | /land-and-deploy | Merged + deployed + canary verified |
| Reflect | /retro + archive | 本文件 |

## Review 發現的隱藏問題（最有價值）

1. **scroll-to-now 選擇器不匹配** — `.tl-now` 在 V2 TripPage 中使用，但 TimelineEvent 只設 `data-now` attribute。Adversarial review 抓到。
2. **border-none 與 border-t 衝突** — ManagePage 回覆分隔線因 Tailwind class 順序問題不可見。
3. **map-highlight 動畫遺失** — 刪除 map.css 時遺漏遷移 `.map-highlight` keyframes 到 tokens.css。
4. **apiFetchRaw 不報告離線狀態** — 共用化時需加入 reportFetchResult。

## 決策記錄

| 決策 | 原因 |
|------|------|
| 刪除 shared.css（不僅 style.css） | tokens.css 已包含所有 theme tokens + logo responsive，shared.css 無任何 import |
| apiFetchRaw 抽至 useApi.ts | CR-4 規則：消除 AdminPage/ManagePage 重複的 raw fetch helper |
| toTimelineEntry 改接 object | CR-7 規則：消除 5 個 `as unknown as` 型別斷言 |
| SWATCH_STYLES 預生成 | RBP-21 規則：避免 render loop 中建立 inline style objects |

## 教訓

1. **刪除 CSS 檔案時必須 grep 所有 JS classList 操作** — CSS class 不只在 JSX className 中使用，也可能在 `classList.add()` 中動態引用。
2. **Tailwind class 順序很重要** — `border-none border-t` 中 `border-none` 會覆蓋 `border-t`，因為 Tailwind 按 source order 解析。
3. **Adversarial review 的價值** — 本次 7 個問題中有 2 個是 adversarial subagent 獨立發現的，結構化 review 未抓到。
