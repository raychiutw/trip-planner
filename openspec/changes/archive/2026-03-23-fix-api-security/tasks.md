## 1. restaurants POST 修正

- [x] 1.1 修正 `functions/api/trips/[id]/entries/[eid]/restaurants.ts` 的 sort_order 查詢：`WHERE parent_type = 'entry' AND parent_id = ?` → `WHERE entry_id = ?`
- [x] 1.2 修正 INSERT 語句：從 `parent_type, parent_id` 改為 `entry_id`，移除 `'entry'` 常量值

## 2. audit falsy coercion 修正

- [x] 2.1 修正 `functions/api/_audit.ts`：`opts.requestId || null` → `opts.requestId ?? null`，同理 diffJson、snapshot

## 3. 移除重複 hasPermission

- [x] 3.1 修正 `functions/api/requests.ts`：移除本地 `hasPermission` 定義，改用 `import { hasPermission } from './_auth'`

## 4. days PUT 原子化

- [x] 4.1 重構 `functions/api/trips/[id]/days/[num].ts` PUT handler：將刪除 + day 更新 + hotel/entries INSERT 合併為 Batch 1
- [x] 4.2 將 restaurants/shopping INSERT 合併為 Batch 2（使用 Batch 1 RETURNING 的 id）
- [x] 4.3 確保 snapshot audit log 在 batch 操作前寫入

## 5. 測試

- [x] 5.1 執行 `npx tsc --noEmit` 確認型別無誤
- [x] 5.2 執行 `npm test` 確認所有測試通過
