## MODIFIED Requirements

### Requirement: 品質規則單一真相來源

`.claude/commands/trip-quality-rules.md` SHALL 包含所有行程品質規則的完整定義。所有行程操作 skill（tp-create、tp-rebuild、tp-rebuild-all、tp-edit、tp-issue、tp-check）SHALL 引用此檔案，不自行定義規則。

品質規則 SHALL 包含以下國家感知規則：
- R1（必填欄位）：`meta.countries` SHALL 為必填欄位，值為非空的 ISO 3166-1 alpha-2 國碼字串陣列
- R3（URL 驗證）：新增 `naverQuery` 驗證 — 值 SHALL 以 `https://map.naver.com/` 開頭
- R3（mapcode 條件）：`mapcode` 僅在 `meta.countries` 含 `"JP"` 且 `meta.selfDrive` 為 `true` 的行程中為必填；其他行程不應有 mapcode
- 新增國家感知規則：當 `meta.countries` 含 `"KR"` 時，所有 POI 的 location SHALL 包含 `naverQuery` 欄位

#### Scenario: 規則檔包含所有品質規則
- **WHEN** 讀取 `.claude/commands/trip-quality-rules.md`
- **THEN** SHALL 包含所有品質規則的完整定義，含 `meta.countries` 必填、`naverQuery` URL 驗證、`mapcode` 國家條件、KR 行程 naverQuery 必填

#### Scenario: 各 skill 引用規則檔
- **WHEN** tp-rebuild / tp-check / tp-edit / tp-issue / tp-rebuild-all / tp-create 參照品質規則
- **THEN** SHALL 以「遵守 `trip-quality-rules.md` 中定義的所有品質規則」引用，不內嵌規則定義，不寫死規則編號

#### Scenario: 新增規則時的擴充性
- **WHEN** 未來新增品質規則（如 R13、R14）
- **THEN** SHALL 只需在 `trip-quality-rules.md` 追加，CLAUDE.md / MEMORY.md / 各 skill 不需同步修改

#### Scenario: tp-create 韓國行程搜尋 naverQuery
- **WHEN** tp-create 建立韓國行程
- **THEN** Phase 2 agent SHALL 搜尋並填入每個 POI 的 `naverQuery`（優先精確 place URL）

#### Scenario: tp-create 非韓國行程不填 naverQuery
- **WHEN** tp-create 建立日本或台灣行程
- **THEN** SHALL 不填入 `naverQuery` 欄位
