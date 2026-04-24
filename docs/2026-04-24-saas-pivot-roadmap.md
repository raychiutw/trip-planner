# 2026-04-24 Tripline SaaS Pivot Roadmap

trip-planner 從 2-user 私人工具（Cloudflare Access + email 白名單）轉為**開放註冊 + Mindtrip 化**的 SaaS。本文件彙整 2026-04-24 session 所有規劃產出、待開發項目、時程與依賴。

---

## TL;DR

- **雙軌並行**：V2 OAuth/Identity（~12-14 週）+ Layout Refactor（~12 週），可 parallel 推進
- **產出 3 份 design doc + 6 個 OpenSpec changes**，全部 apply-ready
- **兩個強烈警訊 documented**：
  1. Demand 未驗證（Q1 多次 skip，兩 model CEO review 皆 flag）
  2. `@openauthjs/openauth` D1 adapter 不存在（Codex web search 驗證），V2 技術前提需 spike 驗證
- User override 兩 model 的 CEO challenge，選擇維持 plan 推進

---

## 產出索引

### Design Docs（`docs/design-sessions/`）

| 檔案 | 主題 | 用途 |
|------|------|------|
| `lean-master-design-20260424-163000-oauth-server.md` | V2 Identity System + OAuth Server plan | V2 workstream implementation 藍圖，含 37+ autoplan findings checklist |
| `lean-master-design-20260424-180000-mindtrip-benchmark.md` | Mindtrip add-to-trip UX benchmark | add-to-trip flow + Ideas layer UX adaptation options |
| `lean-master-design-20260424-190000-mindtrip-layout-reference.md` | Mindtrip 桌機 + 手機布局規格 | Layout refactor 的 px / grid / URL state / overlay rules 規格書 |
| `terracotta-preview.html` | Terracotta palette 視覺預覽 | 設計色彩參考 |

### Mockup HTML（`docs/design-sessions/`）

B-P2 layout refactor 視覺參考集合 — 透過 `tp-claude-design` skill 產出，每個檔含桌機 1440 / 1100 / mobile 375 三組 viewport，可直接對照實作。

| 檔案 | 對應 | 用途 |
|------|------|------|
| `mockup-index.html` | 入口 | 11 檔導覽頁（3 shell variant + 7 page route + task 對照表） |
| `mockup-shell-v1-ocean.html` | Shell V1 | Ocean 保守路線（對齊 tokens.css 現狀，零 retheme） |
| `mockup-shell-v2-terracotta.html` | Shell V2 ✓ locked | Terracotta filled dark active pill（2026-04-24 定案） |
| `mockup-shell-v3-magazine.html` | Shell V3 | Terracotta + 雜誌 editorial typography 變體 |
| `mockup-trip-v2.html` | `/manage` | 行程 list + sheet 內 day strip + ocean-rail itinerary + trip switcher dropdown（無 sheet tabs） |
| `mockup-chat-v2.html` | `/chat` | 全站 AI discovery entry：empty hero / 對話中 / 聊出 trip → sheet 展開 |
| `mockup-map-v2.html` | `/map` | cross-trip global map（view-only、不含 search、sheet 32vw） |
| `mockup-explore-v2.html` | `/explore` | search/儲存池 2 tab + multi-select + 加入 trip dropdown |
| `mockup-login-v2.html` | `/login` | 未登入（OAuth Google/Apple/LINE 真實 SVG logo + Email）/ 已登入 settings |
| `mockup-signup-v2.html` | `/login/signup` | Step 1 OAuth + Email 三 field + password meter / Step 2 等 verification |
| `mockup-forgot-v2.html` | `/login/forgot` | Step 1 寄連結 / Step 2 設新密碼（password rule meter） |

### OpenSpec Changes（`openspec/changes/`）

全部 4/4 artifacts complete，`openspec status` 皆 apply-ready：

| # | Change | Path |
|---|--------|------|
| P1 | `layout-overlay-rules-and-schema` | Schema 底層（saved_pois / trip_ideas / order_in_day）+ DESIGN.md overlay rules |
| P2 | `desktop-3pane-and-nav-layout` | AppShell + 5 nav sidebar + bottom nav 常駐 |
| P3 | `url-driven-sheet-state` | Query param `?sheet=<tab>` + TripSheet with tabs |
| P4 | `explore-nav-with-poi-search` | /explore 頁 + OSM Nominatim POI search + 儲存池 |
| P5 | `ideas-drag-to-itinerary` | dnd-kit 4 種 drag（promote / reorder / cross-day / demote） |
| P6 | `layout-refactor-polish-qa` | Polish + a11y + perf + E2E + ship 收尾 |

---

## Locked Decisions（office-hours 2026-04-24 session）

### Layout 6 Q

