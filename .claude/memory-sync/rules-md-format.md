# 行程 MD 檔案格式

## 檔案結構

每個行程 `data/trips-md/{slug}/` 包含：

```
meta.md          ← frontmatter（名稱、設定）+ Footer
day-1.md ~ N.md  ← 每日行程（Hotel + Timeline）
flights.md       ← 航班資訊（選填）
checklist.md     ← 出發前確認事項
backup.md        ← 雨天/颱風備案
suggestions.md   ← AI 行程建議
emergency.md     ← 緊急聯絡資訊（選填）
```

## meta.md frontmatter

```yaml
name: Ray 的沖繩之旅
owner: Ray
title: 2026 沖繩五日自駕遊行程表
description: SEO 描述
ogDescription: OG 描述
foodPreferences: 拉麵, 燒肉, 當地特色
selfDrive: true          # true=自駕, false=大眾運輸
countries: JP            # ISO 3166-1 alpha-2，韓國 KR 需加 naverQuery
autoScrollDates: 2026-07-29, 2026-07-30, ...
```

## day-*.md frontmatter

```yaml
id: 1
date: 2026-07-29
dayOfWeek: 三
label: 北谷          # ≤ 8 字
weather: {"label":"北谷","locations":[{"lat":26.33,"lon":127.78,"name":"北谷","start":0,"end":23}]}
```

## Hotel 區段

```markdown
## Hotel: 飯店名稱
- checkout: 11:00
- source: ai
- details: 描述1, 描述2
- breakfast: true 早餐說明
- note: 備註

### shopping: 飯店附近購物
| name | category | hours | mustBuy | rating | maps | mapcode | source |

### parking: 停車場
- price: 500/晚
- maps: 停車場名
- mapcode: 33 525 382*00
```

## Timeline 區段

```markdown
## Timeline

### 10:45 景點名稱
描述文字
- source: ai
- maps: 景點名稱         ← Google Maps 搜尋詞
- mapcode: 33 002 519*00  ← 自駕用（沖繩行程）
- rating: 4.2             ← Google 評分
- note: 備註
- travel: car 開車 約40分鐘

#### restaurants: 午餐推薦三選一
| name | category | hours | price | reservation | description | rating | maps | mapcode | source | reservationUrl |

#### shopping: 附近購物
| name | category | hours | mustBuy | rating | maps | mapcode | source |
```

## 特殊欄位

- `maps`：Google Maps 搜尋詞（build 時自動產生 googleQuery/appleQuery URL）
- `rating`：Google 評分（數字），build 時轉為 `googleRating`
- `source`：`ai`（AI 推薦）或 `user`（使用者指定）
- `travel`：格式 `{type} {描述}`，build 時拆為 `transit.type` + `transit.text`
- 韓國行程（`countries: KR`）需加 `naverQuery` 欄位供 Naver Map 連結

## trips.json（build 自動產生）

```json
[{ "tripId": "okinawa-trip-2026-Ray", "name": "Ray 的沖繩之旅", "dates": "7/29（三）~ 8/2（日）", "owner": "Ray" }]
```

## 注意事項

- `data/dist/` 由 build 產生，嚴禁手動編輯
- 異動 MD 格式時須同步更新 `data/examples/*.md`
- tp-create 三階段：Phase 1 讀 examples 產骨架 → Phase 2 並行搜尋充填 → Phase 3 驗證
- tp-create 易遺漏 `hotel.checkout`
