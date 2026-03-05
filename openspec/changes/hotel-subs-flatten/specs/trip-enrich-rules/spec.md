## MODIFIED Requirements

### Requirement: R7 購物景點推薦

飯店附近有超市、唐吉軻德、超商等購物點時，SHALL 以 `infoBox type=shopping` 結構化顯示。飯店 subs 中的購物文字 SHALL 搬到 shopping infoBox，**停車場資訊 SHALL 改以 `parking` infoBox 寫入 `hotel.infoBoxes[]`，不再使用 `hotel.subs[]`**。獨立購物行程（來客夢/iias/Outlet/PARCO CITY/購物商圈）同樣 SHALL 附 shopping infoBox。景點附近步行 5~10 分鐘內有超市或唐吉軻德時，SHALL 在該景點 timeline entry 加 shopping infoBox。每個購物景點 SHALL 包含 `mustBuy` 必買推薦。渲染 SHALL 復用既有 `.restaurant-choice` CSS，不新增 CSS。所有 shop item 不含 `titleUrl`。不再使用 `souvenir` infoBox type，統一為 `shopping`。

#### Scenario: 自駕飯店停車場

- **WHEN** 行程為自駕且飯店有停車場
- **THEN** 飯店的 `hotel.infoBoxes[]` SHALL 包含 `type: "parking"` 的 infoBox，含停車場資訊（費用 + 地點）
- **AND** 若有附加說明，SHALL 寫入 `note` 欄位
- **AND** `hotel.subs[]` SHALL 不再用於存放停車場資訊
