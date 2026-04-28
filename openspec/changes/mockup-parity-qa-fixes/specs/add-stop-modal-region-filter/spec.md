## ADDED Requirements

### Requirement: AddStopModal 「搜尋」tab 內 MUST 顯示 region selector chip

AddStopModal 的「搜尋」tab body 上方 SHALL render region selector pill（`<button>` with text + chevron-down icon），text 預設「全部地區」，點擊 SHALL 開啟 dropdown 切換 region（hardcode 5 region：沖繩 / 東京 / 京都 / 首爾 / 台南 + 全部地區）。對應 mockup section 14 line 6452-6454 `tp-add-region-row` + `tp-add-region-label` 規範。

#### Scenario: Region selector 顯示在 search tab body

- **WHEN** 使用者開啟 AddStopModal「搜尋」tab
- **THEN** modal body 上方 SHALL 顯示 region pill（`.tp-add-stop-region-pill`），text 為 region 名稱 + chevron-down icon

#### Scenario: 切換 region 觸發 dropdown 關閉

- **WHEN** 使用者點 region pill 開 dropdown 並選任意 region
- **THEN** dropdown SHALL 關閉、pill text SHALL 更新

---

### Requirement: AddStopModal 「搜尋」tab 內 MUST 顯示 filter button

AddStopModal「搜尋」tab body 中 search input 旁（trailing position）SHALL render filter button（`<button>` with funnel icon + 「篩選」 text）。對應 mockup section 14 line 6460 `tp-add-filter-btn` 規範。

#### Scenario: Filter button render in search tab

- **WHEN** 使用者開啟 AddStopModal「搜尋」tab
- **THEN** search input row SHALL 包含 filter button：`.tp-add-stop-filter-btn` 帶 svg + 「篩選」 text

---

### Requirement: AddStopModal Day meta MUST 全大寫格式

AddStopModal title 旁邊的 day meta text SHALL 使用「DAY {NN} · {M}/{D}（{星期}）」全大寫 + 括號星期格式。對應 mockup section 14 line 6442「DAY 03 · 7/31（五）」規範。

#### Scenario: Day 1 meta 顯示為 DAY 01 全大寫

- **WHEN** 使用者在 Day 1 點「加景點」
- **THEN** modal header meta SHALL 顯示「DAY 01 · 7/29（三）」格式（不是「Day 1 · 2026-07-29」）

---

### Requirement: AddStopModal footer helper MUST 顯示已選與目標日資訊

AddStopModal footer 左側 helper text SHALL 顯示「已選 {N} 個 · 將加入 {dayLabel}」格式。`{N}` 為 0 時也仍顯示「已選 0 個 · 將加入 ...」（mockup section 14 line 6518 規範）。

#### Scenario: 0 個已選時 helper 仍顯示目標日

- **WHEN** 使用者剛開啟 AddStopModal 尚未選任何項目
- **THEN** footer helper text SHALL 為「已選 0 個 · 將加入 DAY 01 · 7/29（三）」（不可顯示「請先選擇」「從上方挑選」等）
