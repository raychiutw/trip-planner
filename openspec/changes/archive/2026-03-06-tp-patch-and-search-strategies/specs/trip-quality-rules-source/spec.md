## MODIFIED Requirements

### Requirement: 品質規則單一真相來源

`.claude/commands/trip-quality-rules.md` SHALL 包含所有行程品質規則的完整定義。所有行程操作 skill（tp-create、tp-rebuild、tp-rebuild-all、tp-edit、tp-issue、tp-check、**tp-patch**）SHALL 引用此檔案，不自行定義規則。

#### Scenario: 規則檔包含所有品質規則
- **WHEN** 讀取 `.claude/commands/trip-quality-rules.md`
- **THEN** SHALL 包含所有品質規則的完整定義（目前為 R1 至 R12，未來可擴充）

#### Scenario: 各 skill 引用規則檔
- **WHEN** tp-rebuild / tp-check / tp-edit / tp-issue / tp-rebuild-all / tp-create / tp-patch 參照品質規則
- **THEN** SHALL 以「遵守 `trip-quality-rules.md` 中定義的所有品質規則」引用，不內嵌規則定義，不寫死規則編號

#### Scenario: 新增規則時的擴充性
- **WHEN** 未來新增品質規則（如 R13、R14）
- **THEN** SHALL 只需在 `trip-quality-rules.md` 追加，CLAUDE.md / MEMORY.md / 各 skill 不需同步修改

## ADDED Requirements

### Requirement: R12 擴充至 hotel

R12（googleRating 品質規則）SHALL 擴充檢查 hotel 物件的 googleRating。

#### Scenario: hotel 必須有 googleRating
- **WHEN** 品質測試執行 R12 檢查
- **THEN** 每個 hotel 物件（除 `name === "家"` 外）SHALL 必須有 `googleRating` 欄位
- **AND** 值 SHALL 為 1.0–5.0 的數字

#### Scenario: home hotel 豁免
- **WHEN** hotel.name 為 "家"
- **THEN** SHALL 不檢查 googleRating

### Requirement: R3 加入 reservation 結構化 strict 檢查

R3（餐廳品質規則）SHALL 加入 reservation 結構化物件的 strict 檢查。

#### Scenario: reservation 必須是物件
- **WHEN** 品質測試執行 R3 檢查
- **THEN** 每個 restaurant 的 `reservation` SHALL 為物件（非字串）

#### Scenario: reservation.available 必須為合法值
- **WHEN** 檢查 reservation 物件
- **THEN** `available` SHALL 為 `"yes"` | `"no"` | `"unknown"` 三者之一

#### Scenario: available=yes 時 method 必填
- **WHEN** `reservation.available === "yes"`
- **THEN** `method` SHALL 為 `"website"` | `"phone"` 二者之一

#### Scenario: method=website 時 url 必填
- **WHEN** `reservation.method === "website"`
- **THEN** `url` SHALL 為合法 URL（以 `http://` 或 `https://` 開頭）

#### Scenario: method=phone 時 phone 必填
- **WHEN** `reservation.method === "phone"`
- **THEN** `phone` SHALL 為非空字串

#### Scenario: recommended 必須是 boolean
- **WHEN** 檢查 reservation 物件
- **THEN** `recommended` SHALL 為 `true` 或 `false`
