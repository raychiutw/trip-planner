# PATCH /pois/:id 權限放寬 + tp-request 補 POI 資料

## 問題

旅伴透過 tp-request 要求「補座標」等 POI 資料時，因 companion scope 白名單不含 `PATCH /pois/:id`，且該 endpoint 限 admin-only，導致 skill 無法補既有 POI 的 lat/lng/address 等欄位，只能回覆「請行程主人處理」。

### 根本原因

- `PATCH /pois/:id` 設有 `isAdmin` 硬檢查
- Middleware companion 白名單未包含此 endpoint
- tp-request skill 禁止清單列有 `PATCH /api/pois/:id`

### 影響範圍

pois master 的 16 個欄位（lat, lng, address, phone, hours, google_rating, maps, mapcode, name, description, note, category, website, email, country, source）全數無法由 tp-request 更新。

## 設計

### 1. API 層：`functions/api/pois/[id].ts`

**現狀**：`isAdmin` 硬檢查（第 20 行）

**改為**：

- 要求 request body 帶 `tripId` 欄位
- 用 `hasPermission(db, auth.email, tripId, auth.isAdmin)` 做權限檢查
- 驗證該 POI 確實關聯到該 tripId（查 `trip_pois` 表確認 `poi_id + trip_id` 存在），防止傳假 tripId 繞過權限
- admin 仍可不帶 tripId（向下相容現有 tp-patch/tp-rebuild 呼叫）
- audit_log 的 tripId 改為實際帶入的 tripId（非 admin 時），admin 不帶 tripId 時維持 `'global'`

```typescript
// 虛擬碼
const body = await parseJsonBody(request);
const { tripId, ...fields } = body;

if (!auth.isAdmin) {
  if (!tripId) throw new AppError('DATA_VALIDATION', '非 admin 必須提供 tripId');
  if (!await hasPermission(db, auth.email, tripId, false)) throw new AppError('PERM_DENIED');
  // 驗證 POI 屬於該 trip
  const link = await db.prepare(
    'SELECT 1 FROM trip_pois WHERE poi_id = ? AND trip_id = ?'
  ).bind(poiId, tripId).first();
  if (!link) throw new AppError('PERM_DENIED', '此 POI 不屬於該行程');
}
```

### 2. Middleware：`functions/api/_middleware.ts`

在 `COMPANION_ALLOWED` 陣列加入：

```typescript
{ method: 'PATCH', pattern: /^\/api\/pois\/\d+$/ },
```

### 3. tp-request skill：`.claude/skills/tp-request/SKILL.md`

#### 白名單加入

```
- PATCH /api/pois/:id — 修改 POI master（必須帶 tripId）
```

#### 禁止清單移除

```
- PATCH /api/pois/:id（從禁止清單移除）
```

#### 修改流程更新

旅伴要求補 POI 資料（座標、地址、營業時間、評分等）時：

1. 讀取行程資料，找出缺欄位的 POI
2. **AI 上網查詢**取得正確資料
3. 用 `PATCH /api/pois/:id` 帶 `tripId` + 查詢結果更新 pois master
4. 回覆旅伴已補齊的項目

#### 安全規則

- PATCH pois 時**必須用 AI 查詢結果**，不能直接用使用者 message 內容當欄位值
- 所有 PATCH /pois 呼叫仍須帶 `X-Request-Scope: companion` header

### 4. 測試覆蓋

| Case | 預期 |
|------|------|
| 帶 tripId + 有權限 + POI 屬於該 trip | 200 OK |
| 帶 tripId + 無權限 | 403 PERM_DENIED |
| 帶 tripId + POI 不屬於該 trip | 403 PERM_DENIED |
| 不帶 tripId + 非 admin | 400 DATA_VALIDATION |
| 不帶 tripId + admin | 200 OK（向下相容） |
| companion scope + PATCH /pois/:id | 放行 |

## 不改的部分

- `PATCH /pois/:id` 的 `ALLOWED_FIELDS` 不變（16 個欄位都保留）
- `findOrCreatePoi` 邏輯不變
- 其他 admin-only endpoint（permissions, audit, rollback）不變
