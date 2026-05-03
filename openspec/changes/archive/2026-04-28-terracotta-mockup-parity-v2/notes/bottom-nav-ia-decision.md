# Bottom Nav IA — 5-tab vs 4-tab Decision Note

**Status**: PENDING — 等 product office-hours / CEO review
**Spec**: `specs/mobile-bottom-nav/spec.md` Requirement「Bottom Nav IA 5-tab vs 4-tab decision」
**Owner**: Ray (product)

## 兩種 IA 對比

| Aspect | Mockup 5-tab global | React 4-tab trip-scoped (current) |
|---|---|---|
| Tab 1 | 聊天 (chat list) | 行程 (current trip) |
| Tab 2 | 行程 (trips list) | 地圖 (current trip map) |
| Tab 3 | 地圖 (global map) | 助理 (chat for current trip) |
| Tab 4 | 探索 | 更多 (action sheet：collab / trip-select / appearance / export) |
| Tab 5 | 帳號 | — |
| Mental model | App-level global navigation | Trip-level scoped + global escape via「更多」 |
| 切 trip 流程 | 透過 chat list / trips tab | TripPickerSheet (action sheet 內) |

## Decision context

當前 Trip-planner 是 **single-trip context-heavy** app — user 開 app 多半進固定 trip。4-tab trip-scoped 設計優化 in-trip workflow（行程/地圖/聊天直連當前 trip）。「更多」action sheet 收 collab/trip-select/appearance/export 4 個 less-frequent action。

Mockup 5-tab 預設 user 是 global app 使用者：經常在 trip / 聊天列表 / 探索 / 帳號 之間切換。對齊 standard mobile app pattern (Instagram / Linear / Notion)。

## Recommendation 候選方向

### Option A: Adopt 5-tab (mockup-aligned)
- ✅ 對齊 mockup spec 設計 source of truth
- ✅ Standard mobile app pattern user 熟悉
- ✅ 帳號 + 探索 進 nav 提升 discoverability
- ❌ 「更多」 sheet 內容散開要找新家：collab → trip TitleBar、trip-select → 行程 tab 內 picker、appearance → AccountPage、export → trip TitleBar overflow menu
- ❌ Trip-scoped UX 弱化（in-trip user 想切地圖／聊天得多 1 step：先回 /trip 再點對應 tab）
- ❌ Mobile screen real estate 5 tab 比 4 tab squeeze label 空間

### Option B: Keep 4-tab (current)
- ✅ 保留 trip-scoped 高效 in-trip workflow
- ✅ 「更多」 action sheet pattern 已有 user 熟悉度
- ❌ 跟 mockup spec 偏離（design-review 永遠標 deviation）
- ❌ 帳號 + 探索 entry 不夠 prominent（只在 desktop sidebar / chat trip switcher）

### Option C: Hybrid context-aware
- ✅ Logged in /trip/* 路徑用 4-tab trip-scoped；其他用 5-tab global
- ✅ 兩 mental model 並存 fit 各自 use case
- ❌ Implementation 複雜：path detect + 視覺切換 indicator 防 user confused
- ❌ Mental model 切換成本（user 進出 trip 看到 nav 突然變）

## Resolution criteria

需要 product 決策，不該由 implementation 端推測。Decision 應考慮：

1. **Primary user scenario**：trip-planner user 主要 use case 是「規劃單一 trip 深入」還是「在多 trip / 探索 / 聊天間 switch」？
2. **Mockup 為何採 5-tab**：mockup 設計 author 是否有 explicit rationale？是 pattern alignment 還是 IA decision？
3. **Trip-scoped lose** = quantifiable loss：in-trip user 切地圖／聊天多 1 step 對 retention 影響？
4. **未來 IA evolution**：trip-planner 走 SaaS 多 trip 還是「我的 trip 規劃」單軌？

## Next action

Pending **`/office-hours` 或 `/plan-ceo-review`** session 跑 forcing question，輸出更新本 doc 的 Decision section 後，解鎖 `tasks.md` Section 5.2 / 5.3 / 5.4 對應 implementation。

本 capability 在 PR `terracotta-mockup-parity-v2` 主 PR 不啟動 implementation，純留 spec + decision doc。
