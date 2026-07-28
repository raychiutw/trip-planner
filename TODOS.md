# TODOs

已知待辦與 follow-up。按 Skill/Component 分組，每項標 Priority。

**Priority**：
- **P0** — 現在就該修（阻擋使用 / 資料損失 / 安全性）
- **P1** — 下一個 sprint 要修（明顯影響使用者體驗）
- **P2** — 有空就修（少數人踩到、體驗小瑕疵）
- **P3** — 想做再做（nice-to-have）
- **P4** — 可能不做（長期觀察）

---

## Active

### 色彩對比 — Tailwind utility 路徑不在任何守衛的視線內

**Priority**: P2（既有違規已存在，但沒有守衛會發現新的）

`css/tokens.css` 的 `@theme` 會把 `--color-accent` 生成 `text-accent` utility，於是
`hover:text-accent` 這種寫法產出的就是 `color: var(--color-accent)` —— 但它不在任何
CSS 字串裡，`tests/unit/trips-list-accent-text.test.ts` 這類掃 template literal 的守衛
**永遠**看不到，axe 也只在該狀態被觸發時才掃得到。

現有實例：`InfoSheet.tsx:261`（`hover:text-accent hover:bg-accent-bg`，實測 2.77:1，
連非文字的 3:1 都不到）、`HourlyWeather.tsx:121/158/205`（`hover:text-accent hover:bg-hover`，
3.27:1）。

要嘛把 `--color-accent` 排除在生成 `text-*` utility 的 token 之外（改名成只給填色用），
要嘛接受這條路徑靠人工守。這是策略決定，不是純實作。v2.57.50 / #1156 稽核發現。

### 色彩對比 — `body.theme-print` 沒覆寫 `-text` 系列 token

**Priority**: P3（目前影響面小，但會隨遷移線性放大）

`body.theme-print`（`css/tokens.css`）覆寫了 `--color-accent` / `-subtle` / `-bg` 成灰階，
但**沒有**覆寫 `--color-accent-text` / `-text-on-tonal` / `-deep`，它們會回落 light 的
`#8A6038` / `#7A5430`。

`#1156` 立的通則要求全庫把文字色遷到 `-text` 變體 —— 每遷一處，列印模式的灰階版面就多
一處暖褐色文字。目前 print mode 只掛在行程明細頁（`usePrintMode` 只在 `TripPage` 使用），
所以現在幾乎無感，但全庫推廣前要先補 print 的 token 覆寫。v2.57.50 / #1156 稽核發現。

### tp-request — flag-OFF 路徑仍走未-contained spawn（activation 硬化）

**Priority**: P1（安全；pre-existing，flag OFF 才可達）

`TP_REQUEST_USER_TOKEN` OFF 時，`/tp-request`（處理 untrusted `trip_requests.message`）仍降級 service-token 走未-contained `--dangerously-skip-permissions` session（`spawnTmuxRequest` 未-contained tmux 路徑），prompt-injection 可讀 Mac 憑證 → 拿 `API_SECRET` 可 mint owner token（若該 owner 已有 Consent）。flag ON 時此路徑已不可達（走 mint→contained 或 fail-closed）。**不能盲修**：10-min cron + CF `/trigger` 都在此路徑跑 prod AI 聊天 pipeline，直接 `return false` 會停掉聊天。與 containment 就緒度耦合 → 併 activation 一起做：activation 應**原子化**（containment ready + Consent + flag 同時上），別留 Consent-first-flag-later 窗口；或改造 spawn 讓 service-token 路徑也能 contained。security-auditor v2.55.62 P1。

### trip_docs 退場收尾 —— 確認 67 筆搬遷後才套 0094

**Priority**: P1（有時限；0094 未套前 schema 帶著兩張空表）

migration 0093 已把 backup 43 + suggestions 24 = 67 筆搬進 `trip_pretrip_notes`。**0094（DROP 兩張表）刻意還沒套** —— 依 DROP 部署規則是「code 先上線、DROP 後套」，而且要先讓 owner 在筆記頁確認 67 筆看得到。確認後執行 `wrangler d1 migrations apply trip-planner-db --remote --env production`。⚠️ 那 67 筆是 `origin=ai / managed_by=ai / ai_source=general-tips`（owner 決定不擋未來生成），所以**下次按「一般」AI 生成會被整批取代**；想留哪筆就在 App 裡編輯它一次（翻成 human 即受保護）。

