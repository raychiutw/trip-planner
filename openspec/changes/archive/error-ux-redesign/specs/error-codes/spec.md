## error-codes

### Requirements
1. `src/types/api.ts` export ErrorCode enum（16 個代碼，5 類前綴）
2. `functions/api/_errors.ts` export AppError class（extends Error，含 code/message/status/detail）
3. `functions/api/_errors.ts` export ERROR_MAP（code → {message, status}）
4. `_middleware.ts` catch block：instanceof AppError → errorResponse；否則 SYS_INTERNAL + Sentry
5. 所有 ~20 個 API 端點改用 `throw new AppError('CODE')`，移除直接 `json({error: "..."}, 4xx)`
6. API response 格式統一為 `{error: {code, message, detail?}}`
7. 向下相容：前端 sniff `typeof body.error === 'string'` fallback SYS_INTERNAL

### Acceptance Criteria
- `npx tsc --noEmit` 零錯誤
- 所有現有測試通過
- API 端點不再有任何英文錯誤訊息
- ErrorCode enum 被前後端同時 import
