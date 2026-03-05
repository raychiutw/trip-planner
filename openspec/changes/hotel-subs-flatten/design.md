## 設計決策

### D1：停車場條目從 hotel.subs[] 移至 hotel.infoBoxes[]

**決策**：將所有 `hotel.subs[]` 中的 parking 條目，原封不動搬入同一飯店的 `hotel.infoBoxes[]` 陣列。

**理由**：物件形狀完全相同（`type`、`title`、`price`、`note`、`location`），無需資料轉換，只是改換容器。遷移後 infoBoxes 成為飯店所有補充資訊的唯一入口，渲染邏輯統一由 `renderInfoBox` 處理。

**替代方案排除**：考慮過新建一個 `parking` 頂層欄位，但這與既有 infoBoxes 模型不一致，會引入新的平行路徑。

---

### D2：parking infoBox case 加入 note 渲染

**決策**：在 `renderInfoBox case 'parking'`（`js/app.js` 第 127 行之後）加入：

```js
if (box.note) html += '（' + escHtml(box.note) + '）';
```

**理由**：subs 迴圈已支援 `note`（第 273 行）。遷移至 infoBoxes 後若不補這一行，現有 note 資料會靜默丟失。插入位置在 `price` 之後、`location` 之前，符合「費用說明 → 附注 → 地圖連結」的視覺順序。

---

### D3：移除 renderHotel 的 subs 迴圈

**決策**：完整刪除 `js/app.js` 第 268–276 行的 `if (hotel.subs && hotel.subs.length)` 區塊。

**理由**：資料遷移完成後，任何行程 JSON 都不再含有 `hotel.subs`，保留此迴圈只會增加死碼。渲染輸出由 infoBoxes 迴圈（已在第 278 行）負責，行為完全等價。

---

### D4：schema.test.js 同步更新

**決策**：
1. 移除所有對 `hotel.subs` 存在性與結構的驗證（選填欄位列舉中的 `subs`）。
2. 在 parking infoBox 驗證中，新增 `note`（選填字串）的測試案例。

**理由**：測試應反映實際允許的 schema。保留 subs 驗證會讓已遷移的 JSON 通過測試但讓未來開發者誤以為 subs 仍是有效欄位；移除後若有人誤加 subs，測試不會正向驗證它（JSON 本身不會因多餘欄位報錯，但 schema.test 的選填欄位清單不含 subs，可作為文件化佐證）。
