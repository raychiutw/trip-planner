## Context

目前 `trips.json` registry 包含 `{ tripId, name, dates, owner }`，所有頁面直接全量顯示。資料流為 `meta.md` → `trip-build.js` → `meta.json` → `build.js` → `trips.json`。

## Goals / Non-Goals

**Goals:**
- meta.md 新增 `published` boolean，預設 `true`
- trips.json 帶入 `published` 欄位
- 各頁面依角色過濾行程顯示
- 下架行程被選中時，顯示提示並導到設定頁

**Non-Goals:**
- 不做 UI 上的上架/下架切換功能（直接改 meta.md）
- 不改變 D1 permissions 資料結構

## Decisions

### 1. flag 放在 meta.md YAML front matter

```yaml
published: true   # 或 false
```

**理由**：與其他 meta 欄位一致，build 時自然帶入。不需要額外設定檔。

### 2. trips.json 帶入 published 但不過濾

`build.js` 聚合時將 `published` 直接寫入 registry，不在 build 階段過濾。過濾邏輯留給各前端頁面。

**理由**：admin 頁需要看到全部行程，如果 build 就濾掉會丟失資料。

### 3. 下架行程的 localStorage 處理（方案 B）

`app.js` 載入時檢查 `trip-pref` 對應的行程是否 `published`：
- 是 → 正常載入
- 否 → 顯示 toast 提示「此行程已下架」→ 2 秒後導到 `setting.html`

### 4. 行程選單統一用 name 顯示

設定頁、manage、admin 的行程選擇下拉/清單，統一顯示 `trip.name`（如「Ray 的沖繩之旅」），取代目前的 tripId 或混合格式。

## Risks / Trade-offs

- **風險**：現有測試可能硬編碼 trips.json 結構 → 需更新 schema 測試加入 `published`
- **風險**：使用者書籤直接帶 tripId → 不影響，`published` 只影響列表選擇，直接 URL 存取不受限
- **取捨**：不在 build 階段過濾，registry 會稍大 → 7 個行程體量極小，無影響
