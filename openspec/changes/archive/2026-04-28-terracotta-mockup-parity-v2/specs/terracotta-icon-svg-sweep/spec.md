## ADDED Requirements

### Requirement: 所有 user-facing icon SHALL 用 inline SVG，不允許 emoji unicode

對應 mockup section 12 lead 明文要求 + CLAUDE.md「icon 用 inline SVG，不用 emoji 或 icon font」。本 capability 完成後，下列 component 的 emoji icon 全部替換為 `<Icon name="..." />`：

| Component | 既有 emoji | 對應 Icon name | mockup 來源 |
|---|---|---|---|
| `TimelineRail.tsx` `tp-rail-actions` 放大檢視 | `⛶` | `maximize` | mockup line 6075 `<svg><use href="#i-maximize"/>` |
| `TimelineRail.tsx` `tp-rail-actions` 複製到其他天 | `⎘` | `copy` | mockup line 6076 `#i-copy` |
| `TimelineRail.tsx` `tp-rail-actions` 移到其他天 | `⇅` | `arrows-vertical` | mockup line 6077 `#i-move-vertical` |
| `TimelineRail.tsx` `tp-rail-actions` 刪除景點 | `🗑` | `trash` | mockup line 6079 `#i-trash` |
| `TimelineRail.tsx` `tp-rail-actions` 收合 | `✕` | `x` 或 `close` | mockup line 6080 `#i-x` |
| `InlineAddPoi.tsx` search input prefix | `🔍` | `search` | mockup line 6457 `#i-search` |
| `ExplorePage.tsx` POI card「+ 儲存」prefix（暫無 emoji 但使用 `+`/`✓` text） | `✓ 已儲存` | `check` | mockup line 7314 `#i-heart` |

新 SVG sprite 補進 `src/components/shared/Icon.tsx` switch case：`trash` / `maximize` / `arrows-vertical` 三個（其他 `copy` / `x` / `search` / `check` 已存在）。

#### Scenario: TimelineRail 展開列工具列全部用 SVG icon
- **WHEN** 使用者展開任一 timeline entry
- **THEN** 「放大檢視 / 複製 / 移到其他天 / 刪除 / 收合」5 個 button 全部 render `<svg>` 元素
- **AND** 全部 button DOM 內無 emoji unicode（U+1F300 以上 / U+2700-U+27BF symbol 範圍）
- **AND** 既有 `data-testid` 不變（不破壞 unit test 跟 E2E 取 element）

#### Scenario: InlineAddPoi 搜尋欄 icon 用 SVG
- **WHEN** 使用者展開 day-level「+ 加景點」
- **THEN** search input 左側 icon render `<Icon name="search" />` SVG
- **AND** input DOM 內無 `🔍` emoji 字符

#### Scenario: ExplorePage 已儲存 button 文字 + icon 對齊
- **WHEN** 使用者在 explore 搜尋結果點「+ 儲存」後 button 變「已儲存」狀態
- **THEN** button label 含 `<Icon name="check" />` SVG icon，文案「已儲存」
- **AND** 不再使用 `✓` 字符 prefix

### Requirement: emoji-icon contract test 防 regression

新增 `tests/unit/no-emoji-icons.test.ts` source-grep test，掃描 `src/components/` + `src/pages/` 下所有 .tsx file，禁止以下 emoji unicode 出現在 JSX text node 範圍：

- `🗑` `🔍` `⛶` `⎘` `⇅` `❤` `🚗` `📋`（mockup 主要違規 emoji 列表）
- 例外白名單：`src/components/shared/Icon.tsx` 自身（icon catalog comment）、`tokens.css` placeholder content 內

#### Scenario: 未來 PR 引入 emoji icon 應該 CI 阻擋
- **WHEN** 開發者 PR 加入 `<button>🗑 刪除</button>` 之類 emoji-as-icon 程式碼
- **THEN** `npm test` 執行 `no-emoji-icons.test.ts` 失敗，列出違規 file:line
- **AND** CI gate 阻擋 PR merge
