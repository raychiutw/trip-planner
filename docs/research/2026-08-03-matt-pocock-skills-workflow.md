# Matt Pocock Skills 官方工程流程研究

調查日期：2026-08-03

## 研究範圍與版本

本文件只採用 `mattpocock/skills` 官方 GitHub repository 的 README、官方文件與 skill source，不引用部落格、第三方教學或 issue 討論。為避免 `main` 漂移，所有來源皆鎖定 commit [`2ab958093e83e0ec752e6c1c5932da465bf23e0c`](https://github.com/mattpocock/skills/tree/2ab958093e83e0ec752e6c1c5932da465bf23e0c)（2026-07-28）。

## 結論

官方文件常用以下五段作為主流程速記：

```text
grill-with-docs → to-spec → to-tickets → implement → code-review
```

來源：[官方 `grill-with-docs` 文件](https://github.com/mattpocock/skills/blob/2ab958093e83e0ec752e6c1c5932da465bf23e0c/docs/engineering/grill-with-docs.md#L42-L50)。

但實際路由不是每次都強制走完五段。官方的 map of record `ask-matt` 明確區分：

- 有 codebase 時由 `/grill-with-docs` 對齊；若有必須透過執行才答得出的設計問題，可先繞到 `/prototype`。
- **多 session 的建置**才走 `/to-spec → /to-tickets`，再讓每張 ticket 由全新 context 執行 `/implement`。
- **單一 session 可完成的小改動**可在同一 context 直接 `/implement`，不必為了儀式製造 spec 與 tickets。
- `/implement` 內部驅動 `/tdd`，完成後執行 `/code-review`，再 commit 到目前分支。
- `/grill-with-docs` 到 `/to-tickets` 應盡量保留在同一個未壓縮 context；每張 implementation ticket 則使用新的 context。

以上分支與 context 規則見 [`ask-matt` skill source](https://github.com/mattpocock/skills/blob/2ab958093e83e0ec752e6c1c5932da465bf23e0c/skills/engineering/ask-matt/SKILL.md#L13-L32)。另外，整套工程流程的前置條件是每個 repo 先執行一次 `/setup-matt-pocock-skills`，設定 issue tracker、triage labels 與 domain docs 位置；日常工作不需重跑 setup。[官方 setup 文件](https://github.com/mattpocock/skills/blob/2ab958093e83e0ec752e6c1c5932da465bf23e0c/docs/engineering/setup-matt-pocock-skills.md#L13-L33)

## 核心 skill 的責任邊界

| Skill | 應負責 | 不應負責／邊界 | 官方來源 |
| --- | --- | --- | --- |
| `/setup-matt-pocock-skills` | 一次性確認 tracker、label vocabulary 與 domain docs layout，寫入 `docs/agents/` 及既有的 `AGENTS.md` 或 `CLAUDE.md` 指標區塊 | 不是每次開工都跑的流程步驟；不應猜 repo 設定 | [setup 文件](https://github.com/mattpocock/skills/blob/2ab958093e83e0ec752e6c1c5932da465bf23e0c/docs/engineering/setup-matt-pocock-skills.md#L15-L43) |
| `/ask-matt` | 只判斷該走哪一條 flow、以何順序使用 skills | 不進行訪談、不寫 spec、不實作 | [`ask-matt` 文件](https://github.com/mattpocock/skills/blob/2ab958093e83e0ec752e6c1c5932da465bf23e0c/docs/engineering/ask-matt.md#L13-L27) |
| `/grill-with-docs` | 對模糊計畫逐題訪談；同步確立的詞彙到 `CONTEXT.md`，只在高門檻決策建立 ADR | 不寫 spec；能由 codebase 回答的問題不問使用者；可逆決策不製造 ADR | [官方文件](https://github.com/mattpocock/skills/blob/2ab958093e83e0ec752e6c1c5932da465bf23e0c/docs/engineering/grill-with-docs.md#L13-L33) |
| `/to-spec` | 從已對齊的 conversation 與 codebase 理解合成 spec，確認測試 seam 後發布到 tracker | 不重新訪談；不放容易過時的檔案路徑或 code snippet（prototype 決策片段例外） | [`to-spec` source](https://github.com/mattpocock/skills/blob/2ab958093e83e0ec752e6c1c5932da465bf23e0c/skills/engineering/to-spec/SKILL.md#L7-L19) |
| `/to-tickets` | 把已理解的 plan/spec 拆成可獨立驗證、單一 context 可完成的 tracer-bullet 垂直切片，標示 blocking edges 並發布 | 不把 schema、API、UI 拆成彼此無法獨立驗證的水平 tickets；不關閉或修改 parent issue | [`to-tickets` source](https://github.com/mattpocock/skills/blob/2ab958093e83e0ec752e6c1c5932da465bf23e0c/skills/engineering/to-tickets/SKILL.md#L25-L40), [發布規則](https://github.com/mattpocock/skills/blob/2ab958093e83e0ec752e6c1c5932da465bf23e0c/skills/engineering/to-tickets/SKILL.md#L58-L67) |
| `/implement` | 執行已定案的 spec/ticket；使用既定 seams，以 TDD、typecheck、單檔測試與最終 full suite 驗證；完成 review 後 commit | 不重新決定要做什麼，也不在實作途中自行發明測試 seam | [官方文件](https://github.com/mattpocock/skills/blob/2ab958093e83e0ec752e6c1c5932da465bf23e0c/docs/engineering/implement.md#L13-L29) |
| `/tdd` | 作為 `/implement` 內部引擎，依 red → green 逐一完成行為；也可在已明確的單一行為上獨立使用 | 不是主流程中位於 `/implement` 前的另一個交接站；不先批次寫完所有測試；只測公開 seam | [官方文件](https://github.com/mattpocock/skills/blob/2ab958093e83e0ec752e6c1c5932da465bf23e0c/docs/engineering/tdd.md#L13-L31), [流程定位](https://github.com/mattpocock/skills/blob/2ab958093e83e0ec752e6c1c5932da465bf23e0c/docs/engineering/tdd.md#L39-L47) |
| `/code-review` | 對固定比較點到 `HEAD` 的 diff，分開執行 Standards 與 Spec 兩軸 review | 不合併、重排兩軸結果；找不到 spec 時必須明說並跳過 Spec 軸，不得虛構需求 | [官方文件](https://github.com/mattpocock/skills/blob/2ab958093e83e0ec752e6c1c5932da465bf23e0c/docs/engineering/code-review.md#L13-L31) |

## 重要的支援與旁路 skills

| Skill | 正確定位 | 官方來源 |
| --- | --- | --- |
| `/diagnosing-bugs` | hard bug／效能回歸的獨立診斷流程；先建立已實際跑紅、快速且可重現的 feedback loop，才提出假設，最後留下 regression test | [官方文件](https://github.com/mattpocock/skills/blob/2ab958093e83e0ec752e6c1c5932da465bf23e0c/docs/engineering/diagnosing-bugs.md#L13-L40) |
| `/codebase-design` | deep module、interface、seam 等設計詞彙的 single source of truth；是語言，不是會自行重構或產生計畫的流程 | [官方文件](https://github.com/mattpocock/skills/blob/2ab958093e83e0ec752e6c1c5932da465bf23e0c/docs/engineering/codebase-design.md#L13-L23) |
| `/prototype` | 用 disposable code 回答一個 logic/state 或 UI 設計問題；答案進正式決策，prototype 留在不合併的 throwaway branch | [官方文件](https://github.com/mattpocock/skills/blob/2ab958093e83e0ec752e6c1c5932da465bf23e0c/docs/engineering/prototype.md#L13-L23), [保存方式](https://github.com/mattpocock/skills/blob/2ab958093e83e0ec752e6c1c5932da465bf23e0c/docs/engineering/prototype.md#L34-L42) |
| `/domain-modeling` | 維護 ubiquitous language；`CONTEXT.md` 只放 glossary，ADR 僅用於難以回復、缺少脈絡會令人意外、且有真實取捨的決策 | [官方文件](https://github.com/mattpocock/skills/blob/2ab958093e83e0ec752e6c1c5932da465bf23e0c/docs/engineering/domain-modeling.md#L13-L34) |
| `/triage` | 處理已進 tracker、不是目前對話新產生的原始 reports/requests；先驗證再建議狀態並等使用者指示 | [官方文件](https://github.com/mattpocock/skills/blob/2ab958093e83e0ec752e6c1c5932da465bf23e0c/docs/engineering/triage.md#L13-L23), [核准規則](https://github.com/mattpocock/skills/blob/2ab958093e83e0ec752e6c1c5932da465bf23e0c/docs/engineering/triage.md#L33-L42) |
| `/wayfinder` | 只用於大到超過單一 session、路線仍模糊的工作；產出並解決 decision tickets，不做 implementation，最後回到 `/to-spec` | [官方文件](https://github.com/mattpocock/skills/blob/2ab958093e83e0ec752e6c1c5932da465bf23e0c/docs/engineering/wayfinder.md#L13-L25), [交接定位](https://github.com/mattpocock/skills/blob/2ab958093e83e0ec752e6c1c5932da465bf23e0c/docs/engineering/wayfinder.md#L42-L44) |

## `/to-spec`：核准與發布規則

官方 source 的順序很精確：

1. 若尚未探索 codebase，先理解現況，沿用 domain glossary 並遵守相關 ADR。
2. 草擬測試 seams；優先既有 seam、選最高層級、數量越少越好，理想值是一個。
3. **向使用者確認 seams 是否符合期待。**
4. 確認後依 template 寫 spec，**直接發布到已設定的 issue tracker**，並套用 `ready-for-agent`；不需另跑 triage。

來源：[`to-spec` process](https://github.com/mattpocock/skills/blob/2ab958093e83e0ec752e6c1c5932da465bf23e0c/skills/engineering/to-spec/SKILL.md#L11-L19)。

因此，官方明文核准點是「測試 seams」。source **沒有要求 spec 內容寫完後再進行第二次核准才可發布**。若 repo 想增加 spec-body review，應明確標成 repo-local gate，不應描述成上游要求。

`to-spec` 產出的 spec 至少包含 Problem Statement、Solution、完整編號 User Stories、Implementation Decisions、Testing Decisions、Out of Scope 與 Further Notes；Implementation Decisions 禁止一般性的檔案路徑與 code snippets。[官方 template](https://github.com/mattpocock/skills/blob/2ab958093e83e0ec752e6c1c5932da465bf23e0c/skills/engineering/to-spec/SKILL.md#L21-L75)

## `/to-tickets`：核准與發布規則

`to-tickets` 的核准門檻比 `to-spec` 更明確：

1. 先提出編號拆票，逐張列出 title、blocked by 與可交付的 end-to-end behavior。
2. 詢問 granularity、blocking edges，以及是否應 merge 或 split。
3. **持續調整，直到使用者核准 breakdown。**
4. 只發布已核准的 tickets；在真實 tracker 上以 blockers-first 順序建立 issue，使用原生 blocking/sub-issue 關係（無原生能力才寫在 body），並加 `ready-for-agent`。
5. 不得關閉或修改 parent issue；實作只拿 blockers 已完成的 frontier ticket。

來源：[`to-tickets` quiz](https://github.com/mattpocock/skills/blob/2ab958093e83e0ec752e6c1c5932da465bf23e0c/skills/engineering/to-tickets/SKILL.md#L42-L60) 與 [publishing rules](https://github.com/mattpocock/skills/blob/2ab958093e83e0ec752e6c1c5932da465bf23e0c/skills/engineering/to-tickets/SKILL.md#L60-L67)。

換言之，核准 `/to-spec` 的測試 seams **不等於**核准之後尚未呈現的 ticket breakdown；拆票發布前仍需另一個明確核准點。

## 與本 repo `AGENTS.md`／`CLAUDE.md` 的差異觀察

以下只記錄差異，不修改 [`AGENTS.md`](../../AGENTS.md) 或 [`CLAUDE.md`](../../CLAUDE.md)：

1. `AGENTS.md` 把 `/qa → feature branch PR` 接在「Matt Pocock official chain」後方；官方速記鏈實際在 `/code-review` 結束。feature branch、PR 與額外 QA 可以保留成 Tripline 的本地規則，但不應標示為上游主鏈。[官方五段鏈](https://github.com/mattpocock/skills/blob/2ab958093e83e0ec752e6c1c5932da465bf23e0c/docs/engineering/code-review.md#L39-L47)
2. 官方 router 允許單一 session 可完成的小改動由 `/grill-with-docs` 直接進 `/implement`；`AGENTS.md` 目前仍要求小改動至少先有 spec。這是 repo 比上游更嚴格的本地 gate，不是官方預設。[官方條件分支](https://github.com/mattpocock/skills/blob/2ab958093e83e0ec752e6c1c5932da465bf23e0c/skills/engineering/ask-matt/SKILL.md#L22-L30)
3. `AGENTS.md` 的「spec 等待使用者核准」可能被解讀成 spec body 的第二次核准；上游 `to-spec` 只明文要求先確認 test seams，接著即寫入並發布。若保留第二次核准，應標示為本地規則。[`to-spec` source](https://github.com/mattpocock/skills/blob/2ab958093e83e0ec752e6c1c5932da465bf23e0c/skills/engineering/to-spec/SKILL.md#L15-L19)
4. `AGENTS.md` 路由到 `/design-an-interface`，但官方最新 repository 已將該 skill 放在 `skills/deprecated/`。[deprecated source](https://github.com/mattpocock/skills/blob/2ab958093e83e0ec752e6c1c5932da465bf23e0c/skills/deprecated/design-an-interface/SKILL.md#L1-L8) 現行替代能力已收進 `codebase-design` 的 `DESIGN-IT-TWICE.md`，仍可用多個設計方案作比較。[現行 pattern](https://github.com/mattpocock/skills/blob/2ab958093e83e0ec752e6c1c5932da465bf23e0c/skills/engineering/codebase-design/DESIGN-IT-TWICE.md#L1-L23)
5. `AGENTS.md` 路由到 `/qa`，但官方最新 repository 同樣將它放在 `skills/deprecated/`；因此它若繼續使用，應被視為 Tripline 保留的 legacy/local 流程，而非目前官方核心 skill。[deprecated `qa`](https://github.com/mattpocock/skills/blob/2ab958093e83e0ec752e6c1c5932da465bf23e0c/skills/deprecated/qa/SKILL.md#L1-L8)
6. `AGENTS.md` 已改為 Matt Pocock-first，`CLAUDE.md` 仍以 `/tp-team`、gstack-style plan/review/ship 流程為主；兩份文件的 hard rules 尚未同步，且會對同一個 code change 給出相反入口。
7. `AGENTS.md` 的 universal prototype-before-layout-change 是 Tripline 的本地 mockup gate。官方 `/prototype` 是「有一個必須看 runnable result 才能解決的設計問題」時才進入的旁路，而不是所有 layout change 的通用硬性步驟。[官方 router](https://github.com/mattpocock/skills/blob/2ab958093e83e0ec752e6c1c5932da465bf23e0c/skills/engineering/ask-matt/SKILL.md#L17-L24)
8. `AGENTS.md` 的 feature branch／GitHub PR 規則也是本地發布政策。官方 `/implement` 只要求完成 review 後 commit 到「目前分支」，沒有規定 branch 或 PR 策略。[`implement` source](https://github.com/mattpocock/skills/blob/2ab958093e83e0ec752e6c1c5932da465bf23e0c/skills/engineering/implement/SKILL.md#L7-L14)

## 對目前 `to-spec → to-tickets` 的直接判定

先前使用者已核准兩個 test seams，這已滿足官方 `/to-spec` 的唯一明文發布前確認點；可立即合成 spec、發布成 GitHub issue 並加 `ready-for-agent`。進入 `/to-tickets` 後，仍須先呈現 numbered breakdown 與 blocking edges，取得另一次核准，才可建立 tickets。
