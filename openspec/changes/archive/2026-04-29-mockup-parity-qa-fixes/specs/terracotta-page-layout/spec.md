## ADDED Requirements

### Requirement: TitleBar title font-size MUST 對齊 mockup 規範

`.tp-titlebar-title` element SHALL 在 desktop（≥1024px）使用 `font-size: 20px / line-height: 28px / font-weight: 700`，在 compact（<760px）使用 `font-size: 18px / line-height: 24px / font-weight: 700`。對應 mockup `terracotta-preview-v2.html` line 4060-4070（desktop）+ 4088-4090（compact）的 `.tp-page-titlebar-title` 規範。

#### Scenario: Desktop titlebar 字級對齊

- **WHEN** 使用者在 1280×900 viewport 開啟任何主功能頁
- **THEN** `.tp-titlebar-title` `font-size` SHALL 為 `'20px'`、`fontWeight` SHALL 為 `'700'`

#### Scenario: Compact titlebar 字級對齊

- **WHEN** 使用者在 390×844 viewport 開啟任何主功能頁
- **THEN** `.tp-titlebar-title` `font-size` SHALL 為 `'18px'`

---

### Requirement: Day hero title font-size MUST 對齊 mockup 規範

`.ocean-hero-title` element SHALL 在 desktop（≥961px）使用 `font-size: 28px`，在 tablet/mobile（<961px）使用 `font-size: 24px`。對應 mockup line 1869-1878 `.tp-detail-hero-title` 規範。

#### Scenario: Desktop day hero 字級對齊

- **WHEN** 使用者在 1280 viewport 開啟 `/trip/:id`
- **THEN** `.ocean-hero-title` `font-size` SHALL 為 `'28px'`

---

### Requirement: TripList card eyebrow / title 字級 MUST 對齊 mockup

`.tp-trip-card-eyebrow` SHALL 使用 `font-size: 10px / letter-spacing: 0.12em / font-weight: 700 / text-transform: uppercase`。`.tp-trip-card-title` SHALL 使用 `font-size: 16px / font-weight: 700 / line-height: 1.35` + 2-line clamp。對應 mockup line 3781-3801 `.tp-list-card-eyebrow` / `.tp-list-card-title` 規範。

#### Scenario: Eyebrow 字級對齊

- **WHEN** 使用者在 `/trips` inspect 任意 trip card eyebrow
- **THEN** `font-size` SHALL 為 `'10px'`、`letterSpacing` SHALL 解析為 `0.12em` (`1.2px`)

#### Scenario: Card title 字級對齊

- **WHEN** 使用者 inspect 任意 trip card title
- **THEN** `font-size` SHALL 為 `'16px'`、`lineHeight` SHALL 為 `'21.6px'` (1.35 × 16)

---

### Requirement: NewTripModal title font-weight MUST 為 700

NewTripModal `<h2>新增行程</h2>` SHALL 使用 `font-weight: 700`（曾為 800，2026-04 對齊 mockup spec 降一級）。

#### Scenario: NewTripModal title font-weight 700

- **WHEN** 使用者開啟 NewTripModal
- **THEN** `getComputedStyle(document.querySelector('#new-trip-title')).fontWeight` SHALL 為 `'700'`

---

### Requirement: TripList card meta MUST 含出發日

TripList trip card body 區 MUST 顯示 trip 的出發日「{M}/{D} 出發」格式（mockup section 16:6906-6909）。

#### Scenario: Card meta 含出發日

- **WHEN** trip startDate 為 `2026-07-02`
- **THEN** `.tp-trip-card-meta` 區 SHALL 顯示「7/2 出發」字串

---

### Requirement: TripList filter tabs MUST 含「已歸檔」

`/trips` page filter tab strip SHALL 包含 4 顆 tab：「全部 / 我的 / 共編 / 已歸檔」（mockup section 16 line 6890-6894 規範）。「已歸檔」tab 點選 SHALL filter 顯示 `archivedAt !== null` 的 trips；無資料時顯示 empty state「目前沒有已歸檔行程」+「回到全部」 reset button。

#### Scenario: Filter tabs render 4 顆

- **WHEN** 使用者開啟 `/trips`
- **THEN** filter tab region SHALL 包含 4 顆 tab：「全部」「我的」「共編」「已歸檔」

#### Scenario: 已歸檔 tab empty state

- **WHEN** 使用者點「已歸檔」tab 且無 archived trip
- **THEN** SHALL render `[data-testid="trips-list-empty-filtered"]` 含「目前沒有已歸檔行程」字串 + `[data-testid="trips-list-archived-reset"]` 按鈕
