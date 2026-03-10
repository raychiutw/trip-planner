跨行程局部欄位更新工具。針對特定 target + field 批次掃描並搜尋補齊。

## 指令格式

```
/tp-patch --target <target> --field <field> [--trips <tripId,...>]
```

- `--target`（必填）：`hotel` | `restaurant` | `shop` | `event` | `gasStation`
- `--field`（必填）：`googleRating` | `reservation` | `location` 或其他合法欄位
- `--trips`（選填）：逗號分隔的行程 tripId，預設為所有行程

未提供必填參數時顯示使用說明，不執行操作。

## 步驟

### Phase 1：掃描

1. 讀取目標行程 MD 檔案（`data/trips-md/{tripId}/`，`--trips` 指定或全部）
2. 遍歷所有 day-N.md，依 `--target` 定位物件：
   - `hotel` → Hotel section（跳過 name 為「家」或以「（」開頭的）
   - `restaurant` → restaurants infoBox table 內的每個 restaurant
   - `shop` → shopping infoBox table 內的每個 shop
   - `event` → timeline event（跳過有 travel 的和「餐廳未定」）
   - `gasStation` → gasStation infoBox
3. 檢查每個物件的 `--field` 是否需要更新：
   - `googleRating`：缺少或非 number → 需更新
   - `reservation`：非 object 或 `available === "unknown"` → 需更新
   - 其他欄位：依實際需求判斷
4. 輸出掃描摘要：「共 N 行程、M 個 {target} 需更新 {field}」+ 每行程明細

### Phase 2：並行搜尋

5. 讀取 `search-strategies.md` 中對應 `--field` 的搜尋策略
6. 為每個行程啟動一個 Agent（sonnet），並行搜尋：
   - Agent prompt 包含該行程需更新的物件清單 + search-strategies.md 的搜尋方式
   - **依 R13 先驗證 POI 存在性**，搜不到時回報「POI 不存在：{名稱}」，不設 unknown、不繼續搜尋
   - Agent 不直接改檔案，只回傳 patch 結果（物件路徑 + 新值）
7. 收集所有 Agent 回傳的 patch 結果

### Phase 3：合併與驗證

8. 合併 patch 寫回行程 MD 檔案：
   - 只修改目標欄位，其他欄位完全不動
   - 找不到的值不填預設（googleRating 省略、reservation 維持 unknown）
9. 執行 `npm run build` 更新 dist
10. `git diff --name-only` 確認只有 `data/trips-md/**` + `data/dist/**` 被修改
11. `npm test`
12. 對每個修改的行程執行 tp-check 精簡模式
13. 不自動 commit（由使用者決定）

## 搜尋策略

完整搜尋策略定義在 `search-strategies.md`。Agent 搜尋時依該文件的搜尋流程、關鍵字模板、驗證規則執行。

## 範例

```bash
# 為所有行程的 hotel 補上 googleRating
/tp-patch --target hotel --field googleRating

# 為指定行程的餐廳補上 reservation 結構化資訊
/tp-patch --target restaurant --field reservation --trips okinawa-trip-2026-Ray

# 為指定行程的景點補上 location
/tp-patch --target event --field location --trips okinawa-trip-2026-Ray
```

僅允許編輯：
  data/trips-md/**

以下為 build 產物，由 npm run build 自動產生，嚴禁手動編輯：
  data/dist/**
