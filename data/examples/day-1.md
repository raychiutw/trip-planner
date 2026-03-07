---
id: 1
date: 2026-07-01
dayOfWeek: 三
label: 目的地名稱
weather: {"label":"目的地","locations":[{"lat":26.33,"lon":127.78,"name":"那霸","start":0,"end":23}]}
---

## Hotel: 範例飯店名稱
- url: https://www.example-hotel.com/
- checkout: 11:00
- blog: https://example.com/hotel-review/
- source: ai
- details: 飯店位置描述, 特色設施, 含早餐
- breakfast: true 飯店早餐說明

<!-- shopping: 飯店附近購物 infoBox，每個 shop 必填 category/name/hours/mustBuy/blog -->
### shopping: 飯店附近購物

| name | category | hours | mustBuy | blog | rating | maps | mapcode | source |
|---|---|---|---|---|---|---|---|---|
| AEON 範例店 | 超市 | 食品區 ~24:00 | 限定商品1, 限定商品2, 推薦商品3 | https://example.com/aeon/ | 4 | イオン範例店 | 33 526 213*28 | ai |
| Lawson 範例店 | 超商 | 24 小時 | 限定冰淇淋, 便當, 零食 | https://example.com/lawson/ | 3.5 | ローソン範例店 | 33 526 450*63 | ai |

<!-- parking: 僅自駕行程（selfDrive: true）需要 -->
### parking: 停車場
- price: 500/晚
- maps: 範例停車場
- mapcode: 33 525 382*00

## Timeline

### 10:45 抵達機場
入境、領取行李
- maps: 那霸機場
<!-- mapcode: 僅沖繩行程需要 -->
- mapcode: 33 002 519*00
- rating: 3.9
- travel: train 單軌電車 約15分鐘

### 12:00 午餐
租車後用餐
- maps: 範例地點
- rating: 4.2
- travel: car 開車 約40分鐘

#### restaurants: 午餐推薦三選一

| name | category | hours | price | reservation | description | blog | rating | maps | mapcode | source |
|---|---|---|---|---|---|---|---|---|---|---|
| 範例拉麵店 | 拉麵 | 10:00~18:00 | 650~ | 不需訂位 | 人氣拉麵推薦 | https://example.com/ramen/ | 4.3 | 範例拉麵 | 33 496 097*82 | ai |
| 範例燒肉店 | 燒肉 | 11:00~23:00 | 2,980~/人 | EPARK 預約 | 燒肉吃到飽 | https://example.com/yakiniku/ | 4.1 | 範例燒肉 | 33 526 178*00 | ai |
| 範例當地美食 | 當地特色 | 11:00~21:00 | 500~ | 不需訂位 | 當地特色料理 | https://example.com/local/ | 4.1 | 範例當地 |  | ai |

### 14:00 景點名稱
景點描述，特色介紹
- web: https://www.example-attraction.com/
- blog: https://example.com/attraction-review/
- source: ai
- maps: 範例景點
- mapcode: 33 526 450*63
- rating: 4.2

<!-- shopping: 景點附近若有超市/唐吉軻德（步行 5~10 分），加 shopping infoBox -->
#### shopping: 景點附近購物

| name | category | hours | mustBuy | blog | rating | maps | mapcode | source |
|---|---|---|---|---|---|---|---|---|
| 唐吉訶德 範例店 | 唐吉軻德 | 24 小時 | 限定商品1, 限定商品2, 藥妝免稅 | https://example.com/donki/ | 4.1 | ドン・キホーテ 範例店 | 33 526 241*00 | ai |

### 18:00 晚餐
美食街或商圈用餐
- blog: https://example.com/dinner-area/
- source: ai
- maps: 範例商圈
- rating: 4.2

#### restaurants: 晚餐推薦三選一

| name | category | hours | price | reservation | description | blog | rating | maps | mapcode | source | reservationUrl |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 範例拉麵 | 拉麵 | 11:00~24:00 | 800~ | 不需訂位 | 人氣拉麵 | https://example.com/ramen2/ | 4.3 | 範例拉麵 | 33 526 312*00 | ai |  |
| 範例燒肉 | 燒肉 | 17:00~24:00 | 2,980~/人 | EPARK 預約 | 燒肉吃到飽 | https://example.com/yakiniku2/ | 4.1 | 範例燒肉 | 33 526 178*00 | ai | https://epark.jp/example/ |
| 範例牛排 | 當地特色 | 11:00~24:00 | 1,000~ | 不需訂位 | 當地人氣牛排 | https://example.com/steak/ | 4.2 | 範例牛排 | 33 526 450*63 | ai |  |
