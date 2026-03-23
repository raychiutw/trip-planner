## 1. 色碼調整

- [ ] 1.1 修改 css/shared.css：body.theme-sky 的 --accent 從 #5BA4CF 改為 #3B88B8
- [ ] 1.2 修改 css/shared.css：body.theme-zen 的 --accent 從 #B8856C 改為 #9A6B50
- [ ] 1.3 修改 css/shared.css：body.theme-zen 的 --success 從 #9EB8A8 改為 #7A9A88
- [ ] 1.4 修改 src/hooks/useDarkMode.ts 的 THEME_COLORS：sky light 從 #5BA4CF 改為 #3B88B8，zen light 從 #B8856C 改為 #9A6B50
- [ ] 1.5 修改 src/pages/SettingPage.tsx 的 COLOR_THEMES：sky swatch 改為 #3B88B8，zen swatch 改為 #9A6B50

## 2. 移除 body 背景插畫

- [ ] 2.1 刪除 css/style.css 中 body.theme-* 的 background-image 規則
- [ ] 2.2 刪除 images/bg-sun-light.svg、bg-sun-dark.svg、bg-sky-light.svg、bg-sky-dark.svg、bg-zen-light.svg、bg-zen-dark.svg（刪前先 grep 確認無其他引用）

## 3. 插畫元件建立

- [ ] 3.1 建立 src/components/trip/ThemeArt.tsx，匯出 DayHeaderArt、DividerArt、FooterArt 三個元件，先以空殼確認 TypeScript 型別正確
- [ ] 3.2 實作 DayHeaderArt：陽光淺色（太陽+椰子樹+飛機）、陽光深色（金月#FFD080+星#FFF4C0+椰子樹+螢火蟲）；晴空淺色（熱氣球+海鷗+雲）、晴空深色（銀月+星+帆船剪影）；和風淺色（鳥居+櫻花枝+花瓣）、和風深色（金月+鳥居+夜櫻+星）；包裝容器 opacity 淺色 0.52、深色 0.40
- [ ] 3.3 實作 DividerArt：陽光（淺色海浪線條 / 深色螢火蟲光點）；晴空（淺色海鷗 / 深色藍白光點）；和風（淺色飄落花瓣 / 深色金色螢火蟲+花瓣）；高度固定 24px，aria-hidden="true"
- [ ] 3.4 實作 FooterArt：陽光（淺色大海浪 / 深色夜浪+星）；晴空（淺色海浪+帆船 / 深色夜浪+星）；和風（淺色遠山+禪圓 / 深色暗山+禪圓+星）；aria-hidden="true"
- [ ] 3.5 在 src/pages/TripPage.tsx 中引入 DayHeaderArt（day section header 右側）、DividerArt（timeline 卡片之間）、FooterArt（頁面底部）
- [ ] 3.6 從 useDarkMode hook 取得 colorTheme 和 isDark，傳入三個 ThemeArt 元件

## 4. Nav pills 靠右

- [ ] 4.1 在 css/style.css 中對 #navPills（或 .nav-pills）加 margin-left: auto

## 5. Build + 測試

- [ ] 5.1 npm run build 確認成功，無 TypeScript 錯誤
- [ ] 5.2 npm test 確認 unit tests 通過
- [ ] 5.3 確認 css-hig.test.js 通過（色碼與 CSS 規則符合 HIG 規範）
