## ADDED Requirements

### Requirement: SKILL curl 寫入使用 writeFileSync + @file
所有涉及中文內容的 curl 寫入操作 SHALL 使用 `node writeFileSync` 寫暫存 JSON 檔 + `curl --data @file` 模式，禁止 `curl -d '{中文}'` inline。

#### Scenario: tp-create 建立行程
- **WHEN** tp-create 用 curl 呼叫 PUT /api/trips/:id
- **THEN** SHALL 先用 `node -e writeFileSync('/tmp/...json', ..., 'utf8')` 寫暫存檔
- **THEN** SHALL 用 `curl --data @/tmp/...json` 送出

#### Scenario: tp-edit PATCH entry
- **WHEN** tp-edit 用 curl 呼叫 PATCH /api/trips/:id/entries/:eid
- **THEN** SHALL 使用相同的 writeFileSync + @file 模式

#### Scenario: tp-rebuild 修復欄位
- **WHEN** tp-rebuild 用 curl 修復 note/label 等中文欄位
- **THEN** SHALL 使用相同的 writeFileSync + @file 模式

### Requirement: API middleware UTF-8 body 驗證
API middleware SHALL 對 POST/PUT/PATCH 的 request body 做 UTF-8 合法性檢查。

#### Scenario: 收到非 UTF-8 body
- **WHEN** mutating request 的 body bytes 不是合法 UTF-8
- **THEN** API SHALL 回傳 400 `{ error: "Request body is not valid UTF-8" }`

#### Scenario: 收到合法 UTF-8 body
- **WHEN** mutating request 的 body 是合法 UTF-8
- **THEN** SHALL 正常處理不受影響

### Requirement: detectGarbledText 亂碼偵測
`_validate.ts` SHALL 提供 `detectGarbledText(text)` 函式，偵測疑似亂碼的字串。

#### Scenario: 偵測 U+FFFD
- **WHEN** 文字包含 U+FFFD replacement character
- **THEN** SHALL 回傳 true

#### Scenario: 偵測連續 Latin Extended
- **WHEN** 文字包含 3 個以上連續的 U+0080-U+00FF 字元
- **THEN** SHALL 回傳 true

#### Scenario: 正常中文不誤判
- **WHEN** 文字為「約15分鐘」
- **THEN** SHALL 回傳 false

### Requirement: 寫入前亂碼攔截
entries PATCH 和 days PUT handler SHALL 在寫入 D1 前對文字欄位呼叫 `detectGarbledText()`。

#### Scenario: PATCH entry 含亂碼 travel_desc
- **WHEN** PATCH body 的 travel_desc 被偵測為亂碼
- **THEN** API SHALL 回傳 400 `{ error: "欄位 travel_desc 包含疑似亂碼，請確認 encoding 為 UTF-8" }`

### Requirement: Audit 亂碼標記
`logAudit` 函式 SHALL 在 diffJson 包含亂碼特徵時標記警告。

#### Scenario: diff 含亂碼
- **WHEN** logAudit 的 diffJson 被 detectGarbledText 偵測為含亂碼
- **THEN** 寫入 audit_log 的 diff_json SHALL 包含 `"_encoding_warning": true`