1. **桌機 3-pane layout** — sidebar 240px + main fluid + right sheet 40vw collapsible
2. **桌機 sidebar 5 nav** — 聊天 / 行程 / 地圖 / 探索 / 登入（不佔 nav：Create 走 modal）
3. **手機 bottom nav 常駐** — 不 hide on scroll，永遠 visible，全站通用
4. **Per-trip sheet URL** — query param `?sheet=map/ideas/itinerary/chat`（`/trip/:id/map` 301 redirect）
5. **探索 nav scope** — 搜尋 POI + 儲存池 + 加入 trip（無 heart-on-card，整合 Mindtrip 的 Explore + Saved 到一個 nav）
6. **Overlay Pattern Rules** — 寫進 DESIGN.md（guideline 已在 layout-reference doc 的 appendix）

### V2 Auth 6 Premise（自 office-hours V2 design doc）

- P1 Google OAuth 單一 provider 起步（provider-agnostic schema 預留 Apple / LINE / local password）
- P2 `trip_permissions` 不動 + 新 `trips.owner_user_id`（不 rebuild）
- P3 陌生人看空白 `/manage`（不 auto-show 他人行程）
- P4 Dark mode per-device localStorage
- P5 一次到位 4 週+（user revised from 2 週）
- P6 Opaque `__Host-session` cookie + SHA-256 hash（非 JWT session）

### Autoplan R1-R4 Adopted（Codex 技術建議）

- R1 Fact corrections（table 名 `trip_permissions` 非 `permissions`；Dark mode 已存在於 `useDarkMode.ts` 只差 retheme）
- R2 Opaque session cookie 取代 JWT
- R3 `trip_permissions` 不動 + `trips.owner_user_id` 雙軌
- R4 D1 hot-path write amplification 防護（coarse-grained `last_seen_at`）

R5（scope 收斂為 A scope + B schema shape）user 選擇不採納，維持完整 B approach 4 週+。

---

## 兩條 Workstream

### Workstream A：V2 Identity / OAuth Server（~12-14 週）

Scope：OAuth 2.0 Authorization Server + Google OpenID + 自建 local password + 忘記密碼。
Doc：`docs/design-sessions/lean-master-design-20260424-163000-oauth-server.md`
Status：**APPROVED with 37+ findings**，未開工。
Hard blocker（Day 0）：**Phase 0 spike 1-2 天驗證 `@openauthjs/openauth` D1 adapter 存在性**（Codex 確認官方 docs 推薦 KV，`wrangler.toml` 只 bind D1）。

Phase 順序：
- P1 Identity core + Google OIDC (Week 1-2)
- P2 Local password + email verification (Week 3-4)
- P3 忘記密碼流程 (Week 5)
- P4 OAuth Server 基本（authorize + JWKS）(Week 6-8)
- P5 Token endpoint + consent screen (Week 9-10)
- P6 Security hardening + rate limit (Week 11-12)
- P7 Developer docs + external security audit + launch (Week 13-14)

### Workstream B：Layout Refactor + Mindtrip 化（~12 週）

Scope：桌機 3-pane + Ideas layer + Explore + drag + polish。
Docs：`docs/design-sessions/lean-master-design-20260424-180000-mindtrip-benchmark.md` + `.../lean-master-design-20260424-190000-mindtrip-layout-reference.md`
Status：6 個 OpenSpec changes 全 apply-ready。

Phase 順序：
- P1 Schema + Overlay Rules (Week 1-2)
- P2 3-pane + sidebar + bottom nav 常駐 (Week 3-4)
- P3 URL-driven sheet state (Week 5-6)
- P4 Explore + POI search (Week 7-9)
- P5 Ideas drag-to-promote (Week 10-11)
- P6 Polish + QA + ship (Week 12)

---

## 依賴關係

```
Workstream A (OAuth)                         Workstream B (Layout)
─────────────────────                        ─────────────────────
V2-P0 Spike (@openauthjs/openauth)           B-P1 Schema (saved_pois, trip_ideas)
       │                                            │
       v                                            v
V2-P1 Identity core                          B-P2 3-pane + sidebar
       │                                            │
       v                                            v
V2-P2 Local password                         B-P3 URL state + sheet tabs
       │                                            │
       v                                            v
V2-P3 Forgot password                        B-P4 Explore ─┐
       │                                            │      │
       v                                            v      │
V2-P4~P6 OAuth Server build ←─ 可 parallel ─→ B-P5 Drag   │
       │                                            │      │
       v                                            v      │
V2-P7 Launch + audit                         B-P6 Polish  ◄┘
```

**注意**：
- B-P4（Explore）的儲存池使用 `saved_pois` — B-P1 需先 ship
- B-P5 drag 用 `trip_entries.order_in_day` — B-P1 需先 ship
- B-P2 ship 時 map rail 暫消失 → 建議 B-P2 + B-P3 合併 single release
- V2-P1 的 `users / auth_identities / sessions` 跟 B-P1 的 schema **不衝突**（不同 tables），可 parallel

---

## 待開發項目清單（punch list）

### 🔴 開工前必做（Day 0-2）

