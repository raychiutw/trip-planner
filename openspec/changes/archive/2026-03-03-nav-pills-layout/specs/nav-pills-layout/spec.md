## MODIFIED Requirements

### Requirement: sticky-nav 桌機三欄全寬

參考 `openspec/specs/desktop-layout/spec.md`（桌機漢堡選單修復、edit/setting 頁隱藏 sticky-nav）。

在三欄佈局（≥1200px）下，`.sticky-nav` SHALL 填滿 `#tripContent` 的完整寬度，不受 `--content-max-w`（800px）限制。

#### Scenario: ≥1200px sticky-nav 全寬

- **WHEN** 桌機視窗寬度 ≥ 1200px（三欄佈局啟用）
- **THEN** `.sticky-nav` SHALL 無 `max-width` 限制（`max-width: none`），與 `#tripContent` 等寬

#### Scenario: 768px～1199px sticky-nav 仍置中限寬

- **WHEN** 桌機視窗寬度介於 768px 與 1199px 之間
- **THEN** `.sticky-nav` SHALL 保持 `max-width: var(--content-max-w)` 並 `margin: 0 auto` 置中

---

### Requirement: Day pills 置中對齊

參考 `openspec/specs/nav-pills-overflow/spec.md`（溢出機制、箭頭顯示規則）。

`.dh-nav` 的 pills SHALL 水平置中排列。pills 總寬度未溢出時，pills 顯示於 nav 列中央；pills 溢出時，溢出捲動機制（`overflow-x: auto`）正常運作，不受 `justify-content: center` 影響。

#### Scenario: pills 未溢出時置中

- **WHEN** 行程天數較少，pills 總寬度未超出 `.dh-nav` 可見寬度
- **THEN** pills SHALL 水平置中顯示於 nav 列中央

#### Scenario: pills 溢出時仍可捲動

- **WHEN** 行程天數較多，pills 總寬度超出 `.dh-nav` 可見寬度
- **THEN** `.dh-nav` SHALL 仍可水平捲動，漸層遮罩與箭頭按鈕行為不變

---

### Requirement: Day 按鈕等寬

`.dn` 按鈕 SHALL 具備統一的最小寬度，確保天數標籤字元數不同（D1 vs D10 vs D13）時按鈕外觀一致。

#### Scenario: 單字元天數標籤

- **WHEN** 顯示 D1～D9 等單字元天數按鈕
- **THEN** 按鈕寬度 SHALL ≥ 40px，文字水平置中

#### Scenario: 雙字元天數標籤

- **WHEN** 顯示 D10 以上等雙字元天數按鈕
- **THEN** 按鈕寬度 SHALL ≥ 40px（由內容撐開或達到 min-width），視覺寬度與 D1～D9 相近

---

## ADDED Requirements

### Requirement: 箭頭按鈕獨立可點擊空間

參考 `openspec/specs/nav-pills-overflow/spec.md`（箭頭按鈕：到達邊界時 `visibility: hidden` 保留空間）。

`.dh-nav-arrow` 按鈕 SHALL 具備足夠的水平 padding 與最小寬度，確保箭頭與 pills 之間有明確視覺間距，且箭頭按鈕可點擊區域不被相鄰 pill 重疊。

#### Scenario: 多天行程右箭頭不重疊

- **WHEN** 行程天數 ≥ 13 天，pills 處於溢出狀態，右側尚有未顯示的 pills
- **THEN** 右箭頭按鈕 SHALL 與最後一顆可見 pill 之間保有視覺間距（箭頭 `padding` ≥ `0 8px`，`min-width` ≥ 28px）

#### Scenario: 箭頭 visibility hidden 時保留空間

- **WHEN** 捲動至左邊界（左箭頭隱藏）或右邊界（右箭頭隱藏）
- **THEN** 隱藏的箭頭 SHALL 以 `visibility: hidden` 保留佔位空間，nav 列寬度不跳動
