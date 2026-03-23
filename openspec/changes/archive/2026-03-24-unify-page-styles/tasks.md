## Tasks

- [ ] 1. shared.css：加 `--page-max-w` + `--page-pt` token 到 `:root`
- [ ] 2. shared.css：加 `.page-simple` class（html 捲動重置 + page-layout block + container transition none）
- [ ] 3. shared.css：統一 `.sticky-nav` base 樣式（sticky + border-bottom + backdrop-filter + 置中標題）
- [ ] 4. style.css：行程頁 sticky-nav 改為 override（移除與 shared 重複的部分，保留特殊效果）
- [ ] 5. setting.css：移除捲動重置 + sticky-nav 重複定義，max-width 改用 `var(--page-max-w)`
- [ ] 6. admin.css：移除捲動重置 + sticky-nav 重複定義，max-width 改用 `var(--page-max-w)`
- [ ] 7. manage.css：移除 sticky-nav 重複定義，max-width 改用 `var(--page-max-w)`
- [ ] 8. edit.css：移除 sticky-nav 重複定義
- [ ] 9. SettingPage.tsx / AdminPage.tsx：html class 改用 `page-simple`（如需要）
- [ ] 9.5. shared.css：深色模式 `.sticky-nav` base border-bottom-color；style.css 保留行程頁特殊覆寫
- [ ] 10. 跑 `npx tsc --noEmit` + `npm test` 確認全過
- [ ] 11. 用 `/browse` 驗證四個頁面視覺效果不變（特別注意設定頁捲動不彈回）
- [ ] 12. 確認 edit.css 是否仍在使用（edit.html 已 redirect 到 /manage/），如為死碼則移除整個 sticky-nav 區塊
