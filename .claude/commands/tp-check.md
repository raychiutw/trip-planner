對指定行程逐項檢查 R1-R13 品質規則，輸出紅綠燈驗證 report。只讀不改，不修改任何檔案。

⚡ 核心原則：不問問題，直接驗證。

## 輸入方式

- 指定 tripId：`/tp-check okinawa-trip-2026-Ray`
- 未指定：讀取 `data/dist/trips.json` 列出所有行程供選擇

## 步驟

1. 讀取 `data/trips-md/{tripId}/` 下的 MD 檔案（meta.md + day-N.md 等）
2. 逐項檢查 R1-R13 品質規則（定義在 `/tp-rebuild` 中）
3. 依檢查結果輸出 report（完整模式或精簡模式）

🚫 不修改任何檔案。tp-check 是純驗證工具。

## Report 模式

### 完整模式（standalone 或 before/after-fix）

```
══════════════════════════════════════════════
  tp-check Report: {tripId}
  {YYYY-MM-DD HH:mm:ss}
══════════════════════════════════════════════

  Summary:  🟢 N passed  🟡 N warnings  🔴 N failed

──────────────────────────────────────────────
  Rule          Status   Detail
──────────────────────────────────────────────
  R1  偏好       🟢
  R2  餐次       🟢
  R3  餐廳品質   🟡     Day 2 午餐只有 2 家推薦
  R4  景點品質   🟡     Day 3 美麗海水族館 缺 blogUrl
  R5  飯店品質   🟢
  R6  搜尋方式   🟢
  R7  購物       🟢
  R8  早餐       🟢
  R9  亮點精簡   🟢
  R10 加油站     🟢
  R11 地圖導航   🟡     12 個景點缺 location
  R12 評分       🔴     28 個地點缺 googleRating
  R13 來源標記   🟢
──────────────────────────────────────────────

  🟡 Warnings (N):
  ├── RX: {具體描述}
  └── RY: {具體描述}

  🔴 Failures (N):
  └── RZ: {具體描述}

══════════════════════════════════════════════
```

### 精簡模式（after-edit，嵌入其他 skill 尾部）

```
tp-check: 🟢 10  🟡 2  🔴 0
```

## 紅綠燈狀態定義

| 狀態 | 符號 | 判定條件 |
|------|------|----------|
| passed | 🟢 | 規則完全符合 |
| warning | 🟡 | 有瑕疵但屬 warn 級（R11 location 缺失、R12 googleRating 缺失等）或部分缺失 |
| failed | 🔴 | 不符合 strict 級規則 |

## 嵌入其他 skill 的方式

| Skill | 何時執行 tp-check | 模式 |
|-------|-------------------|------|
| `/tp-check` | 獨立執行 | 完整 |
| `/tp-rebuild` | 修正前 + 修正後 | 完整 x2 |
| `/tp-edit` | 修改完成後 | 精簡 |
| `/tp-request` | 每個 Issue 處理完後 | 精簡 |
| `/tp-deploy` | 不嵌入 | — |
| `/tp-rebuild-all` | 每趟修正後 | 完整 |

## 品質規則參照

完整 R1-R13 品質規則定義在 `/tp-rebuild` skill 中。
