## MODIFIED Requirements

### Requirement: 晴空主題淺色 accent 色碼

`css/shared.css` 中 `body.theme-sky`（或 `:root` 下的晴空主題覆蓋）的 `--accent` CSS 變數 SHALL 定義為 `#3B88B8`（原 `#5BA4CF`）。`useDarkMode.ts` 中 `THEME_COLORS` 的 `sky` light 值 MUST 同步更新為 `#3B88B8`。`SettingPage.tsx` 中 `COLOR_THEMES` 的 `sky` swatch 色碼 MUST 同步更新為 `#3B88B8`。

#### Scenario: body.theme-sky 淺色 --accent 為 #3B88B8

- **WHEN** 頁面帶有 `body.theme-sky` class 且無 `body.dark`
- **THEN** CSS 計算後 `--accent` SHALL 為 `#3B88B8`，不再是 `#5BA4CF`

#### Scenario: useDarkMode THEME_COLORS sky light 同步更新

- **WHEN** 讀取 `src/hooks/useDarkMode.ts`
- **THEN** `THEME_COLORS.sky.light`（或等效欄位）SHALL 為 `'#3B88B8'`

#### Scenario: SettingPage COLOR_THEMES sky swatch 同步更新

- **WHEN** 讀取 `src/pages/SettingPage.tsx`
- **THEN** `COLOR_THEMES` 中 sky 主題的 swatch 色碼 SHALL 為 `'#3B88B8'`

---

### Requirement: 和風主題淺色 accent 及 success 色碼

`css/shared.css` 中 `body.theme-zen` 的 `--accent` SHALL 定義為 `#9A6B50`（原 `#B8856C`），`--success` SHALL 定義為 `#7A9A88`（原 `#9EB8A8`）。`useDarkMode.ts` 中 `THEME_COLORS` 的 `zen` light 值 MUST 同步更新為 `#9A6B50`。`SettingPage.tsx` 中 `COLOR_THEMES` 的 `zen` swatch 色碼 MUST 同步更新為 `#9A6B50`。

#### Scenario: body.theme-zen 淺色 --accent 為 #9A6B50

- **WHEN** 頁面帶有 `body.theme-zen` class 且無 `body.dark`
- **THEN** CSS 計算後 `--accent` SHALL 為 `#9A6B50`，不再是 `#B8856C`

#### Scenario: body.theme-zen 淺色 --success 為 #7A9A88

- **WHEN** 頁面帶有 `body.theme-zen` class 且無 `body.dark`
- **THEN** CSS 計算後 `--success` SHALL 為 `#7A9A88`，不再是 `#9EB8A8`

#### Scenario: useDarkMode THEME_COLORS zen light 同步更新

- **WHEN** 讀取 `src/hooks/useDarkMode.ts`
- **THEN** `THEME_COLORS.zen.light`（或等效欄位）SHALL 為 `'#9A6B50'`

#### Scenario: SettingPage COLOR_THEMES zen swatch 同步更新

- **WHEN** 讀取 `src/pages/SettingPage.tsx`
- **THEN** `COLOR_THEMES` 中 zen 主題的 swatch 色碼 SHALL 為 `'#9A6B50'`
