---
id: 2
date: 2026-07-02
dayOfWeek: 四
label: 景點區域名稱
weather: {"label":"景點區域","locations":[{"lat":26.65,"lon":127.87,"name":"景點區","start":0,"end":23}]}
---

## Hotel: 範例飯店二
- checkout: 10:00
- source: ai
- details: 飯店位置, 天然溫泉, 免費停車, 含免費早餐
- breakfast: true
- note: 飯店特色或入住提醒

### shopping: 飯店附近購物

| name | category | hours | mustBuy | rating | maps | mapcode | source |
|---|---|---|---|---|---|---|---|
| 範例超市 | 超市 | ~24:00 | 限定商品1, 限定商品2, 當地特產 | 4 | 範例超市 | 206 598 600*00 | ai |

### parking: 停車場
- price: 免費
- maps: 範例飯店二 駐車場
- mapcode: 206 598 283*00

## Timeline

### 09:00 出發
- travel: car 約50分鐘

### 10:00-12:00 主要景點
世界級景點描述，必看亮點介紹
- source: ai
- maps: 範例主要景點
- mapcode: 553 075 797*00
- rating: 4.6
- note: 建議提早到避開人潮

#### reservation: 景點資訊
- 門票：大人 2,180 / 高中生 1,440
- 營業時間：08:30~18:30
- 建議：提早抵達避開人潮

### 12:00-13:30 午餐
景點附近用餐
- maps: 範例午餐區
- rating: 4.1
- note:
- travel: car 約15分鐘

#### restaurants: 午餐推薦三選一

| name | category | hours | price | reservation | description | rating | maps | mapcode | source | reservationUrl |
|---|---|---|---|---|---|---|---|---|---|---|
| 範例麵店 | 拉麵 | 11:00~17:00 | 600~ | 不需訂位 | 百年老店沖繩麵 | 4.1 | 範例麵店 | 206 857 712*00 | ai |  |
| 範例燒肉 | 燒肉 | 11:30~22:00 | 1,500~ | TableCheck 預約 | 品牌牛直營燒肉 | 4.3 | 範例燒肉 | 206 795 582*00 | ai | https://www.tablecheck.com/example/ |
| 範例食堂 | 當地特色 | 11:00~15:30 | 1,000~ | 不需訂位 | 漁港直營新鮮海鮮 | 4 | 範例食堂 | 206 857 471*00 | ai |  |

### 14:00-16:00 戶外景點
自然風景描述
- maps: 範例戶外景點
- mapcode: 206 822 241*00
- rating: 4.3
- note: 自然風景實用提示
- travel: car 約25分鐘

<!-- parking: 有停車費用的景點加 parking infoBox -->
#### parking: 停車場
- price: 1,000/次
- maps: 範例景點 駐車場
- mapcode: 206 822 264*00

### 16:30 親子/室內景點
免費景點或室內設施描述
- maps: 範例室內景點
- mapcode: 206 628 711*00
- rating: 4.1
- note:
- travel: car 約5分鐘

#### reservation: 景點資訊
- 門票：免費
- 開放時間：09:00~17:30
- 注意事項：穿著建議等

### 18:00 晚餐
市區覓食
- source: ai
- maps: 範例市區
- rating: 4
- note:

#### restaurants: 晚餐推薦三選一

| name | category | hours | price | reservation | description | rating | maps | mapcode | source | reservationUrl |
|---|---|---|---|---|---|---|---|---|---|---|
| 範例拉麵 | 拉麵 | 11:30~22:00 | 800~ | 不需訂位 | 當地人氣拉麵 | 4.2 | 範例拉麵 | 206 688 326*00 | ai |  |
| 範例豬肉料理 | 燒肉 | 17:30~22:30 | 2,000~ | HotPepper 預約 | 品牌豬燒肉 | 4.1 | 範例豬肉料理 | 206 688 450*00 | ai | https://www.hotpepper.jp/example/ |
| 範例老店 | 當地特色 | 11:00~21:00 | 2,700~ | 不需訂位 | 創業老牌名店 | 4.2 | 範例老店 | 206 717 028*00 | ai |  |