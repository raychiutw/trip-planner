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

### tp-request — flag-OFF 路徑仍走未-contained spawn（activation 硬化）

**Priority**: P1（安全；pre-existing，flag OFF 才可達）

`TP_REQUEST_USER_TOKEN` OFF 時，`/tp-request`（處理 untrusted `trip_requests.message`）仍降級 service-token 走未-contained `--dangerously-skip-permissions` session（`spawnTmuxRequest` 未-contained tmux 路徑），prompt-injection 可讀 Mac 憑證 → 拿 `API_SECRET` 可 mint owner token（若該 owner 已有 Consent）。flag ON 時此路徑已不可達（走 mint→contained 或 fail-closed）。**不能盲修**：10-min cron + CF `/trigger` 都在此路徑跑 prod AI 聊天 pipeline，直接 `return false` 會停掉聊天。與 containment 就緒度耦合 → 併 activation 一起做：activation 應**原子化**（containment ready + Consent + flag 同時上），別留 Consent-first-flag-later 窗口；或改造 spawn 讓 service-token 路徑也能 contained。security-auditor v2.55.62 P1。

### 測試套件 — D1 建置成本迫使 unit 限流 2 worker（根本解：共用已 migrate 快照）

**Priority**: P3（開發體驗；不影響使用者）

v2.57.15 把 `npm test` 限成 `--maxWorkers=2`，因為每個 worker 都要各自建 Miniflare D1 並跑 90+ 個 migration，滿並行度下會有測試撞 timeout（實測預設並行度 1 failed，maxWorkers=2 全綠且**還略快** 289.87s vs 294.70s）。這是權宜：測試檔繼續長，2 worker 遲早也會撞牆，而現在整套要跑 ~290 秒。根本解是共用一份已 migrate 的 D1 快照（建一次、各 worker 複製），讓並行度重新可用。沒調高 `hookTimeout` —— 那等於把訊號關掉。
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

