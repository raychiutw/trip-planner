## MODIFIED Requirements

### Requirement: 品質規則單一真相來源

`.claude/skills/tp-quality-rules/SKILL.md` SHALL 包含所有行程品質規則的完整定義（R0-R19）。所有行程操作 skill（tp-create、tp-rebuild、tp-edit、tp-check）SHALL 引用此檔案，不自行定義規則。

本次新增以下品質規則：
- **R19 每日首 timeline entry**：Day 1 首 entry 為抵達點，Day N（N ≥ 2）首 entry 為 Day N-1 住宿 POI 的 check-out entry；詳見 capability `daily-first-stop`
- 修訂 R2：早餐不強制；午餐 + 晚餐仍必填不變；早餐資訊由 `day.hotel.breakfast` 承載
- 修訂 R8：breakfast 欄位語意不變；明確「同飯店早餐 SHALL NOT 重複產生 timeline entry」

既有規則（維持）：
- Google Maps URL 格式 SHALL 為 `https://www.google.com/maps/search/<percent-encoded>`
- `location.name` SHALL 為必填，店名含分店名
- Hotel、restaurant、shop、event、parking SHALL 有 `note` 欄位（空值 `""`）
- Hotel、restaurant、shop、gasStation、event SHALL 有 `source` 欄位
- 最後一天 SHALL 不設 hotel
- R0 例外：`breakfast.included` SHALL 允許 `null`
- 所有 flights SHALL 有 `airline` 欄位

#### Scenario: 規則檔包含所有品質規則

- **WHEN** 讀取 `.claude/skills/tp-quality-rules/SKILL.md`
- **THEN** SHALL 包含所有品質規則（R0-R19）的完整定義，包括 R19 每日首 timeline entry 規則
- **AND** SHALL 明確指向 capability `daily-first-stop` 作為 R19 的 canonical spec

#### Scenario: 各 skill 引用規則檔

- **WHEN** tp-rebuild / tp-check / tp-edit / tp-create 參照品質規則
- **THEN** SHALL 以「遵守 `tp-quality-rules/SKILL.md` 中定義的所有品質規則」引用，不內嵌規則定義，不寫死規則編號

#### Scenario: 新增規則時的擴充性

- **WHEN** 未來新增品質規則
- **THEN** SHALL 只需在 `tp-quality-rules/SKILL.md` 追加，CLAUDE.md / MEMORY.md / 各 skill 不需同步修改

#### Scenario: R19 規則與 R0 Hotel 結構規則正交

- **WHEN** 驗證行程資料
- **THEN** R0「最後一天不設 hotel」SHALL 繼續成立（最後一天 `day.hotel` 為 undefined）
- **AND** R19「最後一天首 entry 為前日飯店 check-out」SHALL 同時成立（timeline[0] 指向前日 hotel POI）
- **AND** 兩條規則 SHALL 可同時通過，不衝突
