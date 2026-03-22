## 1. Layer 1 — SKILL.md curl 寫入修正

- [x] 1.1 修改 `.claude/skills/tp-create/SKILL.md`：所有 curl -d 改為 writeFileSync + --data @file
- [x] 1.2 修改 `.claude/skills/tp-edit/SKILL.md`：同上
- [x] 1.3 修改 `.claude/skills/tp-rebuild/SKILL.md`：同上
- [x] 1.4 修改 `.claude/skills/tp-rebuild-all/SKILL.md`：無獨立 curl 寫入，僅依賴 tp-rebuild，無需修改
- [x] 1.5 修改 `.claude/skills/tp-patch/SKILL.md`：同上

## 2. Layer 2 — API middleware UTF-8 驗證

- [x] 2.1 在 `functions/api/_middleware.ts` 的 handleAuth 中，對 POST/PUT/PATCH 加入 TextDecoder({ fatal: true }) 驗證

## 3. Layer 3 — detectGarbledText 亂碼偵測

- [x] 3.1 在 `functions/api/_validate.ts` 新增 `detectGarbledText(text)` 函式
- [x] 3.2 在 `functions/api/trips/[id]/entries/[eid].ts` PATCH handler 對文字欄位呼叫 detectGarbledText
- [x] 3.3 在 `functions/api/trips/[id]/days/[num].ts` PUT handler 對 timeline 文字欄位呼叫 detectGarbledText

## 4. Layer 4 — Audit 亂碼標記

- [x] 4.1 在 `functions/api/_audit.ts` 的 logAudit 中，對 diffJson 做亂碼偵測並標記 _encoding_warning

## 5. 測試

- [x] 5.1 新增 `tests/unit/encoding-validation.test.ts` — 測試 detectGarbledText 各種 case
- [x] 5.2 執行 `npx tsc --noEmit` + `npm test` 確認全過