- [ ] **V2 Phase 0 spike** — 驗證 `@openauthjs/openauth` D1 adapter 存在性（1-2 天）
- [ ] **The Assignments (office-hours session 留下)**:
  - [ ] 查 Cloudflare Access deny log，數非 Ray / HuiYun 的 distinct email（demand evidence）
  - [ ] 約「第三方 dev」15 分鐘訪談記錄 app 名 / stage / timeline（V2 OAuth Server 的 demand verification）
- [ ] 決定 Google Cloud Console OAuth credentials + production domain（`pages.dev` vs custom）

### 🟠 Week 1-2

- [ ] **B-P1**：`/opsx:apply layout-overlay-rules-and-schema`
- [ ] **V2-P1**：Identity core migration（users / auth_identities / sessions）+ Google OIDC

### 🟠 Week 3-6

- [ ] **B-P2 + B-P3**（合 release）：3-pane AppShell + sidebar 5 nav + bottom nav 常駐 + URL-driven sheet state + TripSheet with tabs
- [ ] **V2-P2 + P3**：Local password + email verification + 忘記密碼流程

### 🟡 Week 7-12

- [ ] **B-P4**：Explore page + POI search + 儲存池
- [ ] **V2-P4~P6**：OAuth Server build + security hardening（可與 B-P4/P5 parallel）
- [ ] **B-P5**：Ideas drag-to-itinerary
- [ ] **B-P6**：Polish + a11y + perf + QA

### 🟢 Week 13-14

- [ ] **V2-P7**：Developer docs + 外部 security audit + public launch
- [ ] 合併 V2 + Layout v3 ship 宣告

---

## Risks + Outstanding

### CRITICAL risks（documented，user override）

1. **Demand unverified** — V2 OAuth 的「第三方 app 要接」+ SaaS 轉型 demand 皆未驗證。兩 model CEO review 一致建議「Partner API + Google OIDC」替代方案，user override。
2. **`@openauthjs/openauth` D1 adapter 不存在** — Codex web search 確認官方推薦 KV。若 Phase 0 spike 證實無 D1 adapter：
   - A) 自寫 adapter（+ 2-3 週）
   - B) 改用 KV storage（改 `wrangler.toml` + code）
   - C) 換 framework（Lucia / Clerk）
3. **`_utils.ts` camelCase 不適 OAuth wire format** — OAuth endpoints 需獨立 responder（非 reuse 既有 helper）。

### 其他 Open Questions

- Phase 2 ship 時 map rail 消失 → 建議與 Phase 3 合併單一 release
- Phase 0 spike 結果若 @openauthjs/openauth 不可用，V2 timeline 可能延至 16-20 週
- Explore 的 POI search provider：Nominatim 免費但中文品質未驗證；若不佳需升級 Google Places（付費）
- V2 OAuth 的外部 security audit（Phase 7）—— Trail of Bits / Cure53 booking lead 4-8 週，建議 Week 1 就 book
- V2 Dark mode 實際上已有 `src/hooks/useDarkMode.ts` 全功能 three-way state，只差 retheme Ocean → Terracotta（Codex 發現）

### 使用者決策留檔

- Q1 skipped 2 次（demand verification）
- Q3 skipped 1 次（desperate specificity）
- CEO user challenge overridden（維持 plan 非採 Partner API 替代）
- Q5 Explore scope 從 B 改「B + 儲存功能回到探索 nav」（user revised in-flight）
- 12 週 layout refactor 同意以 user taste judgment 推進（非 MVP-first）

---

## 相關資源

- [V2 OAuth design doc](design-sessions/lean-master-design-20260424-163000-oauth-server.md)
- [Mindtrip UX benchmark](design-sessions/lean-master-design-20260424-180000-mindtrip-benchmark.md)
- [Mindtrip layout reference](design-sessions/lean-master-design-20260424-190000-mindtrip-layout-reference.md)
- [Terracotta preview](design-sessions/terracotta-preview.html)
- [Mockup HTML 集合（B-P2 視覺參考）](design-sessions/mockup-index.html)
- [OpenSpec changes](../openspec/changes/)
- [既有 DESIGN.md](../DESIGN.md)
- [tp-claude-design skill](../.claude/skills/tp-claude-design/)

---

## Changelog

- **2026-04-24 session**：完成 autoplan + office-hours 4 輪 + opsx:propose 產 6 changes。User 主動 research Mindtrip 競品 UX（提供 12 張 screenshots）+ 把 Mindtrip + OpenAuth 方案兩 model 挑戰全納入但 override 後維持 plan。
- **2026-04-24 mockup batch**：透過 `tp-claude-design` skill 產出 11 個 HTML mockup（3 shell variant + 7 page route + 1 index）放在 `docs/design-sessions/mockup-*.html`。Shell V2 Terracotta 為 locked palette。Sheet 結構優化：移除 sheet tabs（功能跟 sidebar nav 重複）、改 trip switcher dropdown。Provider button 用真實 OAuth logo SVG（Google/Apple/LINE）。