### request 收屍 — 牆鐘那層繞過完成 hook，linked 報告會停在 pending

**Priority**: P3（罕見路徑；pre-existing，非 v2.57.77 引入）

`reapIfStale`（`functions/api/_requestTermination.ts`）直接 UPDATE `trip_requests`、不經 `PATCH /requests/:id`，所以 `applyHealthCheckCompletion` / `applyNotesGenerationCompletion` 不會跑 —— 被 100 分鐘牆鐘收掉的健檢／筆記請求，其 `trip_health_reports` 會停在 `pending`（前端一直轉）。**不是 v2.57.77 引入的迴歸**：在此之前 request 根本永遠停在 `processing`，那些表一樣卡著。第一層（api-server 就地收屍）走 PATCH、hook 照跑，所以只有「mac mini 死透 100 分鐘」才踩得到。根本解是抽出 `mint-restricted.ts:127` 已經記下的共用 `failRequest` helper，讓三個終結入口（PATCH hook / mint-restricted park / 牆鐘）走同一段 linked-table 連動。見 ADR-0007 的 Consequences。

### 測試套件 — D1 建置成本迫使 unit 限流 2 worker（根本解：共用已 migrate 快照）

**Priority**: P3（開發體驗；不影響使用者）

v2.57.15 把 `npm test` 限成 `--maxWorkers=2`，因為每個 worker 都要各自建 Miniflare D1 並跑 90+ 個 migration，滿並行度下會有測試撞 timeout（實測預設並行度 1 failed，maxWorkers=2 全綠且**還略快** 289.87s vs 294.70s）。這是權宜：測試檔繼續長，2 worker 遲早也會撞牆，而現在整套要跑 ~290 秒。根本解是共用一份已 migrate 的 D1 快照（建一次、各 worker 複製），讓並行度重新可用。沒調高 `hookTimeout` —— 那等於把訊號關掉。

**2026-07-29 實測：已經開始間歇性撞牆。** migration 加到 93 支後，本機全跑兩次有一次紅 —— 6 個 suite 掛在 `createTestDb()` 的 `beforeAll`，錯誤是 `Hook timed out in 30000ms`（config 寫 `hookTimeout: 60000`，但 vitest 對 `describe` 內的 `beforeAll` 實際套的是 `testTimeout: 30000`）。13 支 unit 測試各要建一次 Miniflare + 全套 migration，兩個 worker 各建一份。第二次全跑 489 檔全綠，所以是浮動不是迴歸 —— 但**每加一支 migration 就更靠近臨界**，下一次可能就變成 CI 間歇紅。根本解仍是共用已 migrate 的 D1 快照。
### CSS — 8 個 component 的 SCOPED_STYLES 仍手寫 `-webkit-backdrop-filter`（同一顆雷，目前未爆）

**Priority**: P3（目前無害，但會在搬家時炸掉）

v2.57.14 修掉了 `css/tokens.css` 裡的 5 處：成對寫 `backdrop-filter` +
`-webkit-backdrop-filter` 時，lightningcss 去重會**留下 `-webkit-` 那條**，Chrome
computed 變成 `none` —— 整組手寫玻璃在 Chrome 上從來沒生效過。

component 的 `SCOPED_STYLES` 是 runtime 注入的 `<style>`，不經建置器，所以這 8 個檔案
（DesktopSidebar / GlobalBottomNav / StackPanelHeader / GooglePoiCard / _tripFormStyles /
ChatPage / LandingPage / MapPage）目前是好的 —— 但它們是**意外正確**，不是寫得比較對。
任何一段被抽進 `tokens.css`（或未來 component styles 被納入建置）就會立刻複製這個 bug。

專案 browserslist 是 `last 2 Chrome versions`，本來就不需要手寫前綴。清掉即可，
只是要一個一個確認沒有依賴舊 Safari 的地方。

